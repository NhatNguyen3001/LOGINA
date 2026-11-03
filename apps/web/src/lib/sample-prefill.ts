import type { LessonDTO } from '@logina/contracts';
import { useQuery } from '@tanstack/react-query';
import { getLesson } from './api';
import { qk } from './query';

type Locale = LessonDTO['contentLocale'];

export interface SamplePrefill {
  lesson: { sourceTitle: string; title: string; subject: string; topic: string; objective: string };
  /** Clarify answers by issue: the same choices as the scripted demo path (tools/seed/demo-path.ts). */
  issues: Record<string, { keepOpen?: { bounds: string; reason: string }; suggestionId?: string }>;
  /** Quick edits by option ID, and prompt rewrites by challenge ID, from the sample's scripted-edits fixture. */
  optionText: Record<string, string>;
  promptText: Record<string, string>;
  acceptReason: string;
  messageToStudents: string;
}

/** What a judge sees already filled in on each step of the sample lesson. Every value can still be changed. */
export const SAMPLE_PREFILL: Record<Locale, SamplePrefill> = {
  en: {
    lesson: {
      sourceTitle: 'Sample material · Labor and Employment',
      title: 'Lesson 8: Labor and employment',
      subject: 'Geography',
      topic: 'Labor and employment',
      objective: 'Students judge whether a statement about the shift in employment structure is fully supported by evidence.',
    },
    issues: {
      iss1: { keepOpen: { bounds: 'Shares only', reason: 'The table gives no totals' } },
      iss2: { suggestionId: 'sug2' },
    },
    optionText: { A4: 'The share of workers in services decreased, giving way to industry and construction.' },
    promptText: { TN2: 'What else would you need to know before saying that agriculture is weaker?' },
    acceptReason: 'Fits this class',
    messageToStudents: 'Work through the five tasks on your own. After each answer you can think again once.',
  },
  vi: {
    lesson: {
      sourceTitle: 'Học liệu mẫu · Lao động và việc làm',
      title: 'Bài 8: Lao động và việc làm',
      subject: 'Địa lí',
      topic: 'Lao động và việc làm',
      objective: 'HS đánh giá một nhận định về chuyển dịch cơ cấu lao động có được căn cứ hỗ trợ đầy đủ không.',
    },
    issues: {
      iss1: { keepOpen: { bounds: 'Chỉ nói về tỉ trọng', reason: 'Bảng không có tổng số' } },
      iss2: { suggestionId: 'sug2' },
    },
    optionText: { A4: 'Tỉ trọng lao động dịch vụ giảm, nhường chỗ cho công nghiệp – xây dựng.' },
    promptText: { TN2: 'Em cần biết thêm điều gì trước khi nói nông nghiệp suy yếu?' },
    acceptReason: 'Phù hợp với lớp này',
    messageToStudents: 'Các em tự làm năm bài. Sau mỗi câu trả lời, em được suy nghĩ lại một lần.',
  },
};

export const samplePrefill = (lesson: Pick<LessonDTO, 'aiMode' | 'contentLocale'> | undefined): SamplePrefill | null =>
  lesson?.aiMode === 'SEEDED' ? SAMPLE_PREFILL[lesson.contentLocale] : null;

/** Shares the lesson query the step screens already make, so it adds no request. */
export function useSamplePrefill(lessonId: string): SamplePrefill | null {
  const lesson = useQuery({ queryKey: qk.lesson(lessonId), queryFn: () => getLesson(lessonId) });
  return samplePrefill(lesson.data);
}
