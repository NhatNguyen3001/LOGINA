import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/** The shared part of the start state: the sample PDFs and their hashes. Workspaces are made per session. */
const SEED_VERSION = 1;
const LOCALES = ['en', 'vi'] as const;

const { GCP_PROJECT_ID, MATERIALS_BUCKET, FIRESTORE_DATABASE_ID } = process.env;
if (!GCP_PROJECT_ID || !MATERIALS_BUCKET) throw new Error('Set GCP_PROJECT_ID and MATERIALS_BUCKET.');

const firebase = initializeApp({ credential: applicationDefault(), projectId: GCP_PROJECT_ID });
const bucket = getStorage(firebase).bucket(MATERIALS_BUCKET);

const hashes = await Promise.all(
  LOCALES.map(async (locale) => {
    const path = fileURLToPath(new URL(`../../packages/domain/fixtures/dia-ly-12-bai-8/${locale}/material.pdf`, import.meta.url));
    const bytes = readFileSync(path);
    await bucket.file(`demo/material.${locale}.pdf`).save(bytes, { contentType: 'application/pdf', resumable: false });
    return [locale, createHash('sha256').update(bytes).digest('hex')] as const;
  }),
);

await getFirestore(firebase, FIRESTORE_DATABASE_ID || '(default)')
  .doc('demoMeta/state')
  .set({ seedVersion: SEED_VERSION, sampleSha256: Object.fromEntries(hashes) }, { merge: true });
console.log(`Seeded ${LOCALES.length} sample PDFs into ${MATERIALS_BUCKET}.`);
