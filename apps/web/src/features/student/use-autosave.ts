import type { DraftArtifact } from '@logina/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

const AUTOSAVE_MS = 500;
const RETRY_MS = 5000;
const MAX_RETRIES = 5;

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export interface Autosave {
  state: SaveState;
  /** True when the server holds the answer on the page: nothing changed yet, or the last change is saved. */
  done: boolean;
  retry: () => void;
}

/** A refusal such as "already locked" will not change, so only a network or server fault is tried again. */
const worthRetrying = (error: unknown) => !(error instanceof ApiError) || error.status >= 500;

/** Saves each change after a short pause. The draft the page opened with is already saved. */
export function useAutosave(draft: DraftArtifact, save: (draft: DraftArtifact) => Promise<unknown>): Autosave {
  const [state, setState] = useState<SaveState>('idle');
  const [tries, setTries] = useState(0);
  const opened = useRef(draft);
  const latestSave = useRef(save);
  const now = useRef(false);
  latestSave.current = save;

  useEffect(() => {
    if (draft === opened.current) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    /** A change is unsaved from the moment it is made, not only once the request goes out. */
    setState('saving');

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

    timer = setTimeout(() => attempt(0), now.current ? 0 : AUTOSAVE_MS);
    now.current = false;
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [draft, tries]);

  /** Try again saves at once, without waiting for the pause. */
  const retry = useCallback(() => {
    now.current = true;
    setTries((count) => count + 1);
  }, []);
  return { state, done: state === 'idle' || state === 'saved', retry };
}
