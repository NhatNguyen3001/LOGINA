import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { AssignReq, AssignResultDTO, AssignmentListDTO, RecordedRunsDTO } from '@logina/contracts';
import { AppError, lessonsRepo, newId } from '@logina/db';
import { applyTexts } from '@logina/domain';
import type { AppDeps, AppEnv } from '../context.js';
import { requireBaseVersion } from '../middleware/base-version.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';
import { studentLocale, textsFor } from '../services/localize.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;

export function assignmentRoutes({ db }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const requireLesson = async (schoolId: string, lessonId: string): Promise<DocumentData> => {
    const lesson = await lessonsRepo.get(db, schoolId, lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return lesson;
  };

  routes.post(
    '/:id/assignments',
    requireBaseVersion(async (c) => (await requireLesson(c.var.user.schoolId, c.req.param('id') as string)).version as number),
    withIdempotency(db, async (c) => {
      const { schoolId, uid } = c.var.user;
      const lesson = await requireLesson(schoolId, c.req.param('id') as string);
      const lessonId = lesson.id as string;
      const req = AssignReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');

      const releases = (await db.collection(`lessons/${lessonId}/taskReleases`).where('status', '==', 'ACTIVE').get()).docs.map((d) => ({ id: d.id, ...d.data() })) as DocumentData[];
      const draftIds = lesson.currentTaskDraftIds as Record<string, string>;
      const current = SLOTS.map((slot) => releases.find((r) => r.taskDraftId === draftIds[slot]));
      if (current.some((release) => !release)) throw new AppError('TASKS_NOT_APPROVED', 409, 'Approve all five tasks first.');
      const translated = current.filter((release) => release?.translations).length;
      if (translated > 0 && translated < current.length) throw new AppError('TRANSLATION_MIXED', 409, 'Some tasks have no approved translation.');

      const earlier = await db.collection('assignments').where('schoolId', '==', schoolId).where('lessonId', '==', lessonId).get();
      const revision = earlier.size + 1;
      const assignmentId = newId('asg');
      const { baseVersion: _baseVersion, ...fields } = req.data;
      const releaseIds = Object.fromEntries(SLOTS.map((slot, i) => [slot, current[i]!.id]));

      const batch = db.batch();
      batch.create(db.doc(`assignments/${assignmentId}`), {
        ...fields,
        schoolId,
        lessonId,
        revision,
        releaseIds,
        openAccess: true,
        publishedBy: uid,
        publishedAt: FieldValue.serverTimestamp(),
      });
      batch.update(db.doc(`lessons/${lessonId}`), {
        stage: 'ASSIGNED',
        latestAssignmentId: assignmentId,
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return respond(c, AssignResultDTO, {
        assignmentId,
        revision,
        releaseLabels: Object.fromEntries(SLOTS.map((slot, i) => [slot, current[i]!.releaseLabel])),
      } as never);
    }),
  );

  return routes;
}

export function studentAssignmentRoutes({ db }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/runs', async (c) => {
    const { schoolId, uid } = c.var.user;
    const locale = await studentLocale(db, schoolId);
    const attempts = await db.collection('attempts').where('schoolId', '==', schoolId).where('studentId', '==', uid).get();
    const finished = attempts.docs.filter((doc) => doc.data().status === 'COMPLETE');
    const runs = await Promise.all(
      finished.map(async (doc) => {
        const attempt = doc.data();
        const lesson = (await db.doc(`lessons/${attempt.lessonId as string}`).get()).data();
        return { attemptId: doc.id, lessonTitle: applyTexts(lesson?.title ?? '', textsFor(lesson, locale)), run: attempt.run ?? 1, completedAt: attempt.completedAt.toDate().toISOString() };
      }),
    );
    return respond(c, RecordedRunsDTO, { runs: runs.sort((a, b) => b.completedAt.localeCompare(a.completedAt)) });
  });

  routes.get('/', async (c) => {
    const { schoolId, uid } = c.var.user;
    const locale = await studentLocale(db, schoolId);
    const docs = await db.collection('assignments').where('schoolId', '==', schoolId).orderBy('publishedAt', 'desc').get();
    const attempts = await db.collection('attempts').where('schoolId', '==', schoolId).where('studentId', '==', uid).get();

    const assignments = await Promise.all(
      docs.docs.map(async (doc) => {
        const assignment = doc.data();
        const lesson = (await db.doc(`lessons/${assignment.lessonId as string}`).get()).data();
        const teacher = (await db.doc(`users/${assignment.publishedBy as string}`).get()).data();
        const attempt = attempts.docs.find((a) => a.data().assignmentId === doc.id);
        return {
          assignmentId: doc.id,
          lessonTitle: applyTexts(lesson?.title ?? '', textsFor(lesson, locale)),
          teacherName: teacher?.displayName ?? '',
          ...(assignment.dueAt ? { dueAt: assignment.dueAt } : {}),
          ...(assignment.messageToStudents ? { messageToStudents: assignment.messageToStudents } : {}),
          ...(attempt ? { attemptId: attempt.id } : {}),
          status: attempt?.data().status ?? 'NOT_STARTED',
        };
      }),
    );
    return respond(c, AssignmentListDTO, { assignments });
  });

  return routes;
}
