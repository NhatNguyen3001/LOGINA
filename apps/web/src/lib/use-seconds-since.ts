import { useEffect, useState } from 'react';

/** Counts from a server time, so the number survives a reload. */
export function useSecondsSince(start: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!start) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [start]);
  return start ? Math.max(0, Math.floor((now - Date.parse(start)) / 1000)) : null;
}
