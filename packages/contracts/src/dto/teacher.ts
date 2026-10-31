import { z } from 'zod';
import {
  Aggregate,
  AiMode,
  AttemptStatus,
  CheckStatus,
  ClaimStatus,
  GateId,
  GateStatus,
  IssueState,
  IssueType,
  JobErrorCode,
  JobStatus,
  JobStepStatus,
  JobType,
  KeepRevise,
  LessonStage,
  Level,
  Locale,
  MaterialMimeType,
  MaterialRefusalCode,
  ReadBy,
  ResolutionAction,
  SavedAs,
  Severity,
  Slot,
  Sufficiency,
  TaskStatus,
  TaskType,
  TranslationStatus,
  UnitKind,
} from '../enums.js';
import { Confidence, ReleaseLabels, Timestamp, Version } from './common.js';
import { Q2TaskBody, Q3TaskBody, Q4TaskBody, Q5TaskBody } from './task-bodies.js';

/* Lessons, classes, jobs */

export const LessonListDTO = z
  .object({
    lessons: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          stage: LessonStage,
          aiMode: AiMode,
          updatedAt: Timestamp,
          primaryClassName: z.string(),
          latestAssignmentId: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type LessonListDTO = z.infer<typeof LessonListDTO>;

export const LessonDTO = z
  .object({
    id: z.string(),
    title: z.string(),
    subject: z.string(),
    topic: z.string(),
    level: Level,
    stage: LessonStage,
    version: Version,
    contentLocale: Locale,
    primaryClassId: z.string(),
    editorTeacherIds: z.array(z.string()),
    currentTaskDraftIds: z.partialRecord(Slot, z.string()),
    latestAssignmentId: z.string().optional(),
    activeJobId: z.string().optional(),
    aiMode: AiMode,
  })
  .strict();
export type LessonDTO = z.infer<typeof LessonDTO>;

export const ClassDTO = z.object({ id: z.string(), name: z.string() }).strict();
export type ClassDTO = z.infer<typeof ClassDTO>;

export const JobDTO = z
  .object({
    id: z.string(),
    type: JobType,
    status: JobStatus,
    steps: z.array(z.object({ label: z.string(), status: JobStepStatus }).strict()),
    /** Lets a screen show the time so far, even after a reload. */
    startedAt: Timestamp.optional(),
    question: z.object({ kind: z.literal('LANGUAGE_MISMATCH'), detected: Locale, chosen: Locale }).strict().optional(),
    errorCode: JobErrorCode.optional(),
  })
  .strict();
export type JobDTO = z.infer<typeof JobDTO>;

/* Material */

export const MaterialRefusalDTO = z
  .object({
    code: MaterialRefusalCode,
    detail: z
      .object({
        fileName: z.string().optional(),
        pageCount: z.number().int().optional(),
        wordCount: z.number().int().optional(),
        limit: z.number().int().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type MaterialRefusalDTO = z.infer<typeof MaterialRefusalDTO>;

export const UploadUrlDTO = z.object({ uploadId: z.string(), url: z.url(), expiresAt: Timestamp }).strict();
export type UploadUrlDTO = z.infer<typeof UploadUrlDTO>;

export const MaterialViewUrlDTO = z.object({ url: z.url(), expiresAt: Timestamp }).strict();
export type MaterialViewUrlDTO = z.infer<typeof MaterialViewUrlDTO>;

/* Source review */

export const SourceReviewDTO = z
  .object({
    sourceModelDraftId: z.string(),
    version: Version,
    /** Null until Source Approval 1 has happened once. */
    approvedSourceVersion: Version.nullable(),
    readByAI: z.boolean(),
    summaryClaims: z.array(
      z
        .object({
          id: z.string(),
          wording: z.string(),
          evidenceSnippet: z.string(),
          locator: z.string(),
          status: ClaimStatus,
        })
        .strict(),
    ),
    teacherDecisions: z.array(
      z.object({ issueId: z.string(), label: z.string(), text: z.string(), note: z.string() }).strict(),
    ),
    openGaps: z.array(z.object({ issueId: z.string(), reason: z.string(), bounds: z.string() }).strict()),
    excluded: z.array(z.object({ issueId: z.string(), text: z.string(), reason: z.string() }).strict()),
    material: z
      .object({
        materialVersionId: z.string(),
        fileName: z.string(),
        mimeType: MaterialMimeType,
        unitKind: UnitKind,
        title: z.string(),
        locator: z.string(),
        paragraphs: z.array(
          z.object({ id: z.string(), page: z.number().int(), text: z.string(), readBy: ReadBy }).strict(),
        ),
      })
      .strict(),
    issues: z.array(
      z
        .object({
          id: z.string(),
          pointNumber: z.number().int(),
          issueType: IssueType,
          severity: Severity,
          bubble: z.string(),
          currentInterpretation: z.string(),
          suggestions: z.array(z.object({ id: z.string(), text: z.string(), sourceRef: z.string() }).strict()),
          state: IssueState,
          spans: z.array(
            z.object({ paragraphId: z.string(), start: z.number().int(), end: z.number().int() }).strict(),
          ),
          resolution: z
            .object({ action: ResolutionAction, text: z.string().optional(), savedAs: SavedAs.nullable() })
            .strict()
            .optional(),
          resolvedBy: z.string().optional(),
          resolvedAt: Timestamp.optional(),
        })
        .strict(),
    ),
    approveReady: z.boolean(),
    blockersRemaining: z.number().int().nonnegative(),
  })
  .strict();
export type SourceReviewDTO = z.infer<typeof SourceReviewDTO>;

export const SourceDraftDTO = z
  .object({
    sourceModelDraftId: z.string(),
    version: Version,
    editedClaims: z.array(
      z.object({ claimId: z.string(), before: z.string(), after: z.string(), evidence: z.string() }).strict(),
    ),
    impact: z.array(z.object({ slot: Slot, usesClaim: z.boolean(), refs: z.array(z.string()) }).strict()),
    unaffectedSlots: z.array(Slot),
    assignedReleasesUnchanged: z.array(z.object({ classLabel: z.string(), releaseLabel: z.string() }).strict()),
    approveReady: z.boolean(),
  })
  .strict();
export type SourceDraftDTO = z.infer<typeof SourceDraftDTO>;

export const SourceApprovalResultDTO = z
  .object({ sourceModelVersionId: z.string(), version: Version, jobId: z.string() })
  .strict();
export type SourceApprovalResultDTO = z.infer<typeof SourceApprovalResultDTO>;

/* Task previews */

const ChallengePreview = z
  .object({ label: z.string(), purpose: z.string(), whenShown: z.string(), message: z.string() })
  .strict();

/** FE04: the basic preview shows examples only, never the full candidate list. */
const ExampleChallenges = z.array(ChallengePreview).min(1).max(3);

const GateResult = z.object({ gateId: GateId, status: GateStatus, explanationForTeacher: z.string() }).strict();

/** A finding the teacher can act on. `findingCode` goes back in `DispositionReq`. */
const Finding = z
  .object({ gateId: GateId, findingCode: z.string(), explanationForTeacher: z.string(), overridable: z.boolean() })
  .strict();

export const TeacherTaskPreviewDTO = z
  .object({
    draftId: z.string(),
    draftVersion: Version,
    status: TaskStatus,
    questionStem: z.string(),
    answers: z.array(
      z
        .object({
          id: z.string(),
          text: z.string(),
          teacherLabel: z.string(),
          sourceAnchor: z.string(),
          inlineFinding: Finding.optional(),
        })
        .strict(),
    ),
    evidence: z.array(
      z
        .object({
          id: z.string(),
          text: z.string(),
          teacherLabel: z.string(),
          relationNote: z.string(),
          sourceAnchor: z.string(),
        })
        .strict(),
    ),
    exampleChallenges: ExampleChallenges,
    gates: z.array(GateResult),
    structureChecks: z.array(z.object({ label: z.string(), status: CheckStatus }).strict()),
    blockers: z.number().int().nonnegative(),
    previewHash: z.string(),
    candidateSetVersion: Version,
    canApprove: z.boolean(),
  })
  .strict();
export type TeacherTaskPreviewDTO = z.infer<typeof TeacherTaskPreviewDTO>;

/** `teacherLabels` maps an item ID (card, option, template) to its label. */
const teacherLabels = { teacherLabels: z.record(z.string(), z.string()) };

const summaryFields = {
  draftId: z.string(),
  draftVersion: Version,
  taskType: TaskType,
  status: TaskStatus,
  questionStem: z.string(),
  gates: z.array(GateResult),
  exampleChallenges: ExampleChallenges,
  blockers: z.number().int().nonnegative(),
  canApprove: z.boolean(),
};

export const TeacherTaskSummaryDTO = z.discriminatedUnion('slot', [
  z.object({ slot: z.literal('Q2'), ...summaryFields, taskBody: Q2TaskBody.extend(teacherLabels) }).strict(),
  z.object({ slot: z.literal('Q3'), ...summaryFields, taskBody: Q3TaskBody.extend(teacherLabels) }).strict(),
  z.object({ slot: z.literal('Q4'), ...summaryFields, taskBody: Q4TaskBody.extend(teacherLabels) }).strict(),
  z.object({ slot: z.literal('Q5'), ...summaryFields, taskBody: Q5TaskBody.extend(teacherLabels) }).strict(),
]);
export type TeacherTaskSummaryDTO = z.infer<typeof TeacherTaskSummaryDTO>;

export const TeacherLogicReviewDTO = z
  .object({
    pairs: z
      .array(
        z
          .object({
            answerId: z.string(),
            evidenceId: z.string(),
            relationLabel: z.string(),
            explanation: z.string(),
            goesTo: z.string(),
          })
          .strict(),
      )
      .length(16),
    challenges: z.array(ChallengePreview.extend({ isFallback: z.boolean() }).strict()),
    /** What a LOGIC edit may change: `challengeId` and one of `focusOptions` go back in the edit payload. */
    boundedEditActions: z.array(
      z.object({ challengeId: z.string(), label: z.string(), focusOptions: z.array(z.string()) }).strict(),
    ),
    warnings: z.array(z.string()),
  })
  .strict();
export type TeacherLogicReviewDTO = z.infer<typeof TeacherLogicReviewDTO>;

export const TasksOverviewDTO = z
  .object({
    slots: z.array(
      z
        .object({
          slot: Slot,
          taskType: TaskType,
          /** Null until a live draft has been reviewed. */
          sufficiency: Sufficiency.nullable(),
          sufficiencyNote: z.string(),
          sourceRefs: z.array(z.string()),
          progress: z.enum(['DRAFTING', 'CHECKING', 'TRANSLATING', 'READY', 'FAILED']),
          /** Null until a draft exists for the slot. */
          draftStatus: TaskStatus.nullable(),
          draftId: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type TasksOverviewDTO = z.infer<typeof TasksOverviewDTO>;

export const ChallengeListDTO = z
  .object({
    slot: Slot,
    draftVersion: Version,
    candidateSetVersion: Version,
    challenges: z.array(ChallengePreview.extend({ challengeId: z.string(), isFallback: z.boolean(), sourceAnchor: z.string() }).strict()),
  })
  .strict();
export type ChallengeListDTO = z.infer<typeof ChallengeListDTO>;

export const TryCaseDTO = z
  .object({
    answerId: z.string(),
    evidenceId: z.string(),
    wouldReceive: z.object({ label: z.string(), purpose: z.string(), message: z.string() }).strict(),
  })
  .strict();
export type TryCaseDTO = z.infer<typeof TryCaseDTO>;

export const EditResultDTO = z
  .object({
    editId: z.string(),
    newDraftIds: z.array(z.string()),
    staleDraftIds: z.array(z.string()),
    jobId: z.string(),
  })
  .strict();
export type EditResultDTO = z.infer<typeof EditResultDTO>;

/* Approval and assignment */

export const TaskApprovalDTO = z
  .object({
    tasks: z
      .array(
        z
          .object({
            slot: Slot,
            status: TaskStatus,
            gatesSummary: z
              .object({
                /** Null while a recheck has not produced a report. */
                aggregate: Aggregate.nullable(),
                gates: z.array(GateResult),
              })
              .strict(),
            draftVersion: Version,
            previewHash: z.string(),
            candidateSetVersion: Version,
            missingAltTextRefs: z.array(z.string()),
            changesSinceLastPreview: z.array(z.string()),
            decisionsNeeded: z.array(Finding),
            approvedAt: Timestamp.optional(),
            releaseLabel: z.string().optional(),
            acceptedWarning: z.boolean(),
            /** Absent on the sample lesson, which is written in both languages. */
            translation: z
              .object({
                status: TranslationStatus,
                /** Still WORKING long after any job could be running, so a retry is the way out. */
                stuck: z.boolean(),
                locale: Locale,
                version: Version,
                texts: z.array(z.object({ from: z.string(), to: z.string() }).strict()),
                keywords: z.record(z.string(), z.array(z.string())),
                findings: z.array(z.object({ status: GateStatus, findingCode: z.string(), text: z.string(), explanationForTeacher: z.string() }).strict()),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .length(5),
    contentManifestHash: z.string(),
    canApprove: z.boolean(),
  })
  .strict();
export type TaskApprovalDTO = z.infer<typeof TaskApprovalDTO>;

export const ApproveResultDTO = z.object({ taskReleaseId: z.string(), releaseLabel: z.string() }).strict();
export type ApproveResultDTO = z.infer<typeof ApproveResultDTO>;

export const AssignResultDTO = z
  .object({ assignmentId: z.string(), revision: Version, releaseLabels: ReleaseLabels })
  .strict();
export type AssignResultDTO = z.infer<typeof AssignResultDTO>;

/* Tracking */

const RelationCounts = z
  .object({
    full: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    contradicts: z.number().int().nonnegative(),
    irrelevant: z.number().int().nonnegative(),
  })
  .strict();

export const ClassTrackingDTO = z
  .object({
    assignmentId: z.string(),
    revision: Version,
    releaseLabels: ReleaseLabels,
    counts: z.object({ started: z.number().int().nonnegative(), complete: z.number().int().nonnegative() }).strict(),
    participants: z.array(
      z
        .object({
          attemptId: z.string(),
          participantCode: z.string().optional(),
          isSimulated: z.boolean(),
          status: AttemptStatus,
          submittedCount: z.number().int().min(0).max(5),
          keepCount: z.number().int().nonnegative(),
          reviseCount: z.number().int().nonnegative(),
          confidenceBefore: z.number().optional(),
          confidenceAfter: z.number().optional(),
        })
        .strict(),
    ),
    perTask: z.array(
      z
        .object({
          slot: Slot,
          submitted: z.number().int().nonnegative(),
          keep: z.number().int().nonnegative(),
          revise: z.number().int().nonnegative(),
          /** Null while no task in the slot has been submitted. */
          avgConfidenceBefore: z.number().nullable(),
          avgConfidenceAfter: z.number().nullable(),
          deliveredChallenges: z.array(
            z.object({ label: z.string(), message: z.string(), count: z.number().int().nonnegative(), revised: z.number().int().nonnegative() }).strict(),
          ),
        })
        .strict(),
    ),
    q1Relations: z
      .object({
        releaseLabel: z.string(),
        denominator: z.number().int().nonnegative(),
        before: RelationCounts,
        after: RelationCounts,
      })
      .strict(),
  })
  .strict();
export type ClassTrackingDTO = z.infer<typeof ClassTrackingDTO>;

const TraceOption = z.object({ letter: z.string(), authoringLabel: z.string(), text: z.string() }).strict();
const ChangedTraceOption = TraceOption.extend({ changed: z.boolean() }).strict();

export const TraceDTO = z
  .object({
    assignmentId: z.string(),
    participantCode: z.string().optional(),
    isSimulated: z.boolean(),
    completedAt: Timestamp.optional(),
    releaseLabel: z.string(),
    /** `choice` is null for a slot not yet submitted. */
    slotChips: z.array(z.object({ slot: Slot, choice: KeepRevise.nullable() }).strict()),
    slot: Slot,
    questionStem: z.string(),
    before: z
      .object({
        answer: TraceOption,
        /** Q1 only: Q2 to Q5 have no evidence card, and their `letter` is empty. */
        evidence: TraceOption.optional(),
        confidence: Confidence,
        lockedAt: Timestamp,
        relationLabel: z.string(),
      })
      .strict(),
    challenge: z
      .object({ label: z.string(), message: z.string(), whySelected: z.string(), studentChoice: KeepRevise })
      .strict(),
    after: z
      .object({
        answer: ChangedTraceOption,
        evidence: ChangedTraceOption.optional(),
        confidenceBefore: Confidence,
        confidenceAfter: Confidence,
        submittedAt: Timestamp,
        relationLabel: z.string(),
      })
      .strict(),
  })
  .strict();
export type TraceDTO = z.infer<typeof TraceDTO>;
