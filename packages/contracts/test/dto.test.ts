import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exampleVariants, examples, examplesVi } from '../src/examples/index.js';
import * as contracts from '../src/index.js';
import {
  ApproveReq,
  AssignReq,
  DispositionReq,
  EditReq,
  JobAnswerReq,
  JobDTO,
  JobStatus,
  LessonDTO,
  LockReq,
  MaterialRefusalDTO,
  MaterialViewUrlDTO,
  Q2Artifact,
  Q5Artifact,
  RegisterMaterialReq,
  ResolveIssueReq,
  SourceReviewDTO,
  StudentChallengeDTO,
  StudentTaskDTO,
  TeacherTaskSummaryDTO,
  UploadUrlReq,
  dtoSchemas,
} from '../src/index.js';

const without = (value: object, key: string) => Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
const lockBody = { artifact: { slot: 'Q1', answerId: 'opt_1', evidenceId: 'ev_1' } };
const firstParagraph = examples.sourceReview.material.paragraphs[0]!;
const withParagraph = (paragraph: object) => ({
  ...examples.sourceReview,
  material: { ...examples.sourceReview.material, paragraphs: [paragraph] },
});

describe('examples', () => {
  it('every example parses with its DTO schema', () => {
    for (const [name, payload] of [...Object.entries(examples), ...Object.entries(examplesVi)]) {
      expect(() => dtoSchemas[name as keyof typeof dtoSchemas].parse(payload), name).not.toThrow();
    }
  });

  it('every variant parses with its DTO schema', () => {
    for (const [name, variants] of Object.entries(exampleVariants)) {
      for (const [variant, payload] of Object.entries(variants)) {
        expect(() => dtoSchemas[name as keyof typeof dtoSchemas].parse(payload), `${name}.${variant}`).not.toThrow();
      }
    }
  });

  it('every DTO schema has an English example', () => {
    expect(Object.keys(dtoSchemas).sort()).toEqual(Object.keys(examples).sort());
  });

  it('covers the text-heavy DTOs in Vietnamese', () => {
    expect(Object.keys(examplesVi).sort()).toEqual([
      'challengeList',
      'sourceDraft',
      'sourceReview',
      'studentChallenge',
      'studentFeedback',
      'studentTask',
      'teacherTaskPreview',
      'teacherTaskSummary',
      'trace',
    ]);
  });

  it('covers the live path', () => {
    expect(exampleVariants.lesson.live.aiMode).toBe('LIVE');
    expect(exampleVariants.job.needsInput.status).toBe('NEEDS_INPUT');
    expect(exampleVariants.job.failed).toMatchObject({ status: 'FAILED', errorCode: 'UNSUPPORTED_LANGUAGE' });
    expect(exampleVariants.sourceReview.readByAI.readByAI).toBe(true);
    expect(examples.lessonList.lessons.map((lesson) => lesson.aiMode)).toEqual(['SEEDED', 'LIVE']);
  });

  it('contains no em-dash', () => {
    expect(JSON.stringify([examples, examplesVi, exampleVariants])).not.toContain('\u2014');
  });

  it('the main entry does not export examples', () => {
    expect(contracts).not.toHaveProperty('examples');
    expect(contracts).not.toHaveProperty('examplesVi');
    expect(contracts).not.toHaveProperty('exampleVariants');
  });

  it('the package has a separate examples entry', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(Object.keys(manifest.exports).sort()).toEqual(['.', './examples']);
  });
});

