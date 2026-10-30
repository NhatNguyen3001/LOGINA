import { Hono } from 'hono';
import { ClassDTO } from '@logina/contracts';
import { AppError, classesRepo } from '@logina/db';
import type { AppDeps, AppEnv } from '../context.js';
import { respond } from '../middleware/respond.js';

export function classRoutes({ db }: AppDeps): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/:id', async (c) => {
    const klass = await classesRepo.get(db, c.var.user.schoolId, c.req.param('id'));
    if (!klass) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return respond(c, ClassDTO, { id: klass.id, name: klass.name });
  });
}
