import { QueryClient, useQuery } from '@tanstack/react-query';
import type { JobDTO, Slot } from '@logina/contracts';
import { getJob } from './api';

const JOB_POLL_MS = 1500;
const FINISHED: JobDTO['status'][] = ['DONE', 'FAILED', 'TIMED_OUT', 'CANCELLED'];

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

export const qk = {
  me: () => ['me'] as const,
  lessons: () => ['lessons'] as const,
  lesson: (id: string) => ['lesson', id] as const,
  class: (id: string) => ['class', id] as const,
  sourceReview: (id: string) => ['lesson', id, 'source-review'] as const,
  sourceDraft: (id: string) => ['lesson', id, 'source-draft'] as const,
  tasks: (id: string) => ['lesson', id, 'tasks'] as const,
  preview: (id: string, slot: Slot) => ['lesson', id, 'preview', slot] as const,
  logic: (id: string, slot: Slot) => ['lesson', id, 'logic', slot] as const,
  challenges: (id: string, slot: Slot) => ['lesson', id, 'challenges', slot] as const,
  approval: (id: string) => ['lesson', id, 'approval'] as const,
  job: (id: string) => ['job', id] as const,
  myAssignments: () => ['my-assignments'] as const,
  recordedRuns: () => ['recorded-runs'] as const,
  attemptTask: (id: string, slot: Slot) => ['attempt', id, slot] as const,
  challenge: (id: string, slot: Slot) => ['attempt', id, slot, 'challenge'] as const,
  feedback: (id: string) => ['attempt', id, 'feedback'] as const,
  tracking: (id: string) => ['tracking', id] as const,
  trace: (id: string, slot: Slot) => ['trace', id, slot] as const,
  snapshots: () => ['snapshots'] as const,
};

export const jobFinished = (job: JobDTO | undefined): boolean => Boolean(job && FINISHED.includes(job.status));

/** Stops at a final status and pauses on NEEDS_INPUT; the screen invalidates this query after answering. */
export function jobPollInterval(job: JobDTO | undefined): number | false {
  if (!job) return JOB_POLL_MS;
  return FINISHED.includes(job.status) || job.status === 'NEEDS_INPUT' ? false : JOB_POLL_MS;
}

export const useJobPolling = (jobId: string | null | undefined) =>
  useQuery({
    queryKey: qk.job(jobId ?? 'none'),
    queryFn: () => getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => jobPollInterval(query.state.data),
  });