describe('student DTOs', () => {
  it('SEC01 StudentTaskDTO rejects correctAnswerId', () => {
    expect(() => StudentTaskDTO.parse({ ...examples.studentTask, correctAnswerId: 'opt_1' })).toThrow();
  });

  it('SEC01 a Q2 task body rejects acceptedOrders', () => {
    const body = { cards: [{ cardId: 'c1', text: 'x' }], basis: 'y' };
    const task = { slot: 'Q2', phase: 'REASON', stem: 's', draftArtifact: null, submittedSlots: [] };
    expect(() => StudentTaskDTO.parse({ ...task, taskBody: body })).not.toThrow();
    expect(() => StudentTaskDTO.parse({ ...task, taskBody: { ...body, acceptedOrders: [['c1']] } })).toThrow();
  });

  it('SEC01 Q3 to Q5 task bodies parse and reject their server-only keys', () => {
    const shared = { phase: 'REASON', stem: 's', draftArtifact: null, submittedSlots: [] };
    const q3 = {
      options: [{ optionId: 'o1', text: 'x' }],
      criteria: [{ criterionId: 'c1', text: 'y' }],
      constraints: [{ tradeOffId: 't1', text: 'z' }],
    };
    const q4 = {
      templates: [{ templateId: 't1', text: 'x', slots: [{ slotId: 's1', choices: [{ choiceId: 'c1', text: 'y' }] }] }],
    };
    const q5 = { instructions: 'x', maxCharsPerField: 120 };
    expect(() => StudentTaskDTO.parse({ ...shared, slot: 'Q3', taskBody: q3 })).not.toThrow();
    expect(() => StudentTaskDTO.parse({ ...shared, slot: 'Q4', taskBody: q4 })).not.toThrow();
    expect(() => StudentTaskDTO.parse({ ...shared, slot: 'Q5', taskBody: q5 })).not.toThrow();
    expect(() => StudentTaskDTO.parse({ ...shared, slot: 'Q3', taskBody: { ...q3, priorities: [] } })).toThrow();
    expect(() => StudentTaskDTO.parse({ ...shared, slot: 'Q5', taskBody: { ...q5, keywordPartitions: [] } })).toThrow();
  });

  it('SEC02 StudentChallengeDTO carries exactly one message', () => {
    expect(Object.keys(StudentChallengeDTO.shape).sort()).toEqual(['deliveryId', 'lockedSummary', 'message']);
  });

  it('StudentTaskDTO carries initialArtifact and initialConfidence only once locked', () => {
    expect(examples.studentTask).not.toHaveProperty('initialArtifact');
    expect(examples.studentTask).not.toHaveProperty('initialConfidence');

    const locked = exampleVariants.studentTask.locked;
    expect(locked.initialConfidence).toBe(70);
    expect(locked.initialArtifact).toMatchObject({
      answerId: expect.stringMatching(/^opt_/),
      evidenceId: expect.stringMatching(/^ev_/),
    });
  });

  it('StudentTaskDTO examples use runtime IDs, never authoring IDs', () => {
    expect(JSON.stringify([examples.studentTask, exampleVariants.studentTask.locked])).not.toMatch(/"[AE][1-4]"/);
  });
});

describe('teacher DTOs', () => {
  it('FE04 TeacherTaskSummaryDTO allows 1 to 3 example challenges only', () => {
    const challenge = examples.teacherTaskSummary.exampleChallenges[0]!;
    const summary = (count: number) => ({
      ...examples.teacherTaskSummary,
      exampleChallenges: Array(count).fill(challenge),
    });
    expect(() => TeacherTaskSummaryDTO.parse(summary(1))).not.toThrow();
    expect(() => TeacherTaskSummaryDTO.parse(summary(3))).not.toThrow();
    expect(() => TeacherTaskSummaryDTO.parse(summary(0))).toThrow();
    expect(() => TeacherTaskSummaryDTO.parse(summary(4))).toThrow();
  });

  it('JobStatus includes NEEDS_INPUT and JobDTO carries question and errorCode but not error', () => {
    expect(JobStatus.options).toContain('NEEDS_INPUT');
    expect(JobStatus.options).toContain('CANCELLED');
    const question = { kind: 'LANGUAGE_MISMATCH', detected: 'vi', chosen: 'en' };
    expect(() => JobDTO.parse({ ...examples.job, status: 'NEEDS_INPUT', question })).not.toThrow();
    expect(() => JobDTO.parse({ ...examples.job, error: {} })).toThrow();
    expect(() => JobDTO.parse({ ...examples.job, errorCode: 'UNREADABLE' })).not.toThrow();
    expect(() => JobDTO.parse({ ...examples.job, errorCode: 'BOOM' })).toThrow();
  });

  it('LessonDTO requires aiMode SEEDED or LIVE', () => {
    expect(() => LessonDTO.parse({ ...examples.lesson, aiMode: 'LIVE' })).not.toThrow();
    expect(() => LessonDTO.parse({ ...examples.lesson, aiMode: 'OTHER' })).toThrow();
    expect(() => LessonDTO.parse(without(examples.lesson, 'aiMode'))).toThrow();
  });

  it('SourceReviewDTO carries readByAI and per-paragraph readBy', () => {
    expect(() => SourceReviewDTO.parse(withParagraph(firstParagraph))).not.toThrow();
    expect(() => SourceReviewDTO.parse(withParagraph(without(firstParagraph, 'readBy')))).toThrow();
    expect(() => SourceReviewDTO.parse(withParagraph({ ...firstParagraph, readBy: 'GEMINI' }))).toThrow();
    expect(() => SourceReviewDTO.parse(without(examples.sourceReview, 'readByAI'))).toThrow();
  });

  it('MaterialRefusalDTO accepts only refusal codes and no message or stack', () => {
    const detail = { pageCount: 11, limit: 10 };
    expect(() => MaterialRefusalDTO.parse({ code: 'TOO_MANY_PAGES', detail })).not.toThrow();
    expect(() => MaterialRefusalDTO.parse({ code: 'TOO_MANY_PAGES', stack: 'x' })).toThrow();
    expect(() => MaterialRefusalDTO.parse({ code: 'TOO_MANY_PAGES', message: 'x' })).toThrow();
    expect(() => MaterialRefusalDTO.parse({ code: 'AI_FAILED' })).toThrow();
  });

  it('MaterialViewUrlDTO has url and expiresAt only', () => {
    expect(Object.keys(MaterialViewUrlDTO.shape).sort()).toEqual(['expiresAt', 'url']);
  });

  it('MaterialViewUrlDTO never carries storagePath', () => {
    expect(() => MaterialViewUrlDTO.parse({ ...examples.materialViewUrl, storagePath: 'uploads/x.pdf' })).toThrow();
  });
});

