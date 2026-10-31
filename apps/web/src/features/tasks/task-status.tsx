import type { TaskStatus } from '@logina/contracts';
import { useTranslation } from 'react-i18next';
import { StatusTag, type TagKind } from '@/components/logina/StatusTag';

const KIND: Record<TaskStatus, TagKind> = {
  GENERATING: 'stale',
  VALIDATING: 'stale',
  STALE: 'stale',
  BLOCKED: 'block',
  REVIEW_REQUIRED: 'review',
  MACHINE_PASS: 'pass',
  APPROVED: 'teacher',
  FAILED: 'block',
  SUPERSEDED: 'neutral',
};

export function TaskStatusTag({ status }: { status: TaskStatus | null }) {
  const { t } = useTranslation();
  return <StatusTag kind={status ? KIND[status] : 'neutral'}>{t(`teacher.status.${status ?? 'NONE'}`)}</StatusTag>;
}
