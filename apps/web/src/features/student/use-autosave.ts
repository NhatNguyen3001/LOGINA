import type { DraftArtifact } from '@logina/contracts';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

const AUTOSAVE_MS = 800;
const RETRY_MS = 5000;
const MAX_RETRIES = 5;

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/** A refusal such as "already locked" will not change, so only a network or server fault is tried again. */
const worthRetrying = (error: unknown) => !(error instanceof ApiError) || error.status >= 500;

/** Saves each change after a short pause. The draft the page opened with is already saved. */
export function useAutosave(draft: DraftArtifact, save: (draft: DraftArtifact) => Promise<unknown>): SaveState {
  const [state, setState] = useState<SaveState>('idle');
  const opened = useRef(draft);
  const latestSave = useRef(save);
  latestSave.current = save;

  useEffect(() => {
    if (draft === opened.current) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const attempt = (retries: number) => {
      setState('saving');
      latestSave.current(draft).then(
        () => {
          if (!stopped) setState('saved');
        },
        (error: unknown) => {
          if (stopped) return;
          setState('failed');
          if (worthRetrying(error) && retries < MAX_RETRIES) timer = setTimeout(() => attempt(retries + 1), RETRY_MS);
        },
      );
    };

    timer = setTimeout(() => attempt(0), AUTOSAVE_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [draft]);

  return state;
}