describe('requests', () => {
  it('confidence must be an integer between 0 and 100', () => {
    expect(() => LockReq.parse({ ...lockBody, initialConfidence: 55 })).not.toThrow();
    expect(() => LockReq.parse({ ...lockBody, initialConfidence: 55.5 })).toThrow();
    expect(() => LockReq.parse({ ...lockBody, initialConfidence: -1 })).toThrow();
    expect(() => LockReq.parse({ ...lockBody, initialConfidence: 101 })).toThrow();
  });

  it('Q5 artifact rejects proposal over 120 characters', () => {
    expect(() => Q5Artifact.parse({ slot: 'Q5', proposal: 'x'.repeat(121), reason: 'y' })).toThrow();
  });

  it('Q5 artifact accepts 120', () => {
    expect(() => Q5Artifact.parse({ slot: 'Q5', proposal: 'x'.repeat(120), reason: 'y' })).not.toThrow();
  });

  it('Q5 artifact rejects reason over 120 characters', () => {
    expect(() => Q5Artifact.parse({ slot: 'Q5', proposal: 'x', reason: 'y'.repeat(121) })).toThrow();
  });

  it('artifacts are strict', () => {
    expect(() => Q2Artifact.parse({ slot: 'Q2', orderedCardIds: ['c1'], extra: 1 })).toThrow();
  });

  it('UploadUrlReq accepts PDF and DOCX only', () => {
    const body = { fileName: 'a', sizeBytes: 10 };
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(() => UploadUrlReq.parse({ ...body, contentType: 'application/pdf' })).not.toThrow();
    expect(() => UploadUrlReq.parse({ ...body, contentType: docx })).not.toThrow();
    expect(() => UploadUrlReq.parse({ ...body, contentType: 'image/png' })).toThrow();
  });

  it('JobAnswerReq accepts USE_DETECTED or KEEP_CHOSEN only', () => {
    expect(() => JobAnswerReq.parse({ choice: 'USE_DETECTED' })).not.toThrow();
    expect(() => JobAnswerReq.parse({ choice: 'KEEP_CHOSEN' })).not.toThrow();
    expect(() => JobAnswerReq.parse({ choice: 'OTHER' })).toThrow();
  });

  it('RegisterMaterialReq accepts an upload or the sample, not both', () => {
    const upload = { uploadId: 'upl_1', title: 'Lesson 8' };
    expect(() => RegisterMaterialReq.parse(upload)).not.toThrow();
    expect(() => RegisterMaterialReq.parse({ sample: true })).not.toThrow();
    expect(() => RegisterMaterialReq.parse({ ...upload, sample: true })).toThrow();
    expect(() => RegisterMaterialReq.parse({ sample: false })).toThrow();
  });

  it('ResolveIssueReq KEEP_OPEN needs bounds and reason', () => {
    const body = { action: 'KEEP_OPEN', baseVersion: 1 };
    expect(() => ResolveIssueReq.parse(body)).toThrow();
    expect(() => ResolveIssueReq.parse({ ...body, keepOpenBounds: 'x', keepOpenReason: 'y' })).not.toThrow();
  });

  it('DispositionReq accepting a warning needs a reason', () => {
    const body = { gateId: 'QG1', findingCode: 'F', baseVersion: 1, decision: 'TEACHER_ACCEPT_WITH_REASON' };
    expect(() => DispositionReq.parse(body)).toThrow();
    expect(() => DispositionReq.parse({ ...body, reason: 'x' })).not.toThrow();
    expect(() => DispositionReq.parse({ ...body, decision: 'REVISE_AND_RERUN' })).not.toThrow();
  });

  it('EditReq payload is allowlisted per scope', () => {
    const body = { targetType: 'answerOption', targetId: 'A4', changedRefs: ['A4'], baseVersion: 3 };
    const content = { ...body, editScope: 'CONTENT', payload: { optionId: 'A4', text: 'x' } };
    expect(() => EditReq.parse(content)).not.toThrow();
    expect(() => EditReq.parse({ ...content, editScope: 'SOURCE' })).toThrow();
    expect(() => EditReq.parse({ ...content, payload: { ...content.payload, trigger: {} } })).toThrow();
  });

  it('ApproveReq requires confirmed true', () => {
    const body = { expectedDraftVersion: 4, previewHash: 'h', candidateSetVersion: 1 };
    expect(() => ApproveReq.parse({ ...body, confirmed: true })).not.toThrow();
    expect(() => ApproveReq.parse({ ...body, confirmed: false })).toThrow();
  });

  it('AssignReq has no recipientStudentIds', () => {
    const body = { classId: 'cls_1', baseVersion: 1 };
    expect(() => AssignReq.parse(body)).not.toThrow();
    expect(() => AssignReq.parse({ ...body, recipientStudentIds: [] })).toThrow();
  });
});
