import type { LessonDTO } from '@logina/contracts';

type StageInfo = Pick<LessonDTO, 'id' | 'stage'> & { latestAssignmentId?: string | undefined; activeJobId?: string | undefined };

export function stagePath({ id, stage, latestAssignmentId, activeJobId }: StageInfo): string {
  const base = `/t/lessons/${id}`;
  if (stage === 'CREATE' || (stage === 'CLARIFY' && activeJobId)) return `${base}/analyze`;
  if (stage === 'CLARIFY') return `${base}/clarify`;
  if (stage === 'SOURCE_REVIEW') return `${base}/source`;
  if (stage === 'GENERATE_PREVIEW') return `${base}/tasks`;
  if (stage === 'ASSIGNED' && latestAssignmentId) return `/t/assignments/${latestAssignmentId}`;
  return `${base}/approve`;
}
