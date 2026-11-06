import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const atBottom = (el: HTMLElement): boolean => el.scrollHeight - el.scrollTop - el.clientHeight < 8;

/**
 * The model's thoughts in a fixed-height box, so the page stays short.
 * While a step runs it follows the newest thought; once the teacher scrolls up it stops and offers a jump back.
 */
export function ThoughtsBox({ label, follow, count, children }: { label: string; follow: boolean; count: number; children: ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const seen = useRef(count);
  const [unseen, setUnseen] = useState(0);
  const [fade, setFade] = useState({ top: false, bottom: false });

  const measure = useCallback((): boolean => {
    const el = ref.current;
    if (!el) return true;
    const overflows = el.scrollHeight > el.clientHeight + 1;
    const bottom = atBottom(el);
    setFade({ top: overflows && el.scrollTop > 4, bottom: overflows && !bottom });
    return bottom;
  }, []);

  const onScroll = () => {
    const bottom = measure();
    following.current = bottom;
    if (bottom) setUnseen(0);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    const added = count - seen.current;
    seen.current = count;
    if (!el) return;
    if (follow && following.current) el.scrollTop = el.scrollHeight;
    else if (follow && added > 0) setUnseen((n) => n + added);
    measure();
  }, [count, follow, measure]);

  const jump = () => {
    const el = ref.current;
    if (!el) return;
    following.current = true;
    setUnseen(0);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    el.focus();
  };

  return (
    <div className="thoughts-box">
      <ScrollArea
        viewportRef={ref}
        viewportClassName={cn('thoughts-viewport', fade.top && 'thoughts-fade-t', fade.bottom && 'thoughts-fade-b')}
        viewportProps={{ role: 'region', 'aria-label': label, tabIndex: 0, onScroll }}
      >
        {children}
      </ScrollArea>
      {follow && unseen > 0 ? (
        <button type="button" className="thoughts-jump" onClick={jump}>
          {t('teacher.t02.jumpNew', { count: unseen })}
        </button>
      ) : null}
    </div>
  );
}
