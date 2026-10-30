import type { Slot } from '@logina/contracts';
import { useTranslation } from 'react-i18next';

export function StudentProgress({ slots }: { slots: { slot: Slot; state: 'done' | 'on' | 'todo' }[] }) {
  const { t } = useTranslation();
  return (
    <div className="prog">
      {slots.map(({ slot, state }) => (
        <div key={slot} className={state === 'todo' ? '' : state} {...(state === 'on' ? { 'aria-current': 'step' as const } : {})}>
          {t(`student.progress.${slot}`)}
        </div>
      ))}
    </div>
  );
}
