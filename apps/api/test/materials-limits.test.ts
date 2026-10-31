import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { LessonDTO } from '@logina/contracts';
import { usageDay } from '../src/services/live-usage.js';
import { sha256 } from '../src/services/materials.js';
import { harness, minimalLesson, type Client, type Harness } from './helpers.js';

/** A date of its own, so the shared daily counter belongs to this file. */
const NOW = new Date('2031-03-01T17:30:00Z');
const DAY = '2031-03-02';

let h: Harness;
let off: Harness;
let a: Client;
let sampleBytes: Buffer;

const pdf = async (seed: string): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  doc.addPage().drawText(seed);
  return Buffer.from(await doc.save({ useObjectStreams: false }));
};

async function registerFile(client: Client, harnessUsed: Harness, lessonId: string, bytes: Buffer) {
  const response = await client.post(`/lessons/${lessonId}/materials/upload-url`, { fileName: 'f.pdf', contentType: 'application/pdf', sizeBytes: bytes.length });
  const { uploadId } = (await response.json()) as { uploadId: string };
  await harnessUsed.live.bucket.file(`uploads/${lessonId}/${uploadId}.pdf`).save(bytes);
  return client.post(`/lessons/${lessonId}/materials`, { uploadId, title: 'M' });
}

const newLesson = async (client: Client) =>
  LessonDTO.parse(await (await client.post('/lessons', minimalLesson(client.workspace.classId))).json());

const aiMode = async (lessonId: string) => (await h.live.db.doc(`lessons/${lessonId}`).get()).data()?.aiMode;

beforeAll(async () => {
  h = await harness({ liveUploadsPerDay: 2 }, { now: () => NOW });
  off = await harness({ demoMode: false });
  a = await h.client();
  sampleBytes = await pdf(`sample-${randomUUID()}`);
  await h.live.db.doc(`demoMeta/liveUsage_${DAY}`).delete();
  await h.live.db.doc('demoMeta/state').set({ sampleSha256: { en: sha256(sampleBytes), vi: 'none' } }, { merge: true });
});

afterAll(async () => {
  await h.live.db.doc(`demoMeta/liveUsage_${DAY}`).delete();
  await h.live.db.doc('demoMeta/state').delete();
  await h.close();
  await off.close();
});

describe('daily limit and sample matching', () => {
  it('daily counter uses the Asia/Ho_Chi_Minh day', () => {
    expect(usageDay(NOW)).toBe(DAY);
  });

  it('a byte-identical copy of the sample PDF gets aiMode SEEDED and does not count', async () => {
    const lesson = await newLesson(a);
    expect((await registerFile(a, h, lesson.id, sampleBytes)).status).toBe(201);
    expect(await aiMode(lesson.id)).toBe('SEEDED');
    expect((await h.live.db.doc(`demoMeta/liveUsage_${DAY}`).get()).exists).toBe(false);
  });

  it('uploaded file that is not the sample gets aiMode LIVE', async () => {
    const lesson = await newLesson(a);
    await registerFile(a, h, lesson.id, await pdf('first'));
    expect(await aiMode(lesson.id)).toBe('LIVE');
  });

  it('same file registered twice on the same lesson counts once', async () => {
    const lesson = await newLesson(a);
    const bytes = await pdf('twice');
    await registerFile(a, h, lesson.id, bytes);
    await registerFile(a, h, lesson.id, bytes);
    expect((await h.live.db.doc(`demoMeta/liveUsage_${DAY}`).get()).data()?.count).toBe(2);
  });

  it('DAILY_LIMIT refuses once live uploads today reach LIVE_UPLOADS_PER_DAY', async () => {
    const lesson = await newLesson(a);
    const response = await registerFile(a, h, lesson.id, await pdf('third'));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'DAILY_LIMIT' });
    expect((await a.post(`/lessons/${lesson.id}/materials`, { sample: true })).status).toBe(201);
  });

  it('with DEMO_MODE false, the sample is refused and every file is LIVE', async () => {
    const b = await off.client();
    const lesson = await newLesson(b);
    expect((await b.post(`/lessons/${lesson.id}/materials`, { sample: true })).status).toBe(400);
    await registerFile(b, off, lesson.id, sampleBytes);
    expect(await aiMode(lesson.id)).toBe('LIVE');
  });
});
