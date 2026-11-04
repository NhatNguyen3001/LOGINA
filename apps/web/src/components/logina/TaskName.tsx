import type { Slot } from '@logina/contracts';
import { useTranslation } from 'react-i18next';

/** The task number as a small tag beside the name, so no dot floats between them. */
export function TaskName({ slot }: { slot: Slot }) {
  const { t } = useTranslation();
  return (
    <span className="task-name">
      <span className="q-num">{slot}</span>
      <span>{t(`teacher.taskType.${slot}`)}</span>
    </span>
  );
}
