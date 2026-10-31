import type { Phase, Slot } from '@logina/contracts';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PhaseLine } from './PhaseLine';

export function StudentProgress({ slots, phase }: { slots: { slot: Slot; state: 'done' | 'on' | 'todo' }[]; phase?: Phase }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('student.shell.progress')}>
      <ol className="tasks">
        {slots.map(({ slot, state }, index) => (
          <li key={slot} className={state === 'todo' ? undefined : state}>
            <div className="task" {...(state === 'on' ? { 'aria-current': 'step' as const } : {})}>
              <span className="n" aria-hidden="true">{state === 'done' ? <Check className="ico" /> : index + 1}</span>
              {state === 'done' ? <span className="vh">{t('common.done')}</span> : null}
              <span>{t(`student.progress.${slot}`)}</span>
            </div>
            {state === 'on' && phase ? <PhaseLine phase={phase} /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
