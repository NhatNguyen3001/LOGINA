import type { MiddlewareHandler } from 'hono';
import type { AppDeps, AppEnv } from '../context.js';
import { ensureWorkspace } from '../services/workspace.js';
import { AppError } from './errors.js';
import { enforce } from './rate-limit.js';

/** 02-TRD section 4: the API path decides the side, since one session can use both. */
const STUDENT_ROUTES = [/^\/me\/assignments$/, /^\/assignments\/[^/]+\/attempts$/, /^\/attempts\/[^/]+\/tasks(\/|$)/, /^\/attempts\/[^/]+\/feedback$/];
const NEUTRAL_ROUTES = [/^\/me$/, /^\/me\/consent$/, /^\/limits$/];

type Side = 'teacher' | 'student' | 'neutral';

export function sideOf(path: string): Side {
  const route = path.replace(/^\/api\/v1/, '');
  if (NEUTRAL_ROUTES.some((pattern) => pattern.test(route))) return 'neutral';
  if (STUDENT_ROUTES.some((pattern) => pattern.test(route))) return 'student';
  return 'teacher';
}

const rejected = (): AppError => new AppError('UNAUTHENTICATED', 401, 'Sign-in is required.');

export function resolveSession(deps: AppDeps): MiddlewareHandler<AppEnv> {
  const { db, config } = deps;
  return async (c, next) => {
    const { uid, anonymous } = c.var.session;
    if (anonymous !== config.noSignIn) throw rejected();
    if (!config.noSignIn) throw new AppError('NOT_IMPLEMENTED', 401, 'Accounts are not available in this build.');

    const { schoolId, teacherUid, classId } = await ensureWorkspace(db, uid, {
      ...(config.readySnapshot ? { snapshotId: config.readySnapshot } : {}),
      beforeCreate: () => enforce(deps, c, 'SESSION'),
    });
    const side = sideOf(c.req.path);
    if (side === 'teacher') c.set('user', { uid: teacherUid, role: 'teacher', schoolId, classIds: [classId] });
    else c.set('user', { uid, role: side === 'student' ? 'student' : 'demo', schoolId, classIds: [classId] });
    await next();
  };
}
