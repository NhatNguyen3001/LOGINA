import { z } from 'zod';

export const CURRENT_CONSENT_VERSION = '2026-10-v1';

export const ConsentChoice = z.enum(['AGREED', 'DECLINED']);
export type ConsentChoice = z.infer<typeof ConsentChoice>;

export const ConsentReq = z.object({ consentVersion: z.string(), choice: ConsentChoice }).strict();
export type ConsentReq = z.infer<typeof ConsentReq>;

/** `participantCode` only when agreed. */
export const ConsentResultDTO = z.object({ consent: ConsentChoice, participantCode: z.string().optional() }).strict();
export type ConsentResultDTO = z.infer<typeof ConsentResultDTO>;
