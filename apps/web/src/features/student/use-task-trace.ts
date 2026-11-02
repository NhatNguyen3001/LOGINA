const MAX_CHANGES = 200;

interface Saved {
  startedAt: number;
  changes: { at: number; change: string }[];
}

export interface TaskTrace {
  start: () => void;
  record: (change: string) => void;
  seconds: () => number;
  changes: () => Saved['changes'];
  clearChanges: () => void;
  finish: () => void;
}

/** Lives in the tab, so a reload keeps the start time and earlier changes. Blocked storage only loses that. */
export function createTrace(attemptId: string, slot: string): TaskTrace {
  const key = `logina.trace.${attemptId}.${slot}`;
  const load = (): Saved | null => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? 'null') as Saved | null;
    } catch {
      return null;
    }
  };
  let saved = load();
  const store = () => {
    try {
      sessionStorage.setItem(key, JSON.stringify(saved));
    } catch {
      // Nothing to do: the trace still works until a reload.
    }
  };
  const seconds = () => (saved ? Math.max(0, Math.round((Date.now() - saved.startedAt) / 1000)) : 0);

  return {
    start: () => {
      saved ??= { startedAt: Date.now(), changes: [] };
      store();
    },
    record: (change) => {
      if (!saved) return;
      const last = saved.changes[saved.changes.length - 1];
      /** Typing in one sentence is one change, timed at its latest keystroke. */
      if (last?.change === change) last.at = seconds();
      else saved.changes = [...saved.changes, { at: seconds(), change }].slice(-MAX_CHANGES);
      store();
    },
    seconds,
    changes: () => saved?.changes ?? [],
    clearChanges: () => {
      if (saved) saved.changes = [];
      store();
    },
    finish: () => {
      saved = null;
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Nothing to do: the entry goes when the tab closes.
      }
    },
  };
}
