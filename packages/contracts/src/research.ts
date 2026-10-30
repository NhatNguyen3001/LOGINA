import { z } from 'zod';
import { Confidence } from './dto/common.js';
import { AiMode, KeepRevise, Locale, Slot, TaskType } from './enums.js';

/**
 * One row per consenting participant per submitted task: the Sheet columns of the no-sign-in design, section 6,
 * in order. Server only, never in a DTO. `exportedAt` lives beside it in the `packages/db` document type.
 * The evidence and relation columns are Q1 only. Times are `YYYY-MM-DD HH:MM:SS` in UTC+7.
 */
export const ResearchRow = z
  .object({
    row_id: z.string(),
    participant_code: z.string(),
    participant_type: z.string(),
    is_simulated: z.boolean(),
    consent_version: z.string(),
    consent_at: z.string(),
    interface_language: Locale,
    material_hash: z.string(),
    material_title: z.string(),
    run_number: z.number().int().positive(),
    lesson_id: z.string(),
    lesson_type: AiMode,
    content_language: Locale,
    task: Slot,
    task_type: TaskType,
    release: z.string(),
    first_answer: z.string(),
    first_evidence: z.string().nullable(),
    first_relation: z.string().nullable(),
    first_confidence: Confidence,
    locked_at: z.string(),
    prompt_label: z.string(),
    prompt_mode: z.enum(['NORMAL', 'FALLBACK']),
    choice: KeepRevise,
    changed: z.string(),
    final_answer: z.string(),
    final_evidence: z.string().nullable(),
    final_relation: z.string().nullable(),
    final_confidence: Confidence,
    confidence_change: z.number().int(),
    submitted_at: z.string(),
    seconds_to_lock: z.number().nonnegative(),
    seconds_to_submit: z.number().nonnegative(),
  })
  .strict();
export type ResearchRow = z.infer<typeof ResearchRow>;

export const RESEARCH_COLUMNS: readonly string[] = Object.keys(ResearchRow.shape);
