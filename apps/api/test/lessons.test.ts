import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { LessonDTO, MaterialRefusalDTO } from '@logina/contracts';
import { findRestrictedKeys } from '@logina/contracts';
import { harness, minimalLesson, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;
let b: Client;

const pdf = async (pages: number): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage();
  return Buffer.from(await doc.save());
};
const docx = Buffer.from('PK\u0003\u0004word/document.xml');

const newLesson = async (client: Client, extra: object = {}) =>
  LessonDTO.parse(await (await client.post('/lessons', { ...minimalLesson(client.workspace.classId), ...extra })).json());

/** Stands in for the browser's PUT to the signed URL. */
async function upload(client: Client, lessonId: string, bytes: Buffer, fileName = 'file.pdf', contentType = 'application/pdf') {
  const response = await client.post(`/lessons/${lessonId}/materials/upload-url`, { fileName, contentType, sizeBytes: bytes.length });
  const { uploadId } = (await response.json()) as { uploadId: string };
  const ext = contentType === 'application/pdf' ? 'pdf' : 'docx';
  await h.live.bucket.file(`uploads/${lessonId}/${uploadId}.${ext}`).save(bytes);
  return { uploadId, path: `uploads/${lessonId}/${uploadId}.${ext}` };
}

const register = (client: Client, lessonId: string, uploadId: string) =>
  client.post(`/lessons/${lessonId}/materials`, { uploadId, title: 'Material' });

beforeAll(async () => {
  h = await harness({ liveUploadsPerDay: 1000 });
  [a, b] = await Promise.all([h.client(), h.client()]);
});

afterAll(async () => {
  await h.close();
});

describe('lessons', () => {
  it('creates lesson with editorTeacherIds from the class teacherIds and stage CREATE', async () => {
    const lesson = await newLesson(a);
    expect(lesson).toMatchObject({ stage: 'CREATE', editorTeacherIds: [a.workspace.teacherUid], version: 1 });
  });

  it('contentLocale defaults to the teacher uiLocale and accepts en or vi', async () => {
    expect((await newLesson(a)).contentLocale).toBe('en');
    expect((await newLesson(a, { contentLocale: 'vi' })).contentLocale).toBe('vi');
  });

  it('GET /lessons lists only this workspace', async () => {
    const lesson = await newLesson(a);
    const own = (await (await a.get('/lessons')).json()) as { lessons: { id: string; primaryClassName: string }[] };
    const other = (await (await b.get('/lessons')).json()) as { lessons: { id: string }[] };
    expect(own.lessons.find((l) => l.id === lesson.id)?.primaryClassName).toBe('12A3');
    expect(other.lessons.map((l) => l.id)).not.toContain(lesson.id);
  });

  it('another workspace gets 404 for GET /lessons/:id', async () => {
    const lesson = await newLesson(a);
    expect((await b.get(`/lessons/${lesson.id}`)).status).toBe(404);
  });

  it('title is required (400)', async () => {
    const { title: _title, ...rest } = minimalLesson(a.workspace.classId);
    expect((await a.post('/lessons', rest)).status).toBe(400);
  });

  it('a mutation needs no baseVersion on lessons and materials', async () => {
    const lesson = await newLesson(a);
    expect((await a.post(`/lessons/${lesson.id}/materials`, { sample: true })).status).toBe(201);
  });

  it('analyze enqueues PARSE, sets stage and shows as activeJobId', async () => {
    const lesson = await newLesson(a);
    await a.post(`/lessons/${lesson.id}/materials`, { sample: true });
    const job = (await (await a.post(`/lessons/${lesson.id}/analyze`)).json()) as { id: string; type: string };
    expect(job.type).toBe('PARSE');
    expect(h.enqueued).toContainEqual(expect.objectContaining({ jobId: job.id, type: 'PARSE', lessonId: lesson.id }));
    const after = LessonDTO.parse(await (await a.get(`/lessons/${lesson.id}`)).json());
    expect(after).toMatchObject({ stage: 'CLARIFY', activeJobId: job.id });
  });

  it('analyze without material is 409', async () => {
    const lesson = await newLesson(a);
    expect((await a.post(`/lessons/${lesson.id}/analyze`)).status).toBe(409);
  });

  it('sample material attaches the seeded PDF in the lesson locale', async () => {
    const lesson = await newLesson(a, { contentLocale: 'vi' });
    await a.post(`/lessons/${lesson.id}/materials`, { sample: true });
    const materials = await h.live.db.collection(`lessons/${lesson.id}/materialVersions`).get();
    expect(materials.docs[0]?.data()).toMatchObject({ storagePath: 'demo/material.vi.pdf' });
    expect((await h.live.db.doc(`lessons/${lesson.id}`).get()).data()?.aiMode).toBe('SEEDED');
  });
});

