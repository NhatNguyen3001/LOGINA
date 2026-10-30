export interface Config {
  noSignIn: boolean;
  demoMode: boolean;
  projectId: string;
  databaseId: string;
  materialsBucket: string;
  liveUploadsPerDay: number;
  researchEnabled: boolean;
  participantType: string;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  return {
    noSignIn: env.NO_SIGN_IN === 'true',
    demoMode: env.DEMO_MODE === 'true',
    projectId: env.GCP_PROJECT_ID ?? 'logina-dev',
    databaseId: env.FIRESTORE_DATABASE_ID || '(default)',
    materialsBucket: env.MATERIALS_BUCKET ?? 'logina-dev-materials',
    liveUploadsPerDay: Number(env.LIVE_UPLOADS_PER_DAY ?? 100),
    researchEnabled: env.RESEARCH_ENABLED !== 'false',
    participantType: env.PARTICIPANT_TYPE ?? 'judge',
  };
}

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  noSignIn: true,
  demoMode: true,
  projectId: 'logina-dev',
  databaseId: 'logina-test',
  materialsBucket: 'logina-dev-test',
  liveUploadsPerDay: 100,
  researchEnabled: true,
  participantType: 'judge',
  ...overrides,
});
