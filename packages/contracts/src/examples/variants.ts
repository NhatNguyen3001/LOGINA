import { examples, type Examples } from './en.js';

/** Extra states of a DTO, keyed by `dtoSchemas` name: the live path and a locked task. */
export const exampleVariants = {
  lesson: {
    live: {
      id: 'les_01JLIVE',
      title: 'Population of Vietnam',
      subject: 'Geography',
      topic: 'Population',
      level: 'good',
      stage: 'SOURCE_REVIEW',
      version: 3,
      contentLocale: 'en',
      primaryClassId: 'cls_12A3',
      editorTeacherIds: ['tch_demo'],
      currentTaskDraftIds: {},
      aiMode: 'LIVE',
    },
  },

  job: {
    needsInput: {
      id: 'job_01JLIVE',
      type: 'PARSE',
      status: 'NEEDS_INPUT',
      steps: [{ label: 'Read the file', status: 'RUNNING' }],
      question: { kind: 'LANGUAGE_MISMATCH', detected: 'vi', chosen: 'en' },
    },
    failed: {
      id: 'job_01JLIVE',
      type: 'PARSE',
      status: 'FAILED',
      steps: [{ label: 'Read the file', status: 'FAILED' }],
      errorCode: 'UNSUPPORTED_LANGUAGE',
    },
  },

  sourceReview: {
    readByAI: {
      ...examples.sourceReview,
      sourceModelDraftId: 'smv_01JLIVE',
      readByAI: true,
      summaryClaims: [
        {
          id: 'clm_l1',
          wording: "Vietnam's population in 2021 was about 98.5 million.",
          evidenceSnippet: '…the population of our country reached about 98.5 million…',
          locator: 'p. 2 · para. 1',
          status: 'VERIFIED',
        },
        {
          id: 'clm_l2',
          wording: 'The urban share of the population in 2021 was 37.1%.',
          evidenceSnippet: '…the urban share of the population was 37.1%…',
          locator: 'p. 3 · Table 2',
          status: 'VERIFIED',
        },
      ],
      teacherDecisions: [],
      openGaps: [],
      excluded: [],
      material: {
        materialVersionId: 'mat_01JLIVE',
        fileName: 'dan-so-viet-nam.pdf',
        mimeType: 'application/pdf',
        unitKind: 'PAGE',
        title: 'Population of Vietnam',
        locator: 'pp. 2–3',
        paragraphs: [
          { id: 'p2-1', page: 2, text: 'In 2021 the population of our country reached about 98.5 million.', readBy: 'AI' },
          { id: 'p3-1', page: 3, text: 'In 2021 the urban share of the population was 37.1%.', readBy: 'AI' },
        ],
      },
      issues: [],
    },
  },

  studentTask: {
    locked: {
      ...examples.studentTask,
      phase: 'LOCKED',
      initialArtifact: { slot: 'Q1', answerId: 'opt_2', evidenceId: 'ev_3' },
      initialConfidence: 70,
    },
  },
} satisfies { [K in keyof Examples]?: Record<string, Examples[K]> };
