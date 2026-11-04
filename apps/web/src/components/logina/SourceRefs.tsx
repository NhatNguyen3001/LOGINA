import { useTranslation } from 'react-i18next';
import { sourceRefLabels } from '@/lib/source-refs';

/** Each place in the source as its own tag, after a plain label, so no dots run them together. */
export function SourceRefs({ refs }: { refs: string[] }) {
  const { t } = useTranslation();
  const labels = sourceRefLabels(refs, t);
  if (labels.length === 0) return null;
  return (
    <span className="src-refs">
      <span className="s13 muted">{t('teacher.sourceRef.label')}</span>
      {labels.map((label) => <span key={label} className="src-chip">{label}</span>)}
    </span>
  );
}
