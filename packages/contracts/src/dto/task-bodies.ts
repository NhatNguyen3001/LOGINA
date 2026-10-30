import { z } from 'zod';

/**
 * Public parts of the Q2 to Q5 task bodies (05-Backend-Schema section 5.6). These are typed and strict on
 * purpose: a loose `taskBody` would let `acceptedOrders`, `priorities` or `keywordPartitions` through.
 */

export const Q2TaskBody = z
  .object({
    cards: z.array(z.object({ cardId: z.string(), text: z.string() }).strict()),
    basis: z.string(),
  })
  .strict();
export type Q2TaskBody = z.infer<typeof Q2TaskBody>;

export const Q3TaskBody = z
  .object({
    options: z.array(z.object({ optionId: z.string(), text: z.string() }).strict()),
    criteria: z.array(z.object({ criterionId: z.string(), text: z.string() }).strict()),
    /** The drawbacks a student can accept: `Q3Artifact.tradeOffIds` picks from these. */
    constraints: z.array(z.object({ tradeOffId: z.string(), text: z.string() }).strict()),
  })
  .strict();
export type Q3TaskBody = z.infer<typeof Q3TaskBody>;

export const Q4TaskBody = z
  .object({
    templates: z.array(
      z
        .object({
          templateId: z.string(),
          text: z.string(),
          slots: z.array(
            z
              .object({
                slotId: z.string(),
                choices: z.array(z.object({ choiceId: z.string(), text: z.string() }).strict()),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type Q4TaskBody = z.infer<typeof Q4TaskBody>;

export const Q5TaskBody = z
  .object({
    instructions: z.string(),
    maxCharsPerField: z.literal(120),
  })
  .strict();
export type Q5TaskBody = z.infer<typeof Q5TaskBody>;
