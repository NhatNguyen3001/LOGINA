import { FieldValue } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { DemoSnapshotsDTO } from '@logina/contracts';
import { AppError, lessonsRepo, scopedGet, snapshotId } from '@logina/db';
import type { AppDeps, AppEnv } from '../context.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { limited } from '../middleware/rate-limit.js';
import { respond } from '../middleware/respond.js';
import { restoreWorkspace, simulateClass } from '../services/demo.js';

const ok = { ok: true };

export function demoRoutes(deps: AppDeps): Hono<AppEnv> {
  const { db, files, config, enqueue } = deps;
  const routes = new Hono<AppEnv>();

  const workspaceOf = (user: AppEnv['Variables']['user']) => ({ schoolId: user.schoolId, teacherUid: user.uid, classId: user.classIds[0]! });

  routes.post(
    '/reset',
    withIdempotency(db, limited(deps, 'RESET', async (c) => {
      await restoreWorkspace(db, files, workspaceOf(c.var.user), config.readySnapshot);
      return c.json(ok);
    })),
  );

  routes.post(
    '/fail-next-rerun',
    withIdempotency(db, async (c) => {
      await db.doc(`schools/${c.var.user.schoolId}`).update({ failNextRerun: true });
      return c.json(ok);
    }),
  );

  routes.post(
    '/simulate-class',
    withIdempotency(db, limited(deps, 'SIMULATE_CLASS', async (c) => {
      const { schoolId } = c.var.user;
      const { assignmentId } = (await c.req.json()) as { assignmentId?: string };
      const assignment = assignmentId ? await scopedGet(db.doc(`assignments/${assignmentId}`), schoolId) : null;
      if (!assignment) throw new AppError('NOT_FOUND', 404, 'Not found.');
      const lesson = await lessonsRepo.get(db, schoolId, assignment.lessonId as string);
      if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
      await simulateClass(db, schoolId, assignment, lesson, { enabled: config.researchEnabled, participantType: config.participantType }, async (rowId) => {
        await enqueue({ jobId: rowId, type: 'EXPORT_ROW', targetIds: [rowId] }).catch((error: unknown) => console.error(error));
      });
      await db.doc(`schools/${schoolId}`).update({ simulatedAt: FieldValue.serverTimestamp() });
      return c.json(ok);
    })),
  );

  routes.get('/snapshots', async (c) => {
    const docs = await db.collection('demoSnapshots').get();
    const prefix = `${config.snapshotLocale}_`;
    const snapshots = docs.docs
      .filter((doc) => doc.id.startsWith(prefix))
      .map((doc) => ({ stepId: doc.id.slice(prefix.length), label: doc.data().label as string }));
    return respond(c, DemoSnapshotsDTO, { snapshots });
  });

  routes.post(
    '/snapshots/:stepId/restore',
    withIdempotency(db, limited(deps, 'RESET', async (c) => {
      const id = snapshotId(config.snapshotLocale, c.req.param('stepId') as string);
      if (!(await db.doc(`demoSnapshots/${id}`).get()).exists) throw new AppError('NOT_FOUND', 404, 'Not found.');
      await restoreWorkspace(db, files, workspaceOf(c.var.user), id);
      return c.json(ok);
    })),
  );

  return routes;
}
