import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { CreateLessonReq, JobDTO, LessonDTO, LessonListDTO } from '@logina/contracts';
import { AppError, classesRepo, lessonsRepo, newId } from '@logina/db';
import type { AppDeps, AppEnv } from '../context.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { limited } from '../middleware/rate-limit.js';
import { respond } from '../middleware/respond.js';
import { createJob, toJobDTO } from '../services/jobs.js';

const iso = (value: { toDate: () => Date } | undefined): string => value?.toDate().toISOString() ?? new Date(0).toISOString();

export const toLessonDTO = (lesson: DocumentData) => ({
  id: lesson.id,
  title: lesson.title,
  subject: lesson.subject,
  topic: lesson.topic,
  level: lesson.level,
  stage: lesson.stage,
  version: lesson.version,
  contentLocale: lesson.contentLocale,
  primaryClassId: lesson.primaryClassId,
  editorTeacherIds: lesson.editorTeacherIds,
  currentTaskDraftIds: lesson.currentTaskDraftIds ?? {},
  aiMode: lesson.aiMode,
  ...(lesson.latestAssignmentId ? { latestAssignmentId: lesson.latestAssignmentId } : {}),
  ...(lesson.activeJobId ? { activeJobId: lesson.activeJobId } : {}),
});

export function lessonRoutes(deps: AppDeps): Hono<AppEnv> {
  const { db, enqueue } = deps;
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const { schoolId, uid } = c.var.user;
    const lessons = await lessonsRepo.listForTeacher(db, schoolId, uid);
    const classes = await Promise.all(
      [...new Set(lessons.map((l) => l.primaryClassId as string))].map((id) => classesRepo.get(db, schoolId, id)),
    );
    const className = (id: string) => classes.find((k) => k?.id === id)?.name ?? '';
    return respond(c, LessonListDTO, {
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        stage: l.stage,
        aiMode: l.aiMode,
        updatedAt: iso(l.updatedAt),
        primaryClassName: className(l.primaryClassId),
        ...(l.latestAssignmentId ? { latestAssignmentId: l.latestAssignmentId } : {}),
      })),
    });
  });

  routes.post(
    '/',
    withIdempotency(db, async (c) => {
      const { schoolId, uid } = c.var.user;
      const req = CreateLessonReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');

      const klass = await classesRepo.get(db, schoolId, req.data.primaryClassId);
      if (!klass) throw new AppError('NOT_FOUND', 404, 'Not found.');
      const school = (await db.doc(`schools/${schoolId}`).get()).data();

      const lessonId = newId('les');
      const intentId = newId('int');
      const { objective, ...fields } = req.data;
      const lesson = {
        ...fields,
        schoolId,
        ownerTeacherId: uid,
        editorTeacherIds: klass.teacherIds,
        contentLocale: req.data.contentLocale ?? school?.uiLocale ?? 'en',
        stage: 'CREATE',
        currentIntentVersionId: intentId,
        currentTaskDraftIds: {},
        version: 1,
        aiMode: 'LIVE',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      const batch = db.batch();
      batch.create(db.doc(`lessons/${lessonId}`), lesson);
      batch.create(db.doc(`lessons/${lessonId}/teacherIntentVersions/${intentId}`), {
        version: 1,
        objective,
        reasoningTarget: objective,
        learnerTask: '',
        constraints: '',
        evaluationBasis: '',
        isInstructionMetadata: true,
      });
      await batch.commit();
      return respond(c, LessonDTO, toLessonDTO({ id: lessonId, ...lesson }), 201);
    }),
  );

  routes.get('/:id', async (c) => {
    const lesson = await lessonsRepo.get(db, c.var.user.schoolId, c.req.param('id'));
    if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return respond(c, LessonDTO, toLessonDTO(lesson));
  });

  routes.post(
    '/:id/analyze',
    withIdempotency(db, limited(deps, 'AI_ACTION', async (c) => {
      const { schoolId } = c.var.user;
      const lessonId = c.req.param('id') as string;
      const lesson = await lessonsRepo.get(db, schoolId, lessonId);
      if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
      if (!lesson.currentMaterialVersionId) throw new AppError('MATERIAL_REQUIRED', 409, 'Attach material first.');
      if (lesson.activeJobId) throw new AppError('JOB_RUNNING', 409, 'A job is already running.');

      const job = await createJob(db, { schoolId, lessonId, type: 'PARSE' });
      await db.doc(`lessons/${lessonId}`).update({ stage: 'CLARIFY', activeJobId: job.id });
      await enqueue({ jobId: job.id, type: 'PARSE', lessonId, targetIds: [] });
      return respond(c, JobDTO, toJobDTO(job));
    })),
  );

  return routes;
}
