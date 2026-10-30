import type { Phase } from '@logina/contracts';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

const STEPS = ['answer', 'lock', 'think', 'final', 'submit'] as const;

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
    <div className="phase">
      {STEPS.map((step, index) => (
        <Fragment key={step}>
          <span className={index < current ? 'done' : index === current ? 'on' : ''} {...(index === current ? { 'aria-current': 'step' as const } : {})}>
            {index < current ? '✓' : index === current ? '●' : '○'} {t(`student.phase.${step}`)}
          </span>
          {index < STEPS.length - 1 ? <span aria-hidden="true">→</span> : null}
        </Fragment>
      ))}
    </div>
  );
}
