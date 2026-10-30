import { z } from 'zod';

/** Values come from 05-Backend-Schema sections 3 to 8. */

export const Slot = z.enum(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
export type Slot = z.infer<typeof Slot>;

export const Locale = z.enum(['en', 'vi']);
export type Locale = z.infer<typeof Locale>;

export const Role = z.enum(['teacher', 'student', 'admin', 'demo']);
export type Role = z.infer<typeof Role>;

export const Level = z.enum(['basic', 'good', 'advanced']);
export type Level = z.infer<typeof Level>;

export const LessonStage = z.enum([
  'CREATE',
  'CLARIFY',
  'SOURCE_REVIEW',
  'GENERATE_PREVIEW',
  'APPROVE_ASSIGN',
  'ASSIGNED',
]);
export type LessonStage = z.infer<typeof LessonStage>;

export const TaskType = z.enum([
  'JUDGMENT_EVIDENCE',
  'EVIDENCE_RANKING',
  'COMPARE_TRADEOFF',
  'COUNTERARGUMENT',
  'OPEN_PROPOSAL',
]);
export type TaskType = z.infer<typeof TaskType>;

export const TaskStatus = z.enum([
  'GENERATING',
  'VALIDATING',
  'BLOCKED',
  'REVIEW_REQUIRED',
  'MACHINE_PASS',
  'STALE',
  'FAILED',
  'APPROVED',
  'SUPERSEDED',
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const IssueState = z.enum(['UNRESOLVED', 'CONFIRMED', 'SUGGESTION_ACCEPTED', 'EDITED', 'KEEP_OPEN', 'EXCLUDED']);
export type IssueState = z.infer<typeof IssueState>;

export const IssueType = z.enum(['AMBIGUOUS', 'MISSING', 'CONFLICT', 'ASSUMPTION']);
export type IssueType = z.infer<typeof IssueType>;

export const Severity = z.enum(['BLOCKER', 'REVIEW']);
export type Severity = z.infer<typeof Severity>;

export const ResolutionAction = z.enum(['CONFIRM', 'USE_SUGGESTION', 'EDIT', 'KEEP_OPEN', 'EXCLUDE']);
export type ResolutionAction = z.infer<typeof ResolutionAction>;

export const SavedAs = z.enum(['TEACHER_INTERPRETATION', 'TASK_ASSUMPTION']);
export type SavedAs = z.infer<typeof SavedAs>;

export const ClaimStatus = z.enum(['VERIFIED', 'CONTEXT_ONLY', 'INSUFFICIENT', 'EXCLUDED']);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

export const Sufficiency = z.enum(['SUFFICIENT', 'INSUFFICIENT', 'UNCERTAIN']);
export type Sufficiency = z.infer<typeof Sufficiency>;

export const GateId = z.enum(['QG1', 'QG2', 'QG3', 'QG4', 'QG5', 'QG6']);
export type GateId = z.infer<typeof GateId>;

export const GateStatus = z.enum(['PASS', 'REVIEW_REQUIRED', 'BLOCKER']);
export type GateStatus = z.infer<typeof GateStatus>;

export const CheckStatus = z.enum(['PASS', 'FAIL']);
export type CheckStatus = z.infer<typeof CheckStatus>;

export const Aggregate = z.enum(['BLOCKED', 'REVIEW_REQUIRED', 'MACHINE_PASS']);
export type Aggregate = z.infer<typeof Aggregate>;

export const DispositionDecision = z.enum(['REVISE_AND_RERUN', 'TEACHER_ACCEPT_WITH_REASON']);
export type DispositionDecision = z.infer<typeof DispositionDecision>;

export const Phase = z.enum([
  'REASON',
  'CONFIDENCE_1',
  'LOCKED',
  'CHALLENGED',
  'RECONSIDER',
  'CONFIDENCE_2',
  'SUBMITTED',
]);
export type Phase = z.infer<typeof Phase>;

export const AttemptStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']);
export type AttemptStatus = z.infer<typeof AttemptStatus>;

export const EditScope = z.enum(['CONTENT', 'LOGIC', 'SOURCE']);
export type EditScope = z.infer<typeof EditScope>;

export const KeepRevise = z.enum(['KEEP', 'REVISE']);
export type KeepRevise = z.infer<typeof KeepRevise>;

export const JobType = z.enum(['PARSE', 'ANALYZE', 'GENERATE', 'VALIDATE', 'RERUN', 'EXPORT_ROW']);
export type JobType = z.infer<typeof JobType>;

export const JobStatus = z.enum(['QUEUED', 'RUNNING', 'NEEDS_INPUT', 'DONE', 'FAILED', 'TIMED_OUT', 'CANCELLED']);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobStepStatus = z.enum(['PENDING', 'RUNNING', 'DONE', 'FAILED']);
export type JobStepStatus = z.infer<typeof JobStepStatus>;

export const AnswerCorrectness = z.enum(['SUPPORTED_CORRECT', 'CONTRADICTED_INCORRECT', 'INVALID_UNDETERMINED']);
export type AnswerCorrectness = z.infer<typeof AnswerCorrectness>;

export const EQuality = z.enum(['FULL_SUPPORT', 'PARTIAL_SUPPORT', 'FACTUALLY_FALSE', 'IRRELEVANT']);
export type EQuality = z.infer<typeof EQuality>;

export const PairAlignment = z.enum([
  'SUPPORTS_FULL',
  'SUPPORTS_PARTIAL',
  'CONTRADICTS',
  'SAME_CLAIM_UNSUPPORTED',
  'INSUFFICIENT',
  'IRRELEVANT',
]);
export type PairAlignment = z.infer<typeof PairAlignment>;

export const ChallengeTarget = z.enum([
  'SOURCE_DIRECTION',
  'EVIDENCE_SUFFICIENCY',
  'PAIR_CONSISTENCY',
  'RELEVANCE',
  'CLARIFY_MISSING',
]);
export type ChallengeTarget = z.infer<typeof ChallengeTarget>;

/** Limits a caller can see in `LimitsDTO`. `API` and `SESSION` are 429 values only (RateLimitDTO). */
export const RateAction = z.enum(['UPLOAD', 'AI_ACTION', 'SIMULATE_CLASS', 'RESET']);
export type RateAction = z.infer<typeof RateAction>;

export const AiMode = z.enum(['SEEDED', 'LIVE']);
export type AiMode = z.infer<typeof AiMode>;

export const ReadBy = z.enum(['AI', 'SEEDED', 'TEACHER']);
export type ReadBy = z.infer<typeof ReadBy>;

export const UnitKind = z.enum(['PAGE', 'SECTION']);
export type UnitKind = z.infer<typeof UnitKind>;

export const MaterialMimeType = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
export type MaterialMimeType = z.infer<typeof MaterialMimeType>;

export const MaterialRefusalCode = z.enum([
  'FILE_TYPE',
  'FILE_TOO_LARGE',
  'TOO_MANY_PAGES',
  'DAILY_LIMIT',
  'UNREADABLE',
  'UNSUPPORTED_LANGUAGE',
  'TOO_LITTLE_CONTENT',
]);
export type MaterialRefusalCode = z.infer<typeof MaterialRefusalCode>;

/** The refusal codes a job can raise, plus failures that are not refusals. */
export const JobErrorCode = z.enum([
  'TOO_MANY_PAGES',
  'UNREADABLE',
  'UNSUPPORTED_LANGUAGE',
  'TOO_LITTLE_CONTENT',
  'LIVE_DISABLED',
  'AI_FAILED',
  'TIMED_OUT',
  'INTERNAL',
]);
export type JobErrorCode = z.infer<typeof JobErrorCode>;

export const JobAnswerChoice = z.enum(['USE_DETECTED', 'KEEP_CHOSEN']);
export type JobAnswerChoice = z.infer<typeof JobAnswerChoice>;
