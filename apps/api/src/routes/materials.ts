import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { MaterialViewUrlDTO, RegisterMaterialReq, UploadUrlDTO, UploadUrlReq } from '@logina/contracts';
import { AppError, lessonsRepo, newId } from '@logina/db';
import type { AppDeps, AppEnv } from '../context.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { enforce } from '../middleware/rate-limit.js';
import { respond } from '../middleware/respond.js';
import { RateLimited } from '../services/limits.js';
import { incrementLiveUsage } from '../services/live-usage.js';
import { inspectUpload, MaterialRefusal, MAX_BYTES, PDF, sha256 } from '../services/materials.js';

const SIGNED_URL_MS = 10 * 60 * 1000;

export function materialRoutes(deps: AppDeps): Hono<AppEnv> {
  const { db, files, config, now } = deps;
  const routes = new Hono<AppEnv>();

  const requireLesson = async (schoolId: string, lessonId: string) => {
    const lesson = await lessonsRepo.get(db, schoolId, lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return lesson;
  };

  routes.post(
    '/:id/materials/upload-url',
    withIdempotency(db, async (c) => {
      const lessonId = c.req.param('id') as string;
      await requireLesson(c.var.user.schoolId, lessonId);
      const body = (await c.req.json()) as { fileName?: string; sizeBytes?: number };
      const req = UploadUrlReq.safeParse(body);
      if (!req.success) {
        if (typeof body.sizeBytes === 'number' && typeof body.fileName === 'string') {
          throw new MaterialRefusal({ code: 'FILE_TYPE', detail: { fileName: body.fileName } });
        }
        throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      }
      const { fileName, sizeBytes, contentType } = req.data;
      if (sizeBytes > MAX_BYTES) throw new MaterialRefusal({ code: 'FILE_TOO_LARGE', detail: { fileName } });

      const uploadId = randomUUID();
      const ext = contentType === PDF ? 'pdf' : 'docx';
      const expires = new Date(now().getTime() + SIGNED_URL_MS);
      const url = await files.signWriteUrl(`uploads/${lessonId}/${uploadId}.${ext}`, contentType, expires);
      await db.doc(`lessons/${lessonId}/uploads/${uploadId}`).set({ fileName, ext });
      return respond(c, UploadUrlDTO, { uploadId, url, expiresAt: expires.toISOString() });
    }),
  );

  routes.post(
    '/:id/materials',
    withIdempotency(db, async (c) => {
      const lessonId = c.req.param('id') as string;
      const lesson = await requireLesson(c.var.user.schoolId, lessonId);
      const parsed = RegisterMaterialReq.safeParse(await c.req.json());
      if (!parsed.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      const req = parsed.data;
      const samples = ((await db.doc('demoMeta/state').get()).data()?.sampleSha256 ?? {}) as Record<string, string>;

      const materialId = newId('mat');
      const lessonRef = db.doc(`lessons/${lessonId}`);
      const materialRef = db.doc(`lessons/${lessonId}/materialVersions/${materialId}`);

      if ('sample' in req) {
        if (!config.demoMode) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
        const locale = lesson.contentLocale as 'en' | 'vi';
        const batch = db.batch();
        batch.create(materialRef, {
          sourceId: newId('src'),
          version: 1,
          title: 'Sample material',
          storagePath: `demo/material.${locale}.pdf`,
          fileName: 'material.pdf',
          mimeType: PDF,
          unitKind: 'PAGE',
          pageCount: 2,
          sha256: samples[locale] ?? '',
          parseStatus: 'PENDING',
        });
        batch.update(lessonRef, { aiMode: 'SEEDED', currentMaterialVersionId: materialId, updatedAt: FieldValue.serverTimestamp() });
        await batch.commit();
        return c.json({ materialVersionId: materialId, aiMode: 'SEEDED' }, 201);
      }

      const upload = (await db.doc(`lessons/${lessonId}/uploads/${req.uploadId}`).get()).data();
      if (!upload) throw new AppError('NOT_FOUND', 404, 'Not found.');
      const storagePath = `uploads/${lessonId}/${req.uploadId}.${upload.ext as string}`;
      const fileName = upload.fileName as string;

      const removeOnRefusal = async (work: () => Promise<Response>): Promise<Response> => {
        try {
          return await work();
        } catch (error) {
          if (error instanceof MaterialRefusal || error instanceof RateLimited) await files.remove(storagePath);
          throw error;
        }
      };

      return removeOnRefusal(async () => {
        if ((await files.size(storagePath)) > MAX_BYTES) throw new MaterialRefusal({ code: 'FILE_TOO_LARGE', detail: { fileName } });
        const bytes = await files.read(storagePath);
        const hash = sha256(bytes);
        const matchedLocale = Object.entries(samples).find(([, sample]) => sample === hash)?.[0];
        const aiMode = config.demoMode && matchedLocale ? 'SEEDED' : 'LIVE';
        if (aiMode === 'LIVE') await enforce(deps, c, 'UPLOAD');
        const { mimeType, pageCount, unitKind } = await inspectUpload(bytes, fileName);
        const seenOnLesson = !(
          await lessonRef.collection('materialVersions').where('sha256', '==', hash).limit(1).get()
        ).empty;

        await db.runTransaction(async (tx) => {
          if (aiMode === 'LIVE' && config.demoMode && !seenOnLesson) {
            await incrementLiveUsage(db, tx, now(), config.liveUploadsPerDay, fileName);
          }
          const { uploadId: _uploadId, ...details } = req;
          tx.create(materialRef, {
            ...details,
            sourceId: newId('src'),
            version: 1,
            storagePath,
            fileName,
            mimeType,
            unitKind,
            pageCount,
            sha256: hash,
            parseStatus: 'PENDING',
          });
          tx.update(lessonRef, {
            aiMode,
            currentMaterialVersionId: materialId,
            updatedAt: FieldValue.serverTimestamp(),
            ...(aiMode === 'SEEDED' ? { contentLocale: matchedLocale } : {}),
          });
        });
        return c.json({ materialVersionId: materialId, aiMode }, 201);
      });
    }),
  );

  routes.get('/:id/materials/:materialVersionId/view-url', async (c) => {
    const lessonId = c.req.param('id');
    await requireLesson(c.var.user.schoolId, lessonId);
    const material = (await db.doc(`lessons/${lessonId}/materialVersions/${c.req.param('materialVersionId')}`).get()).data();
    if (!material) throw new AppError('NOT_FOUND', 404, 'Not found.');
    const expires = new Date(now().getTime() + SIGNED_URL_MS);
    const url = await files.signReadUrl(material.storagePath as string, expires);
    return respond(c, MaterialViewUrlDTO, { url, expiresAt: expires.toISOString() });
  });

  return routes;
}


