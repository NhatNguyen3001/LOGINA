import { z } from 'zod';
import { Artifact, DraftArtifact } from './artifacts.js';
import { Confidence, Timestamp, Version } from './dto/common.js';
import { GateId, JobAnswerChoice, KeepRevise, Level, Locale, MaterialMimeType } from './enums.js';

export const CreateLessonReq = z
  .object({
    title: z.string().min(1),
    subject: z.string().min(1),
    topic: z.string().min(1),
    level: Level,
    primaryClassId: z.string(),
    objective: z.string().min(1),
    /** Omitted means the teacher's `uiLocale`. */
    contentLocale: Locale.optional(),
  })
  .strict();
export type CreateLessonReq = z.infer<typeof CreateLessonReq>;

export const UploadUrlReq = z
  .object({
    fileName: z.string().min(1),
    contentType: MaterialMimeType,
    sizeBytes: z.number().int().positive(),
  })
  .strict();
export type UploadUrlReq = z.infer<typeof UploadUrlReq>;

export const RegisterMaterialReq = z.union([
  z
    .object({
      uploadId: z.string(),
      title: z.string().min(1),
      edition: z.string().optional(),
      author: z.string().optional(),
      locator: z.string().optional(),
      rights: z.string().optional(),
    })
    .strict(),
  z.object({ sample: z.literal(true) }).strict(),
]);
export type RegisterMaterialReq = z.infer<typeof RegisterMaterialReq>;

export const JobAnswerReq = z.object({ choice: JobAnswerChoice }).strict();
export type JobAnswerReq = z.infer<typeof JobAnswerReq>;

const baseVersion = { baseVersion: Version };

export const ResolveIssueReq = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CONFIRM'), ...baseVersion }).strict(),
  z.object({ action: z.literal('USE_SUGGESTION'), suggestionId: z.string(), ...baseVersion }).strict(),
  z.object({ action: z.literal('EDIT'), text: z.string().min(1), ...baseVersion }).strict(),
  z
    .object({
      action: z.literal('KEEP_OPEN'),
      keepOpenBounds: z.string().min(1),
      keepOpenReason: z.string().min(1),
      ...baseVersion,
    })
    .strict(),
  z.object({ action: z.literal('EXCLUDE'), excludeReason: z.string().min(1), ...baseVersion }).strict(),
  z.object({ action: z.literal('REOPEN'), ...baseVersion }).strict(),
]);
export type ResolveIssueReq = z.infer<typeof ResolveIssueReq>;

const editFields = {
  targetType: z.string(),
  targetId: z.string(),
  changedRefs: z.array(z.string()),
  ...baseVersion,
};

export const EditReq = z.discriminatedUnion('editScope', [
  z
    .object({
      editScope: z.literal('CONTENT'),
      ...editFields,
      payload: z.object({ optionId: z.string(), text: z.string().min(1) }).strict(),
    })
    .strict(),
  z
    .object({
      editScope: z.literal('LOGIC'),
      ...editFields,
      payload: z.object({ challengeId: z.string(), focus: z.string().optional(), message: z.string().optional() }).strict(),
    })
    .strict(),
  z
    .object({
      editScope: z.literal('SOURCE'),
      ...editFields,
      payload: z.object({ claimId: z.string(), wording: z.string().min(1), evidenceIds: z.array(z.string()) }).strict(),
    })
    .strict(),
]);
export type EditReq = z.infer<typeof EditReq>;

const dispositionFields = { gateId: GateId, findingCode: z.string(), ...baseVersion };

export const DispositionReq = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('REVISE_AND_RERUN'), ...dispositionFields }).strict(),
  z.object({ decision: z.literal('TEACHER_ACCEPT_WITH_REASON'), reason: z.string().min(1), ...dispositionFields }).strict(),
]);
export type DispositionReq = z.infer<typeof DispositionReq>;

export const ApproveReq = z
  .object({
    expectedDraftVersion: Version,
    previewHash: z.string(),
    candidateSetVersion: Version,
    confirmed: z.literal(true),
    /** Required on an uploaded lesson, so a tab opened before a translation changed can't approve it. */
    translationVersion: Version.optional(),
  })
  .strict();
export type ApproveReq = z.infer<typeof ApproveReq>;

export const TranslationEditReq = z.object({ from: z.string(), to: z.string().trim().min(1), translationVersion: Version }).strict();
export type TranslationEditReq = z.infer<typeof TranslationEditReq>;

/** The server sets `openAccess`; the demo targets no roster. */
export const AssignReq = z
  .object({
    classId: z.string(),
    dueAt: Timestamp.optional(),
    messageToStudents: z.string().optional(),
    ...baseVersion,
  })
  .strict();
export type AssignReq = z.infer<typeof AssignReq>;

export const DraftReq = z.object({ draftArtifact: DraftArtifact }).strict();
export type DraftReq = z.infer<typeof DraftReq>;

export const LockReq = z.object({ artifact: Artifact, initialConfidence: Confidence }).strict();
export type LockReq = z.infer<typeof LockReq>;

export const SubmitReq = z.object({ choice: KeepRevise, finalArtifact: Artifact, finalConfidence: Confidence }).strict();
export type SubmitReq = z.infer<typeof SubmitReq>;

export const UpdateMeReq = z.object({ uiLocale: Locale }).strict();
export type UpdateMeReq = z.infer<typeof UpdateMeReq>;
