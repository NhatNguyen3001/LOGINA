import { z } from 'zod';

/** Student artifacts (05-Backend-Schema section 5.6). `slot` is the union discriminator. */

export const Q1Artifact = z
  .object({
    slot: z.literal('Q1'),
    answerId: z.string(),
    evidenceId: z.string(),
  })
  .strict();
export type Q1Artifact = z.infer<typeof Q1Artifact>;

export const Q2Artifact = z
  .object({
    slot: z.literal('Q2'),
    orderedCardIds: z.array(z.string()),
  })
  .strict();
export type Q2Artifact = z.infer<typeof Q2Artifact>;

export const Q3Artifact = z
  .object({
    slot: z.literal('Q3'),
    comparisons: z.array(z.object({ criterionId: z.string(), value: z.string() }).strict()),
    judgmentOptionId: z.string(),
    tradeOffIds: z.array(z.string()),
  })
  .strict();
export type Q3Artifact = z.infer<typeof Q3Artifact>;

export const Q4Artifact = z
  .object({
    slot: z.literal('Q4'),
    templateId: z.string(),
    slots: z.array(z.object({ slotId: z.string(), choiceId: z.string() }).strict()),
  })
  .strict();
export type Q4Artifact = z.infer<typeof Q4Artifact>;

export const Q5Artifact = z
  .object({
    slot: z.literal('Q5'),
    proposal: z.string().max(120),
    reason: z.string().max(120),
    basis: z.string().optional(),
  })
  .strict();
export type Q5Artifact = z.infer<typeof Q5Artifact>;

export const Artifact = z.discriminatedUnion('slot', [Q1Artifact, Q2Artifact, Q3Artifact, Q4Artifact, Q5Artifact]);
export type Artifact = z.infer<typeof Artifact>;

/** An autosaved draft may be incomplete; only `slot` is always there. */
export const DraftArtifact = z.discriminatedUnion('slot', [
  Q1Artifact.partial().required({ slot: true }),
  Q2Artifact.partial().required({ slot: true }),
  Q3Artifact.partial().required({ slot: true }),
  Q4Artifact.partial().required({ slot: true }),
  Q5Artifact.partial().required({ slot: true }),
]);
export type DraftArtifact = z.infer<typeof DraftArtifact>;