describe('classes', () => {
  it('GET /classes/:id returns id and name only', async () => {
    const response = await a.get(`/classes/${a.workspace.classId}`);
    expect(await response.json()).toEqual({ id: a.workspace.classId, name: '12A3' });
  });

  it('a class in another workspace is 404', async () => {
    expect((await b.get(`/classes/${a.workspace.classId}`)).status).toBe(404);
  });
});

describe('materials', () => {
  it('upload-url refuses another type with FILE_TYPE', async () => {
    const lesson = await newLesson(a);
    const response = await a.post(`/lessons/${lesson.id}/materials/upload-url`, { fileName: 'a.png', contentType: 'image/png', sizeBytes: 10 });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'FILE_TYPE' });
  });

  it('upload-url over 20 MB is refused with FILE_TOO_LARGE', async () => {
    const lesson = await newLesson(a);
    const response = await a.post(`/lessons/${lesson.id}/materials/upload-url`, { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 21 * 1024 * 1024 });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('register refuses a file whose bytes are not a supported type with FILE_TYPE', async () => {
    const lesson = await newLesson(a);
    const { uploadId, path } = await upload(a, lesson.id, Buffer.from('plain text'));
    const response = await register(a, lesson.id, uploadId);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'FILE_TYPE' });
    expect((await h.live.bucket.file(path).exists())[0]).toBe(false);
  });

  it('TOO_MANY_PAGES refuses an 11-page PDF before any job is created', async () => {
    const lesson = await newLesson(a);
    const { uploadId } = await upload(a, lesson.id, await pdf(11), 'big.pdf');
    const response = await register(a, lesson.id, uploadId);
    expect(response.status).toBe(422);
    const body = MaterialRefusalDTO.parse(await response.json());
    expect(body).toEqual({ code: 'TOO_MANY_PAGES', detail: { fileName: 'big.pdf', pageCount: 11, limit: 10 } });
    expect((await h.live.db.collection(`lessons/${lesson.id}/materialVersions`).get()).empty).toBe(true);
  });

  it('an unreadable PDF is refused with UNREADABLE', async () => {
    const lesson = await newLesson(a);
    const { uploadId } = await upload(a, lesson.id, Buffer.from('%PDF-broken'));
    const response = await register(a, lesson.id, uploadId);
    expect(await response.json()).toMatchObject({ code: 'UNREADABLE' });
  });

  it('a 2-page PDF registers with pageCount 2, unitKind PAGE and aiMode LIVE', async () => {
    const lesson = await newLesson(a);
    const { uploadId } = await upload(a, lesson.id, await pdf(2));
    expect((await register(a, lesson.id, uploadId)).status).toBe(201);
    const material = (await h.live.db.collection(`lessons/${lesson.id}/materialVersions`).get()).docs[0]?.data();
    expect(material).toMatchObject({ pageCount: 2, unitKind: 'PAGE', parseStatus: 'PENDING' });
    expect((await h.live.db.doc(`lessons/${lesson.id}`).get()).data()?.aiMode).toBe('LIVE');
  });

  it('a DOCX registers with unitKind SECTION and aiMode LIVE', async () => {
    const lesson = await newLesson(a);
    const { uploadId } = await upload(a, lesson.id, docx, 'a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect((await register(a, lesson.id, uploadId)).status).toBe(201);
    expect((await h.live.db.collection(`lessons/${lesson.id}/materialVersions`).get()).docs[0]?.data().unitKind).toBe('SECTION');
  });

  it('view-url is a signed read URL for this workspace and never exposes storagePath', async () => {
    const lesson = await newLesson(a);
    await a.post(`/lessons/${lesson.id}/materials`, { sample: true });
    const materialId = (await h.live.db.collection(`lessons/${lesson.id}/materialVersions`).get()).docs[0]!.id;
    const response = await a.get(`/lessons/${lesson.id}/materials/${materialId}/view-url`);
    const body = (await response.json()) as { url: string; expiresAt: string };
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'url']);
    expect(findRestrictedKeys(body, 'teacher')).toEqual([]);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    expect((await b.get(`/lessons/${lesson.id}/materials/${materialId}/view-url`)).status).toBe(404);
  });
});

