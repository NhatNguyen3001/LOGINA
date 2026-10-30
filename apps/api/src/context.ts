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

export interface FileStore {
  read: (path: string) => Promise<Buffer>;
  remove: (path: string) => Promise<void>;
  signWriteUrl: (path: string, contentType: string, expires: Date) => Promise<string>;
  signReadUrl: (path: string, expires: Date) => Promise<string>;
}

export interface AppDeps {
  db: Firestore;
  auth: Auth;
  enqueue: EnqueueFn;
  config: Config;
  files: FileStore;
  now: () => Date;
}

/** The browser session behind the request, whichever side it is on. */
export interface Session {
  anonymous: boolean;
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
