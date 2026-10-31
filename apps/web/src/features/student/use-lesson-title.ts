import { useQuery } from '@tanstack/react-query';
import { getMyAssignments } from '@/lib/api';
import { qk } from '@/lib/query';

export function useLessonTitle(attemptId: string): string | undefined {
  const assignments = useQuery({ queryKey: qk.myAssignments(), queryFn: getMyAssignments });
  return assignments.data?.assignments.find((item) => item.attemptId === attemptId)?.lessonTitle;
}
