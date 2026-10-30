import { z } from 'zod';
import { Locale, Role } from '../enums.js';

/** Shared field schemas, and the DTOs any session can receive. */

export const Timestamp = z.iso.datetime();

/** Confidence the student sets: an integer from 0 to 100. */
export const Confidence = z.number().int().min(0).max(100);

export const Version = z.number().int().nonnegative();

export const ReleaseLabels = z
  .object({ Q1: z.string(), Q2: z.string(), Q3: z.string(), Q4: z.string(), Q5: z.string() })
  .strict();
export type ReleaseLabels = z.infer<typeof ReleaseLabels>;

/** Error bodies, except pre-Gemini refusals (MaterialRefusalDTO). */
export const ErrorDTO = z
  .object({
    code: z.string(),
    message: z.string(),
    affectedRefs: z.array(z.string()).optional(),
  })
  .strict();
export type ErrorDTO = z.infer<typeof ErrorDTO>;

export const MeDTO = z
  .object({
    uid: z.string(),
    role: Role,
    displayName: z.string(),
    schoolId: z.string(),
    classIds: z.array(z.string()),
    uiLocale: Locale,
    demoMenu: z.boolean(),
    consentRequired: z.boolean(),
    currentConsentVersion: z.string(),
    participantCode: z.string().optional(),
  })
  .strict();
export type MeDTO = z.infer<typeof MeDTO>;
