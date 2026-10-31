import type { z } from 'zod';
import type { dtoSchemas } from '../dto/index.js';

type Schemas = typeof dtoSchemas;

/** One valid payload per DTO, keyed like `dtoSchemas`. */
export type Examples = { [K in keyof Schemas]: z.input<Schemas[K]> };

const STEM =
  "Which statement about the shift in Vietnam's employment structure by sector is correct? Choose 1 statement and the 1 evidence card that fits best.";

const ANSWER_A =
  'The share of workers in agriculture, forestry and fisheries fell; the share in industry and construction and in services rose.';
const ANSWER_B = 'The share of workers in agriculture, forestry and fisheries rose.';
const ANSWER_C = 'The share of workers in industry and construction decreased.';
const ANSWER_D = 'The share of workers in services decreased, giving way to industry and construction.';
const ANSWER_A4 = 'By the end of the period, no one works in agriculture, forestry and fisheries anymore.';

const CARD_1 =
  'The source shows that the share of agriculture, forestry and fisheries decreased, while industry and construction and services increased.';
const CARD_2 = 'The source shows that the share of agriculture, forestry and fisheries decreased.';
const CARD_3 = 'The source shows that the share of agriculture, forestry and fisheries increased.';
const CARD_4 = 'Workforce quality improved thanks to education and training.';

const TN1 = {
  label: 'TN1',
  purpose: 'Source direction',
  whenShown: 'When a student picks a statement that runs against the source',
  message:
    'Compare the statement with the figures at the start and end of the period. Does the direction of change match your choice?',
};
const TN2 = {
  label: 'TN2',
  purpose: 'Enough evidence',
  whenShown: 'When a student picks A1 with a card that supports only one part',
  message: 'Statement A1 has two parts. Does the card you chose provide evidence for both?',
};
const TN3 = {
  label: 'TN3',
  purpose: 'Statement and card consistency',
  whenShown: 'When the card points the opposite way from the statement',
  message: 'Do the card you chose and your statement describe the same direction of change?',
};
const TN4 = {
  label: 'TN4',
  purpose: 'Relevance',
  whenShown: "When a card that doesn't explain the shares is picked (E4)",
  message: 'The card you chose is about workforce quality. Does it help explain the change in shares?',
};
const FALLBACK = {
  label: 'Fallback',
  purpose: 'Evidence check, neutral',
  whenShown: 'When none of the prompts above apply',
  message: 'Reread the evidence card you chose. How directly does it support your statement?',
};

const Q1_GATES = [
  {
    gateId: 'QG1',
    status: 'PASS',
    explanationForTeacher: 'The question makes students weigh the evidence, matching the chosen objective.',
  },
  { gateId: 'QG2', status: 'PASS', explanationForTeacher: 'The source is enough to confirm A1 and rule out A2 to A4.' },
  {
    gateId: 'QG3',
    status: 'REVIEW_REQUIRED',
    explanationForTeacher:
      'A4 is easy to rule out because of its extreme wording. Revise the wording or accept it with a reason.',
  },
  {
    gateId: 'QG4',
    status: 'PASS',
    explanationForTeacher: "The four cards play different roles and don't overlap in meaning.",
  },
  {
    gateId: 'QG5',
    status: 'PASS',
    explanationForTeacher: 'No prompt gives away the answer; the fallback prompt is neutral.',
  },
  {
    gateId: 'QG6',
    status: 'PASS',
    explanationForTeacher: 'The question, statements, cards and source all cover the same period.',
  },
] satisfies Examples['teacherTaskPreview']['gates'];

const RELEASE_LABELS = { Q1: 'r4', Q2: 'r2', Q3: 'r2', Q4: 'r4', Q5: 'r3' };

const P8_1 =
  "Vietnam's employment structure by economic sector has shifted in a positive direction. The share of workers in agriculture, forestry and fisheries has fallen; the share in industry and construction and in services has risen (Table 8.1).";
const P8_2 = 'Even so, agriculture, forestry and fisheries still account for a large share of workers.';
const P9_1 = 'Workforce quality keeps improving thanks to achievements in education and training.';
const P8_SHARE = 'The share of workers in agriculture, forestry and fisheries has fallen';

