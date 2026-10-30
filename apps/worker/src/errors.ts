import type { JobErrorCode } from '@logina/contracts';

export class JobFailure extends Error {
  constructor(
    readonly code: JobErrorCode,
    readonly detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}

/** A cancelled job stops at its next step and writes nothing more. */
export class JobCancelled extends Error {}

/** A PARSE waiting for the teacher: not a failure and not terminal. */
export class JobPaused extends Error {}
