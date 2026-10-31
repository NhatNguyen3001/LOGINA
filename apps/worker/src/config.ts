export interface WorkerConfig {
  seededAi: boolean;
  liveAi: boolean;
  readerModel: string;
  generatorModel: string;
  xreasonModel: string;
  translatorModel: string;
  version: string;
  stepDelayMs: number;
  deadlineMs: number;
  materialsBucket: string;
}

type Env = Record<string, string | undefined>;

export const loadWorkerConfig = (env: Env = process.env): WorkerConfig => ({
  seededAi: env.SEEDED_AI === 'true',
  liveAi: env.LIVE_AI === 'true',
  readerModel: env.READER_MODEL ?? 'gemini-4-argon',
  generatorModel: env.GENERATOR_MODEL ?? 'gemini-4-argon',
  xreasonModel: env.XREASON_MODEL ?? 'gemini-4-argon',
  translatorModel: env.TRANSLATOR_MODEL ?? 'gemini-4-argon',
  version: '0.1.0',
  stepDelayMs: Number(env.SEEDED_STEP_DELAY_MS ?? 5000),
  /** Stays under the 30 minute dispatch deadline in apps/api/src/jobs/enqueue.ts. */
  deadlineMs: 25 * 60 * 1000,
  materialsBucket: env.MATERIALS_BUCKET ?? 'logina-dev-materials',
});

export const testWorkerConfig = (overrides: Partial<WorkerConfig> = {}): WorkerConfig => ({
  ...loadWorkerConfig({}),
  materialsBucket: 'logina-dev-test',
  stepDelayMs: 0,
  ...overrides,
});
