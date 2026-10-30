import { z } from 'zod';
import { Artifact, DraftArtifact } from '../artifacts.js';
import { AttemptStatus, KeepRevise, Phase, Slot } from '../enums.js';
import { Confidence, Timestamp } from './common.js';
import { Q2TaskBody, Q3TaskBody, Q4TaskBody, Q5TaskBody } from './task-bodies.js';

export const AssignmentListDTO = z
  .object({
    assignments: z.array(
      z
        .object({
          assignmentId: z.string(),
          lessonTitle: z.string(),
          teacherName: z.string(),
          dueAt: Timestamp.optional(),
          messageToStudents: z.string().optional(),
          attemptId: z.string().optional(),
          status: AttemptStatus,
        })
        .strict(),
    ),
  })
  .strict();
export type AssignmentListDTO = z.infer<typeof AssignmentListDTO>;

export const AttemptDTO = z
  .object({
    attemptId: z.string(),
    status: AttemptStatus,
    slots: z.array(z.object({ slot: Slot, phase: Phase }).strict()),
  })
  .strict();
export type AttemptDTO = z.infer<typeof AttemptDTO>;

const RuntimeOption = z.object({ id: z.string(), text: z.string() }).strict();

/** `initialArtifact` and `initialConfidence` are present only once the task is locked. */
const taskFields = {
  phase: Phase,
  stem: z.string(),
  draftArtifact: DraftArtifact.nullable(),
  initialArtifact: Artifact.optional(),
  initialConfidence: Confidence.optional(),
};

export const StudentTaskDTO = z.discriminatedUnion('slot', [
  z
    .object({ slot: z.literal('Q1'), ...taskFields, answers: z.array(RuntimeOption), evidence: z.array(RuntimeOption) })
    .strict(),
  z.object({ slot: z.literal('Q2'), ...taskFields, taskBody: Q2TaskBody }).strict(),
  z.object({ slot: z.literal('Q3'), ...taskFields, taskBody: Q3TaskBody }).strict(),
  z.object({ slot: z.literal('Q4'), ...taskFields, taskBody: Q4TaskBody }).strict(),
  z.object({ slot: z.literal('Q5'), ...taskFields, taskBody: Q5TaskBody }).strict(),
]);
export type StudentTaskDTO = z.infer<typeof StudentTaskDTO>;

export const StudentChallengeDTO = z
  .object({
    deliveryId: z.string(),
    message: z.string(),
    lockedSummary: z
      .object({
        answerText: z.string(),
        /** Q1 only: Q2 to Q5 have no evidence card. */
        evidenceText: z.string().optional(),
        confidence: Confidence,
      })
      .strict(),
  })
  .strict();
export type StudentChallengeDTO = z.infer<typeof StudentChallengeDTO>;

export const SubmitResultDTO = z
  .object({
    slot: Slot,
    recordedChoice: KeepRevise,
    nextSlot: Slot.optional(),
    attemptStatus: AttemptStatus,
  })
  .strict();
export type SubmitResultDTO = z.infer<typeof SubmitResultDTO>;

/** What S7 shows for one answer: "B · Card 3" and a one-line summary. */
const FeedbackAnswer = z.object({ label: z.string(), text: z.string() }).strict();

export const StudentFeedbackDTO = z
  .object({
    slot: Slot,
    initial: FeedbackAnswer,
    challengeMessage: z.string(),
    final: FeedbackAnswer,
    confidenceBefore: Confidence,
    confidenceAfter: Confidence,
    explanations: z.array(
      z.object({ optionId: z.string(), relationLabel: z.string(), text: z.string() }).strict(),
    ),
  })
  .strict();
export type StudentFeedbackDTO = z.infer<typeof StudentFeedbackDTO>;
