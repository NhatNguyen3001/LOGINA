import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { WorkerConfig } from '../config.js';
import { JobFailure } from '../errors.js';

export type Role = 'reader' | 'analyzer' | 'generator' | 'xreason' | 'translator' | 'translationCheck';
export type Part = { text: string } | { fileData: { fileUri: string; mimeType: string } };
export type Thinking = 'LOW' | 'MEDIUM' | 'HIGH';

/** Enough thinking where judgment matters, little where the work is copying or translating. */
export const THINKING: Record<Role, Thinking> = { reader: 'LOW', analyzer: 'HIGH', generator: 'MEDIUM', xreason: 'MEDIUM', translator: 'LOW', translationCheck: 'LOW' };

/** A pause before the next try of a busy AI call, so the teacher's screen can count down. */
export interface AiWait {
  attempt: number;
  of: number;
  retryAt: Date;
}
export type ThoughtHandler = (text: string) => Promise<void>;

export interface GenerateRequest {
  role: Role;
  model: string;
  parts: Part[];
  responseSchema: unknown;
  thinking?: Thinking;
  onThought?: ThoughtHandler;
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
  thinking?: Thinking;
  onThought?: ThoughtHandler;
  /** Called before each pause, then with null once the call is over either way. */
  onWait?: (wait: AiWait | null) => Promise<void>;
}

export const modelFor = (role: Role, config: WorkerConfig): string =>
  ({ reader: config.readerModel, generator: config.generatorModel, analyzer: config.analyzerModel, xreason: config.xreasonModel, translator: config.translatorModel, translationCheck: config.xreasonModel })[role];

export const validatorVersion = (role: Role, config: WorkerConfig, seeded: boolean): string =>
  `${role}@${config.version}+${seeded ? 'seeded' : modelFor(role, config)}`;

type CallFailure = { reason: 'BUSY' | 'TIMEOUT' | 'ERROR'; status?: number; message?: string };

const logFailure = (role: Role, attempt: number, failure: 'CALL_FAILED' | 'NOT_JSON' | 'WRONG_SHAPE', why: Partial<CallFailure> = {}) =>
  console.warn(JSON.stringify({ event: 'AI_ATTEMPT_FAILED', role, attempt: attempt + 1, failure, ...why }));

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 429 and 503 mean the service is busy for now, so waiting longer is worth it. */
const BUSY_STATUSES = [429, 503];
const BUSY_TRIES = 4;
const OTHER_TRIES = 2;

function failureOf(error: unknown): CallFailure {
  const { status, code, message } = (error ?? {}) as { status?: unknown; code?: unknown; message?: unknown };
  const httpStatus = typeof status === 'number' ? status : typeof code === 'number' ? code : undefined;
  return {
    reason: httpStatus !== undefined && BUSY_STATUSES.includes(httpStatus) ? 'BUSY' : 'ERROR',
    ...(httpStatus !== undefined ? { status: httpStatus } : {}),
    ...(typeof message === 'string' && message ? { message: message.slice(0, 300) } : {}),
  };
}

/** A call that never answers must not hold a job past its limit. */
async function withinTime(call: Promise<string>, ms: number): Promise<{ text: string } | CallFailure> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CallFailure>((resolve) => {
    timer = setTimeout(() => resolve({ reason: 'TIMEOUT' }), ms);
  });
  try {
    return await Promise.race([call.then((text) => ({ text }), failureOf), timeout]);
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
  { role, schema, variables = {}, files = [], text, thinking = THINKING[role], onThought, onWait }: StructuredRequest<S>,
): Promise<z.infer<S>> {
  const parts: Part[] = [
    { text: loadPrompt(role, variables) },
    ...files.map(({ gcsUri, mimeType }) => ({ fileData: { fileUri: gcsUri, mimeType } })),
    ...(text ? [{ text }] : []),
  ];
  const request: GenerateRequest = { role, model: modelFor(role, config), parts, responseSchema: z.toJSONSchema(schema), thinking, ...(onThought ? { onThought } : {}) };

  /** A busy service gets more tries with longer pauses; anything else gets one retry. */
  let busy = false;
  let waited = false;
  try {
    for (let attempt = 0; attempt < (busy ? BUSY_TRIES : OTHER_TRIES); attempt += 1) {
      if (attempt > 0) {
        const delay = config.aiRetryDelayMs * 2 ** (attempt - 1);
        if (busy) {
          waited = true;
          await onWait?.({ attempt: attempt + 1, of: BUSY_TRIES, retryAt: new Date(Date.now() + delay) });
        }
        await pause(delay);
      }
      const result = await withinTime(genai.generate(request), config.aiCallTimeoutMs);
      if (!('text' in result)) {
        busy = result.reason === 'BUSY';
        logFailure(role, attempt, 'CALL_FAILED', result);
        continue;
      }
      busy = false;
      try {
        const parsed = schema.safeParse(JSON.parse(result.text));
        if (parsed.success) return parsed.data;
        logFailure(role, attempt, 'WRONG_SHAPE');
      } catch {
        logFailure(role, attempt, 'NOT_JSON');
      }
    }
    throw new JobFailure(busy ? 'AI_BUSY' : 'AI_FAILED');
  } finally {
    if (waited) await onWait?.(null);
  }
}
