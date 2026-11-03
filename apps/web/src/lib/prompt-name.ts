import type { TFunction } from 'i18next';

/** Rule IDs like TN2 or FB mean nothing to a teacher, so screens show "Prompt 2" or "Neutral prompt" instead. */
export function promptName(label: string, t: TFunction): string {
  const numbered = /^TN(\d+)$/.exec(label);
  if (numbered) return t('teacher.promptN', { n: Number(numbered[1]) });
  if (label === 'FB' || /^fallback$/i.test(label)) return t('teacher.promptFallback');
  return label;
}
