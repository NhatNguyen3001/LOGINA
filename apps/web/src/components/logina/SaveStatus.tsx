import { useTranslation } from 'react-i18next';
import type { SaveState } from '@/features/student/use-autosave';

const KEYS: Record<SaveState, string | null> = { idle: null, saving: 'student.save.saving', saved: 'common.saved', failed: 'student.save.failed' };

/** The region stays on the page, so a screen reader hears each change. */
export function SaveStatus({ state }: { state: SaveState }) {
  const { t } = useTranslation();
  const key = KEYS[state];
  return <span role="status" className="s13 muted">{key ? t(key) : null}</span>;
}
