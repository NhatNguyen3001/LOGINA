import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { WorkerConfig } from '../config.js';
import { JobFailure } from '../errors.js';

export type Role = 'reader' | 'analyzer' | 'generator' | 'xreason' | 'translator' | 'translationCheck';
export type Part = { text: string } | { fileData: { fileUri: string; mimeType: string } };

export interface GenerateRequest {
  role: Role;
  model: string;
  parts: Part[];
  responseSchema: unknown;
}

/** Injected so tests never reach Vertex AI. */
export interface GenaiClient {
  generate: (request: GenerateRequest) => Promise<string>;
}

export interface StructuredRequest<S extends z.ZodType> {
  role: Role;
  schema: S;
  variables?: Record<string, string>;
  files?: { gcsUri: string; mimeType: string }[];
  text?: string;
}

export const modelFor = (role: Role, config: WorkerConfig): string =>
  ({ reader: config.readerModel, generator: config.generatorModel, analyzer: config.xreasonModel, xreason: config.xreasonModel, translator: config.translatorModel, translationCheck: config.xreasonModel })[role];

export const validatorVersion = (role: Role, config: WorkerConfig, seeded: boolean): string =>
  `${role}@${config.version}+${seeded ? 'seeded' : modelFor(role, config)}`;

const logFailure = (role: Role, attempt: number, failure: 'CALL_FAILED' | 'NOT_JSON' | 'WRONG_SHAPE') =>
  console.warn(JSON.stringify({ event: 'AI_ATTEMPT_FAILED', role, attempt: attempt + 1, failure }));

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A call that never answers must not hold a job past its limit. */
async function withinTime(call: Promise<string>, ms: number): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([call.catch(() => null), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const PROMPT_VERSION = 'v1';
/** The bundle sits at a different depth than this source file, so the image sets PROMPT_DIR. */
const PROMPT_DIR = process.env.PROMPT_DIR ?? fileURLToPath(new URL('../../prompts/', import.meta.url));

function loadPrompt(role: Role, variables: Record<string, string>): string {
  const template = readFileSync(join(PROMPT_DIR, `${role}.${PROMPT_VERSION}.md`), 'utf8');
  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), template);
}

/** Parsed with the same schema it was asked for; one retry, then the job fails. */
export async function generateStructured<S extends z.ZodType>(
  genai: GenaiClient,
  config: WorkerConfig,
  { role, schema, variables = {}, files = [], text }: StructuredRequest<S>,
): Promise<z.infer<S>> {
  const parts: Part[] = [
    { text: loadPrompt(role, variables) },
    ...files.map(({ gcsUri, mimeType }) => ({ fileData: { fileUri: gcsUri, mimeType } })),
    ...(text ? [{ text }] : []),
  ];
  const request: GenerateRequest = { role, model: modelFor(role, config), parts, responseSchema: z.toJSONSchema(schema) };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await pause(config.aiRetryDelayMs);
    const raw = await withinTime(genai.generate(request), config.aiCallTimeoutMs);
    if (raw === null) {
      logFailure(role, attempt, 'CALL_FAILED');
      continue;
    }
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      logFailure(role, attempt, 'WRONG_SHAPE');
    } catch {
      logFailure(role, attempt, 'NOT_JSON');
    }
  }
  throw new JobFailure('AI_FAILED');
}
