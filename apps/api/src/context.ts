import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Role } from '@logina/contracts';
import type { Config } from './config.js';

export type EnqueueFn = (job: {
  jobId: string;
  type: string;
  lessonId?: string;
  targetIds: string[];
}) => Promise<void>;

export interface AppDeps {
  db: Firestore;
  auth: Auth;
  enqueue: EnqueueFn;
  config: Config;
}

/** The browser session behind the request, whichever side it is on. */
export interface Session {
  uid: string;
}

/** Who the request acts as. On teacher routes that is the workspace teacher, not the session. */
export interface User {
  uid: string;
  role: Role;
  schoolId: string;
  classIds: string[];
}

export interface AppEnv {
  Variables: { session: Session; user: User };
}