export const examples = {
  lessonList: {
    lessons: [
      {
        id: 'les_01JB8',
        title: 'Labor and Employment, Set 1',
        stage: 'ASSIGNED',
        aiMode: 'SEEDED',
        updatedAt: '2026-11-05T07:40:00.000Z',
        primaryClassName: '12A3',
        latestAssignmentId: 'asg_01JB8',
      },
      {
        id: 'les_01JLIVE',
        title: 'Population of Vietnam',
        stage: 'SOURCE_REVIEW',
        aiMode: 'LIVE',
        updatedAt: '2026-11-05T08:02:00.000Z',
        primaryClassName: '12A3',
      },
    ],
  },

  lesson: {
    id: 'les_01JB8',
    title: 'Labor and Employment, Set 1',
    subject: 'Geography',
    topic: 'Labor and Employment',
    level: 'good',
    stage: 'ASSIGNED',
    version: 12,
    contentLocale: 'en',
    primaryClassId: 'cls_12A3',
    editorTeacherIds: ['tch_demo'],
    currentTaskDraftIds: { Q1: 'tdr_q1v4', Q2: 'tdr_q2v2', Q3: 'tdr_q3v2', Q4: 'tdr_q4v4', Q5: 'tdr_q5v3' },
    latestAssignmentId: 'asg_01JB8',
    aiMode: 'SEEDED',
  },

  class: { id: 'cls_12A3', name: '12A3' },

  job: {
    id: 'job_01JPARSE',
    type: 'ANALYZE',
    status: 'RUNNING',
    steps: [
      { label: 'Read 6 pages and record source locations', status: 'DONE' },
      { label: 'Separate claims and evidence in the source', status: 'DONE' },
      { label: 'Find unclear points, missing information, mismatches or hidden assumptions', status: 'RUNNING' },
      { label: 'Ask you about points that need a decision', status: 'PENDING' },
    ],
  },

  materialRefusal: {
    code: 'TOO_MANY_PAGES',
    detail: { fileName: 'worksheet-scan.pdf', pageCount: 42, limit: 10 },
  },

  uploadUrl: {
    uploadId: 'upl_01JUP',
    url: 'https://storage.googleapis.com/logina-dev-materials/uploads/les_01JLIVE/upl_01JUP?X-Goog-Signature=example',
    expiresAt: '2026-11-05T08:12:00.000Z',
  },

  materialViewUrl: {
    url: 'https://storage.googleapis.com/logina-dev-materials/view/mat_01JB8?X-Goog-Signature=example',
    expiresAt: '2026-11-05T08:12:00.000Z',
  },

  sourceReview: {
    sourceModelDraftId: 'smv_01JDRAFT',
    version: 5,
    approvedSourceVersion: null,
    readByAI: false,
    summaryClaims: [
      {
        id: 'clm_1',
        wording: 'The share of workers in agriculture, forestry and fisheries fell.',
        evidenceSnippet: '…the share of workers in agriculture, forestry and fisheries fell…',
        locator: 'p. 8 · Table 8.1',
        status: 'VERIFIED',
      },
      {
        id: 'clm_2',
        wording: 'The share of workers in industry and construction rose.',
        evidenceSnippet: '…industry and construction and services rose…',
        locator: 'p. 8 · Table 8.1',
        status: 'VERIFIED',
      },
      {
        id: 'clm_3',
        wording: 'The share of workers in services rose.',
        evidenceSnippet: '…industry and construction and services rose…',
        locator: 'p. 8 · Table 8.1',
        status: 'VERIFIED',
      },
      {
        id: 'clm_4',
        wording: 'At the end of the period there were still workers in agriculture, forestry and fisheries.',
        evidenceSnippet: '…still account for a large share.',
        locator: 'p. 8 · para. 2',
        status: 'VERIFIED',
      },
      {
        id: 'clm_5',
        wording: 'Workforce quality has improved (background).',
        evidenceSnippet: '…thanks to achievements in education and training.',
        locator: 'p. 9 · para. 1',
        status: 'VERIFIED',
      },
    ],
    teacherDecisions: [
      {
        issueId: 'iss_2',
        label: 'Goal',
        text: 'Students judge whether a statement about the shift in employment structure is fully supported by evidence.',
        note: 'Chosen from an AI suggestion, based on Table 8.1. This is teaching guidance, not source fact.',
      },
    ],
    openGaps: [
      {
        issueId: 'iss_1',
        reason: 'Whether the number of people in agriculture, forestry and fisheries fell: the source does not say.',
        bounds: 'Not used as a fixed answer. Students may only conclude about shares.',
      },
    ],
    excluded: [
      {
        issueId: 'iss_4',
        text: '2015 figures from a secondary source.',
        reason: 'Different year from Table 8.1. Not used when building the lesson; still kept in the history.',
      },
    ],
    material: {
      materialVersionId: 'mat_01JB8',
      fileName: 'dia-ly-12-bai-8.pdf',
      mimeType: 'application/pdf',
      unitKind: 'PAGE',
      title: 'Labor and Employment sample',
      locator: 'pp. 8–9',
      paragraphs: [
        { id: 'p8-1', page: 8, text: P8_1, readBy: 'SEEDED' },
        { id: 'p8-2', page: 8, text: P8_2, readBy: 'SEEDED' },
        { id: 'p9-1', page: 9, text: P9_1, readBy: 'SEEDED' },
      ],
    },
    issues: [
      {
        id: 'iss_1',
        pointNumber: 1,
        issueType: 'MISSING',
        severity: 'BLOCKER',
        bubble:
          "The material says the share in agriculture, forestry and fisheries fell, but gives no total workforce, so we can't tell whether the number of people fell. Do you want to keep this as a point students must weigh, or add a source?",
        currentInterpretation: 'Conclude only about shares, not about the number of people.',
        suggestions: [],
        state: 'KEEP_OPEN',
        spans: [
          {
            paragraphId: 'p8-1',
            start: P8_1.indexOf(P8_SHARE),
            end: P8_1.indexOf(P8_SHARE) + P8_SHARE.length,
          },
        ],
        resolution: {
          action: 'KEEP_OPEN',
          text: 'Not used as a fixed answer. Students may only conclude about shares.',
          savedAs: 'TASK_ASSUMPTION',
        },
        resolvedBy: 'Ms. Lan',
        resolvedAt: '2026-11-05T03:14:00.000Z',
      },
      {
        id: 'iss_2',
        pointNumber: 2,
        issueType: 'AMBIGUOUS',
        severity: 'BLOCKER',
        bubble:
          'For this part, do you want students to recognize the shift, or to test a conclusion that goes beyond the data?',
        currentInterpretation: 'Recognize the shift.',
        suggestions: [
          {
            id: 'sug_1',
            text: 'Recognize the trend and choose evidence that covers both parts',
            sourceRef: 'Table 8.1 shows both the decrease and the increase',
          },
          {
            id: 'sug_2',
            text: 'Test a conclusion that goes beyond the data (share is not headcount)',
            sourceRef: 'The source has no total workforce figure',
          },
        ],
        state: 'SUGGESTION_ACCEPTED',
        spans: [],
        resolution: {
          action: 'USE_SUGGESTION',
          text: 'Recognize the trend and choose evidence that covers both parts',
          savedAs: 'TEACHER_INTERPRETATION',
        },
        resolvedBy: 'Ms. Lan',
        resolvedAt: '2026-11-05T03:15:00.000Z',
      },
      {
        id: 'iss_3',
        pointNumber: 3,
        issueType: 'AMBIGUOUS',
        severity: 'REVIEW',
        bubble:
          'Can “Workforce quality is improving” be used as evidence for the sector structure, or is it only background information?',
        currentInterpretation: 'Background information; it does not explain the share structure.',
        suggestions: [],
        state: 'CONFIRMED',
        spans: [{ paragraphId: 'p9-1', start: 0, end: P9_1.length }],
        resolution: { action: 'CONFIRM', savedAs: null },
        resolvedBy: 'Ms. Lan',
        resolvedAt: '2026-11-05T03:16:00.000Z',
      },
      {
        id: 'iss_4',
        pointNumber: 4,
        issueType: 'CONFLICT',
        severity: 'REVIEW',
        bubble: 'The 2015 figures in the secondary source are from a different year than Table 8.1.',
        currentInterpretation: 'Use Table 8.1 only.',
        suggestions: [],
        state: 'EXCLUDED',
        spans: [],
        resolution: { action: 'EXCLUDE', text: 'Different year from the main source.', savedAs: null },
        resolvedBy: 'Ms. Lan',
        resolvedAt: '2026-11-05T03:12:00.000Z',
      },
    ],
    approveReady: true,
    blockersRemaining: 0,
  },

  sourceDraft: {
    sourceModelDraftId: 'smv_01JV2',
    version: 7,
    editedClaims: [
      {
        claimId: 'clm_1',
        before: 'The share of workers in agriculture, forestry and fisheries fell.',
        after: 'The share of workers in agriculture, forestry and fisheries decreased over 2010–2021.',
        evidence: '“…2010–2021 period…” · Table 8.1 title',
      },
    ],
    impact: [
      { slot: 'Q1', usesClaim: true, refs: ['A1', 'E1', 'E2', 'E3'] },
      { slot: 'Q2', usesClaim: true, refs: ['“Industrialization” card'] },
      { slot: 'Q3', usesClaim: false, refs: [] },
      { slot: 'Q4', usesClaim: false, refs: [] },
      { slot: 'Q5', usesClaim: false, refs: [] },
    ],
    unaffectedSlots: ['Q3', 'Q4', 'Q5'],
    assignedReleasesUnchanged: [{ classLabel: '12B1', releaseLabel: 'r3' }],
    approveReady: true,
  },

  sourceApprovalResult: { sourceModelVersionId: 'smv_01JV1', version: 1, jobId: 'job_01JGEN' },

  teacherTaskPreview: {
    draftId: 'tdr_q1v3',
    draftVersion: 3,
    status: 'REVIEW_REQUIRED',
    questionStem: STEM,
    answers: [
      {
        id: 'A1',
        text: ANSWER_A,
        teacherLabel: 'Correct · source supports both parts',
        sourceAnchor: 'Table 8.1',
      },
      { id: 'A2', text: ANSWER_B, teacherLabel: 'Wrong option · source refutes it', sourceAnchor: 'Table 8.1' },
      { id: 'A3', text: ANSWER_C, teacherLabel: 'Wrong option · source refutes it', sourceAnchor: 'Table 8.1' },
      {
        id: 'A4',
        text: ANSWER_A4,
        teacherLabel: 'Wrong option · source refutes it',
        sourceAnchor: 'p. 8 · para. 2',
        inlineFinding: {
          gateId: 'QG3',
          findingCode: 'DISTRACTOR_IMPLAUSIBLE',
          explanationForTeacher:
            'Students can rule out this option just from its extreme wording (“no one... anymore”) without checking the source.',
          overridable: true,
        },
      },
    ],
    evidence: [
      {
        id: 'E1',
        text: CARD_1,
        teacherLabel: 'Full',
        relationNote: 'covers both parts of A1',
        sourceAnchor: 'Table 8.1',
      },
      {
        id: 'E2',
        text: CARD_2,
        teacherLabel: 'Partial',
        relationNote: 'true, but missing the “increased” part',
        sourceAnchor: 'Table 8.1',
      },
      {
        id: 'E3',
        text: CARD_3,
        teacherLabel: 'Factually false',
        relationNote: 'contradicted by the source',
        sourceAnchor: 'Table 8.1',
      },
      {
        id: 'E4',
        text: CARD_4,
        teacherLabel: 'Irrelevant',
        relationNote: "true, but doesn't explain the shares",
        sourceAnchor: 'p. 9',
      },
    ],
    exampleChallenges: [TN1, TN2],
    gates: Q1_GATES,
    structureChecks: [
      { label: '4 statements, 4 cards of the right types', status: 'PASS' },
      { label: '16/16 statement × card pairs evaluated', status: 'PASS' },
      { label: 'Every choice gets exactly 1 Think-again prompt', status: 'PASS' },
      { label: 'All content has a source location', status: 'PASS' },
    ],
    blockers: 0,
    previewHash: 'c41e9a07c41e9a07c41e9a07c41e9a07',
    candidateSetVersion: 3,
    canApprove: false,
  },

  teacherTaskSummary: {
    draftId: 'tdr_q2v2',
    draftVersion: 2,
    slot: 'Q2',
    taskType: 'EVIDENCE_RANKING',
    status: 'MACHINE_PASS',
    questionStem: 'Rank these factors by how strongly they influence the shift in employment.',
    taskBody: {
      cards: [
        { cardId: 'card_1', text: 'Industrialization and modernization create more jobs in industry and services.' },
        { cardId: 'card_2', text: 'Urbanization draws workers from rural areas to cities and industrial zones.' },
        { cardId: 'card_3', text: 'International economic integration and foreign investment open new jobs.' },
        { cardId: 'card_4', text: 'Workforce quality improves thanks to education and training.' },
      ],
      basis: 'Rank by how directly each factor changes the share of workers by sector.',
      teacherLabels: { card_1: 'Strongest', card_4: 'Weakest' },
    },
    gates: [
      { gateId: 'QG1', status: 'PASS', explanationForTeacher: 'The ranking makes students weigh the factors.' },
      { gateId: 'QG5', status: 'PASS', explanationForTeacher: 'No prompt gives away the expected order.' },
    ],
    exampleChallenges: [
      {
        label: 'TN1',
        purpose: 'Check the criterion',
        whenShown: 'When a student puts a background factor first',
        message: 'Look at the criterion again. Does your first card change the share of workers directly?',
      },
    ],
    blockers: 0,
    canApprove: true,
  },

  teacherLogicReview: {
    pairs: [
      ['A1', 'E1', 'Fully supports', 'Covers both parts.', 'Fallback prompt'],
      ['A1', 'E2', 'Partly supports', 'Missing the “increased” part.', 'TN2'],
      ['A1', 'E3', 'Contradicts', 'The card points the opposite way from the statement.', 'TN3'],
      ['A1', 'E4', 'Irrelevant', "Doesn't address the shares.", 'TN4'],
      ['A2', 'E1', 'Rules out A2', 'The card shows the share decreased.', 'TN1'],
      ['A2', 'E2', 'Rules out A2', 'The card shows the share decreased.', 'TN1'],
      ['A2', 'E3', 'Agree, but the source rules out both', 'They match each other but contradict Table 8.1.', 'TN1'],
      ['A2', 'E4', 'Irrelevant', "Doesn't address the shares.", 'TN1'],
      ['A3', 'E1', 'Rules out A3', 'The card shows industry and construction increased.', 'TN1'],
      ['A3', 'E2', 'Not enough', "Doesn't address industry and construction.", 'TN1'],
      ['A3', 'E3', 'Card is factually false', "The card contradicts the source and doesn't support A3.", 'TN1'],
      ['A3', 'E4', 'Irrelevant', "Doesn't address the shares.", 'TN1'],
      ['A4', 'E1', 'Not enough', "A falling share doesn't tell whether anyone still works in the sector.", 'Fallback prompt'],
      ['A4', 'E2', 'Not enough', 'Same as E1.', 'Fallback prompt'],
      ['A4', 'E3', 'Card is factually false', 'The card contradicts the source.', 'TN3'],
      ['A4', 'E4', 'Irrelevant', "Doesn't address the shares.", 'TN4'],
    ].map(([answerId, evidenceId, relationLabel, explanation, goesTo]) => ({
      answerId: answerId!,
      evidenceId: evidenceId!,
      relationLabel: relationLabel!,
      explanation: explanation!,
      goesTo: goesTo!,
    })),
    challenges: [
      { ...TN1, isFallback: false },
      { ...TN2, isFallback: false },
      { ...TN3, isFallback: false },
      { ...TN4, isFallback: false },
      { ...FALLBACK, isFallback: true },
    ],
    boundedEditActions: [
      {
        challengeId: 'TN2',
        label: 'Focus of TN2',
        focusOptions: ['Sufficient evidence for every part of the statement'],
      },
    ],
    warnings: [],
  },

  tasksOverview: {
    slots: [
      {
        slot: 'Q1',
        taskType: 'JUDGMENT_EVIDENCE',
        sufficiency: 'SUFFICIENT',
        sufficiencyNote: '1 correct statement, ruling out 3 false ones, 4 evidence cards',
        sourceRefs: ['Table 8.1', 'p. 8 para. 2', 'p. 9'],
        draftStatus: 'REVIEW_REQUIRED',
        draftId: 'tdr_q1v3',
      },
      {
        slot: 'Q2',
        taskType: 'EVIDENCE_RANKING',
        sufficiency: 'SUFFICIENT',
        sufficiencyNote: 'Order of influence of 4 factors on the employment shift',
        sourceRefs: ['p. 8 · Section 2'],
        draftStatus: 'GENERATING',
      },
      {
        slot: 'Q3',
        taskType: 'COMPARE_TRADEOFF',
        sufficiency: 'SUFFICIENT',
        sufficiencyNote: 'Drawbacks of 2 employment options for rural workers',
        sourceRefs: ['p. 9 · paras. 2–3'],
        draftStatus: null,
      },
      {
        slot: 'Q4',
        taskType: 'COUNTERARGUMENT',
        sufficiency: 'UNCERTAIN',
        sufficiencyNote:
          'Lesson 8 has no data on agricultural labor productivity, and the rebuttal needs this evidence.',
        sourceRefs: [],
        draftStatus: null,
      },
      {
        slot: 'Q5',
        taskType: 'OPEN_PROPOSAL',
        sufficiency: 'SUFFICIENT',
        sufficiencyNote: 'Employment context for rural youth',
        sourceRefs: ['pp. 8–9'],
        draftStatus: null,
      },
    ],
  },

  challengeList: {
    slot: 'Q1',
    draftVersion: 3,
    candidateSetVersion: 3,
    challenges: [
      { ...TN1, challengeId: 'TN1', isFallback: false, sourceAnchor: 'Table 8.1' },
      { ...TN2, challengeId: 'TN2', isFallback: false, sourceAnchor: 'Table 8.1' },
      { ...TN3, challengeId: 'TN3', isFallback: false, sourceAnchor: 'Table 8.1' },
      { ...TN4, challengeId: 'TN4', isFallback: false, sourceAnchor: 'p. 9' },
      { ...FALLBACK, challengeId: 'FB', isFallback: true, sourceAnchor: 'Table 8.1' },
    ],
  },

  tryCase: {
    answerId: 'A2',
    evidenceId: 'E3',
    wouldReceive: { label: 'TN1', purpose: 'Source direction', message: TN1.message },
  },

  editResult: {
    editId: 'edt_01JA4',
    newDraftIds: ['tdr_q1v4'],
    staleDraftIds: ['tdr_q1v3'],
    jobId: 'job_01JRERUN',
  },

  taskApproval: {
    tasks: [
      {
        slot: 'Q1',
        status: 'REVIEW_REQUIRED',
        gatesSummary: {
          aggregate: 'REVIEW_REQUIRED',
          gates: [
            {
              gateId: 'QG1',
              status: 'REVIEW_REQUIRED',
              explanationForTeacher:
                'The question may be answerable just by spotting the trend, so it may not make students weigh whether the evidence is sufficient.',
            },
          ],
        },
        draftVersion: 4,
        previewHash: 'c41e9a07c41e9a07c41e9a07c41e9a07',
        candidateSetVersion: 4,
        missingAltTextRefs: [],
        changesSinceLastPreview: [
          'A4 reworded: “The share of workers in services falls, giving way to industry and construction.”',
          'Rechecked 4 pairs A4 × E1 to E4, TN3, TN4 and the fallback prompt',
          'New decision: QG1 warning accepted with a reason',
        ],
        decisionsNeeded: [],
        acceptedWarning: true,
      },
      {
        slot: 'Q2',
        status: 'APPROVED',
        gatesSummary: { aggregate: 'MACHINE_PASS', gates: [] },
        draftVersion: 2,
        previewHash: 'a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4',
        candidateSetVersion: 2,
        missingAltTextRefs: [],
        changesSinceLastPreview: [],
        decisionsNeeded: [],
        approvedAt: '2026-11-05T07:31:00.000Z',
        releaseLabel: 'r2',
        acceptedWarning: false,
      },
      {
        slot: 'Q3',
        status: 'APPROVED',
        gatesSummary: { aggregate: 'MACHINE_PASS', gates: [] },
        draftVersion: 2,
        previewHash: 'b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5',
        candidateSetVersion: 2,
        missingAltTextRefs: [],
        changesSinceLastPreview: [],
        decisionsNeeded: [],
        approvedAt: '2026-11-05T07:32:00.000Z',
        releaseLabel: 'r2',
        acceptedWarning: false,
      },
      {
        slot: 'Q4',
        status: 'BLOCKED',
        gatesSummary: {
          aggregate: 'BLOCKED',
          gates: [
            {
              gateId: 'QG5',
              status: 'BLOCKER',
              explanationForTeacher:
                'TN2 gives away the expected idea (“labor productivity rises”). This blocker cannot be skipped.',
            },
          ],
        },
        draftVersion: 3,
        previewHash: 'c3d4e5f6c3d4e5f6c3d4e5f6c3d4e5f6',
        candidateSetVersion: 3,
        missingAltTextRefs: [],
        changesSinceLastPreview: [],
        decisionsNeeded: [
          {
            gateId: 'QG5',
            findingCode: 'ANSWER_LEAKAGE',
            explanationForTeacher:
              'TN2 gives away the expected idea (“labor productivity rises”). This blocker cannot be skipped.',
            overridable: false,
          },
        ],
        acceptedWarning: false,
      },
      {
        slot: 'Q5',
        status: 'VALIDATING',
        gatesSummary: { aggregate: null, gates: [] },
        draftVersion: 3,
        previewHash: 'd4e5f6a7d4e5f6a7d4e5f6a7d4e5f6a7',
        candidateSetVersion: 3,
        missingAltTextRefs: [],
        changesSinceLastPreview: ['You edited the fallback prompt at 14:40.'],
        decisionsNeeded: [],
        acceptedWarning: false,
      },
    ],
    contentManifestHash: 'c41e9a07c41e9a07c41e9a07c41e9a07',
    canApprove: true,
  },

  approveResult: { taskReleaseId: 'rel_q1r4', releaseLabel: 'r4' },

  assignResult: { assignmentId: 'asg_01JB8', revision: 1, releaseLabels: RELEASE_LABELS },

  classTracking: {
    assignmentId: 'asg_01JB8',
    revision: 1,
    releaseLabels: RELEASE_LABELS,
    counts: { started: 8, complete: 8 },
    participants: [
      {
        attemptId: 'att_01JP7K2M',
        participantCode: 'P-7K2M',
        isSimulated: false,
        status: 'COMPLETE',
        submittedCount: 5,
        keepCount: 4,
        reviseCount: 1,
        confidenceBefore: 68,
        confidenceAfter: 76,
      },
      {
        attemptId: 'att_01JSIM1',
        participantCode: 'P-SIM1',
        isSimulated: true,
        status: 'COMPLETE',
        submittedCount: 5,
        keepCount: 4,
        reviseCount: 1,
        confidenceBefore: 72,
        confidenceAfter: 74,
      },
      {
        attemptId: 'att_01JNORES',
        isSimulated: false,
        status: 'COMPLETE',
        submittedCount: 5,
        keepCount: 4,
        reviseCount: 1,
        confidenceBefore: 65,
        confidenceAfter: 70,
      },
    ],
    perTask: [
      {
        slot: 'Q1',
        submitted: 8,
        keep: 4,
        revise: 4,
        avgConfidenceBefore: 68,
        avgConfidenceAfter: 76,
        deliveredChallenges: [
          { label: 'TN1', count: 3 },
          { label: 'TN2', count: 2 },
          { label: 'TN4', count: 1 },
          { label: 'Fallback', count: 2 },
        ],
      },
      {
        slot: 'Q2',
        submitted: 8,
        keep: 7,
        revise: 1,
        avgConfidenceBefore: 70,
        avgConfidenceAfter: 73,
        deliveredChallenges: [
          { label: 'TN1', count: 3 },
          { label: 'Fallback', count: 5 },
        ],
      },
      {
        slot: 'Q3',
        submitted: 8,
        keep: 6,
        revise: 2,
        avgConfidenceBefore: 62,
        avgConfidenceAfter: 66,
        deliveredChallenges: [
          { label: 'TN2', count: 4 },
          { label: 'Fallback', count: 4 },
        ],
      },
      {
        slot: 'Q4',
        submitted: 8,
        keep: 7,
        revise: 1,
        avgConfidenceBefore: 66,
        avgConfidenceAfter: 67,
        deliveredChallenges: [
          { label: 'TN1', count: 3 },
          { label: 'TN3', count: 1 },
          { label: 'Fallback', count: 4 },
        ],
      },
      {
        slot: 'Q5',
        submitted: 8,
        keep: 7,
        revise: 1,
        avgConfidenceBefore: 64,
        avgConfidenceAfter: 65,
        deliveredChallenges: [
          { label: 'TN1', count: 2 },
          { label: 'Fallback', count: 6 },
        ],
      },
    ],
    q1Relations: {
      releaseLabel: 'r4',
      denominator: 8,
      before: { full: 2, partial: 2, contradicts: 3, irrelevant: 1 },
      after: { full: 5, partial: 1, contradicts: 2, irrelevant: 0 },
    },
  },

  trace: {
    participantCode: 'P-7K2M',
    isSimulated: false,
    completedAt: '2026-11-06T03:42:00.000Z',
    releaseLabel: 'r4',
    slotChips: [
      { slot: 'Q1', choice: 'REVISE' },
      { slot: 'Q2', choice: 'KEEP' },
      { slot: 'Q3', choice: 'KEEP' },
      { slot: 'Q4', choice: 'KEEP' },
      { slot: 'Q5', choice: 'KEEP' },
    ],
    slot: 'Q1',
    questionStem: STEM,
    before: {
      answer: {
        letter: 'B',
        authoringLabel: 'A2',
        text: 'The share of workers in agriculture, forestry and fisheries rises.',
      },
      evidence: {
        letter: 'Card C',
        authoringLabel: 'E3',
        text: 'The source says the share of agriculture, forestry and fisheries rises.',
      },
      confidence: 70,
      lockedAt: '2026-11-06T03:31:00.000Z',
      relationLabel: 'Agree, but the source rules out both',
    },
    challenge: {
      label: 'TN1',
      message: TN1.message,
      whySelected: 'The statement runs opposite to the source.',
      studentChoice: 'REVISE',
    },
    after: {
      answer: {
        letter: 'A',
        authoringLabel: 'A1',
        text: 'The share of agriculture, forestry and fisheries falls; industry and construction and services rise.',
        changed: true,
      },
      evidence: {
        letter: 'Card A',
        authoringLabel: 'E1',
        text: 'The source says the share of agriculture, forestry and fisheries falls, while industry and construction and services rise.',
        changed: true,
      },
      confidenceBefore: 70,
      confidenceAfter: 82,
      submittedAt: '2026-11-06T03:34:00.000Z',
      relationLabel: 'Fully supports',
    },
  },

  recordedRuns: {
    runs: [{ attemptId: 'att_01JB8_run1', lessonTitle: 'Lesson 8: Labor and employment', run: 1, completedAt: '2026-11-02T07:03:10.000Z' }],
  },
  assignmentList: {
    assignments: [
      {
        assignmentId: 'asg_01JB8',
        lessonTitle: 'Labor and Employment',
        teacherName: 'Ms. Lan',
        dueAt: '2026-11-12T14:00:00.000Z',
        messageToStudents:
          "Work through Q1 to Q5 in order. Keeping or revising is fine, as long as you've read the evidence carefully.",
        attemptId: 'att_01JP7K2M',
        status: 'IN_PROGRESS',
      },
    ],
  },

  attempt: {
    attemptId: 'att_01JP7K2M',
    status: 'IN_PROGRESS',
    slots: [
      { slot: 'Q1', phase: 'REASON' },
      { slot: 'Q2', phase: 'REASON' },
      { slot: 'Q3', phase: 'REASON' },
      { slot: 'Q4', phase: 'REASON' },
      { slot: 'Q5', phase: 'REASON' },
    ],
  },

  studentTask: {
    slot: 'Q1',
    phase: 'REASON',
    stem: STEM,
    answers: [
      { id: 'opt_1', text: ANSWER_A },
      { id: 'opt_2', text: ANSWER_B },
      { id: 'opt_3', text: ANSWER_C },
      { id: 'opt_4', text: ANSWER_D },
    ],
    evidence: [
      { id: 'ev_1', text: CARD_1 },
      { id: 'ev_2', text: CARD_2 },
      { id: 'ev_3', text: CARD_3 },
      { id: 'ev_4', text: CARD_4 },
    ],
    draftArtifact: { slot: 'Q1', answerId: 'opt_2', evidenceId: 'ev_3' },
  },

  studentChallenge: {
    deliveryId: 'dlv_01JQ1',
    message: TN1.message,
    lockedSummary: { answerText: `B. ${ANSWER_B}`, evidenceText: `Card C. ${CARD_3}`, confidence: 70 },
  },

  submitResult: { slot: 'Q1', recordedChoice: 'REVISE', nextSlot: 'Q2', attemptStatus: 'IN_PROGRESS' },

  studentFeedback: {
    slot: 'Q1',
    choice: 'REVISE',
    initial: {
      label: 'B · Card C',
      text: 'Share of agriculture, forestry and fisheries rises · card says the share rises',
    },
    challengeMessage: 'Compare the figures at the start and end of the period.',
    final: {
      label: 'A · Card A',
      text: 'Agriculture, forestry and fisheries fall; industry and construction and services rise · card covers both directions',
    },
    confidenceBefore: 70,
    confidenceAfter: 82,
    explanations: [
      {
        optionId: 'ev_2',
        relationLabel: 'Partly supports',
        text: 'True, but it only covers the “falls” part, which is not enough for all of statement A.',
      },
      { optionId: 'ev_3', relationLabel: 'Contradicts', text: 'Contradicts Table 8.1.' },
      {
        optionId: 'ev_4',
        relationLabel: 'Irrelevant',
        text: 'True according to the source, but it is about workforce quality and does not explain the shares.',
      },
    ],
  },

  me: {
    uid: 'anon_01JSESSION',
    role: 'demo',
    displayName: 'Ms. Lan',
    schoolId: 'wks_anon_01JSESSION',
    classIds: ['cls_12A3'],
    uiLocale: 'en',
    demoMenu: true,
    consentRequired: false,
    currentConsentVersion: '2026-10-v1',
    participantCode: 'P-7K2M',
  },

  consentResult: { consent: 'AGREED', participantCode: 'P-7K2M' },

  limits: {
    limits: [
      { action: 'UPLOAD', limit: 5, remaining: 1, resetsAt: '2026-11-05T08:40:00.000Z' },
      { action: 'AI_ACTION', limit: 50, remaining: 38, resetsAt: '2026-11-05T08:40:00.000Z' },
      { action: 'SIMULATE_CLASS', limit: 10, remaining: 2, resetsAt: '2026-11-05T08:40:00.000Z' },
      { action: 'RESET', limit: 1, remaining: 1, resetsAt: '2026-11-05T08:40:00.000Z' },
    ],
  },

  rateLimit: {
    code: 'RATE_LIMITED',
    action: 'AI_ACTION',
    retryAfterSeconds: 720,
    resetsAt: '2026-11-05T08:40:00.000Z',
  },

  error: {
    code: 'MISSING_ALT_TEXT',
    message: 'A figure in this task has no alt text.',
    affectedRefs: ['unt_figure_1'],
  },

  demoSnapshots: {
    snapshots: [
      { stepId: 't07', label: 'T7 · Matching Preview' },
      { stepId: 's01', label: 'S1 · Student starts' },
      { stepId: 't14', label: 'T14 · After the class has worked' },
    ],
  },
} satisfies Examples;
