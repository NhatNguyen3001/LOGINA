import { liveConfig } from './packages/test-utils/src/live.ts';

/** Tests run against the live project (AGENTS.md). Later tasks read these from env. */
export default function setup() {
  const { projectId, databaseId, bucket } = liveConfig();
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.FIRESTORE_DATABASE_ID = databaseId;
  process.env.MATERIALS_BUCKET = bucket;
}
