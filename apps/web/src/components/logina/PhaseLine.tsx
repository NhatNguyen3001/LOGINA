import type { Phase } from '@logina/contracts';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEPS = ['answer', 'lock', 'think', 'final'] as const;

const STEP_OF: Record<Phase, number> = {
  REASON: 0,
  CONFIDENCE_1: 1,
  LOCKED: 2,
  CHALLENGED: 2,
  RECONSIDER: 3,
  CONFIDENCE_2: 3,
  SUBMITTED: 4,
};

export function PhaseLine({ phase }: { phase: Phase }) {
  const { t } = useTranslation();
  const current = STEP_OF[phase];
  return (
    <ol className="phase">
      {STEPS.map((step, index) => (
        <li key={step} className={index < current ? 'done' : index === current ? 'on' : undefined} {...(index === current ? { 'aria-current': 'step' as const } : {})}>
          <span className="dot" aria-hidden="true">{index < current ? <Check className="ico" /> : index + 1}</span>
          {index < current ? <span className="vh">{t('common.done')}</span> : null}
          {t(`student.phase.${step}`)}
        </li>
      ))}
    </ol>
  );
}