describe('jobs', () => {
  const seedJob = async (client: Client, fields: object) => {
    const lesson = await newLesson(client);
    const id = `job_${randomUUID()}`;
    await h.live.db.doc(`jobs/${id}`).set({
      schoolId: client.workspace.schoolId,
      lessonId: lesson.id,
      type: 'PARSE',
      status: 'RUNNING',
      steps: [],
      targetIds: [],
      ...fields,
    });
    return { id, lesson };
  };

  it('JobDTO exposes steps and errorCode but not error details', async () => {
    const { id } = await seedJob(a, { status: 'FAILED', error: { code: 'UNREADABLE', detail: 'x' } });
    const body = await (await a.get(`/jobs/${id}`)).json();
    expect(body).toMatchObject({ errorCode: 'UNREADABLE' });
    expect(body).not.toHaveProperty('error');
  });

  it('a job in another workspace is 404', async () => {
    const { id } = await seedJob(a, {});
    expect((await b.get(`/jobs/${id}`)).status).toBe(404);
  });

  it('cancel sets CANCELLED and is idempotent', async () => {
    const { id } = await seedJob(a, {});
    const key = randomUUID();
    expect(await (await a.post(`/jobs/${id}/cancel`, {}, key)).json()).toMatchObject({ status: 'CANCELLED' });
    expect((await a.post(`/jobs/${id}/cancel`, {}, key)).status).toBe(200);
  });

  it('cancel of a DONE job returns 409', async () => {
    const { id } = await seedJob(a, { status: 'DONE' });
    expect((await a.post(`/jobs/${id}/cancel`)).status).toBe(409);
  });

  it('answer USE_DETECTED switches contentLocale and re-enqueues the job', async () => {
    const { id, lesson } = await seedJob(a, { status: 'NEEDS_INPUT', question: { kind: 'LANGUAGE_MISMATCH', detected: 'vi', chosen: 'en' } });
    const body = await (await a.post(`/jobs/${id}/answer`, { choice: 'USE_DETECTED' })).json();
    expect(body).toMatchObject({ status: 'QUEUED' });
    expect((await h.live.db.doc(`lessons/${lesson.id}`).get()).data()?.contentLocale).toBe('vi');
    expect(h.enqueued.map((job) => job.jobId)).toContain(id);
  });

  it('answer KEEP_CHOSEN keeps contentLocale', async () => {
    const { id, lesson } = await seedJob(a, { status: 'NEEDS_INPUT', question: { kind: 'LANGUAGE_MISMATCH', detected: 'vi', chosen: 'en' } });
    await a.post(`/jobs/${id}/answer`, { choice: 'KEEP_CHOSEN' });
    expect((await h.live.db.doc(`lessons/${lesson.id}`).get()).data()?.contentLocale).toBe('en');
  });

  it('answer on a job that is not NEEDS_INPUT is 409', async () => {
    const { id } = await seedJob(a, {});
    expect((await a.post(`/jobs/${id}/answer`, { choice: 'KEEP_CHOSEN' })).status).toBe(409);
  });
});
