import { z } from 'zod';

/**
 * Public parts of the Q2 to Q5 task bodies (05-Backend-Schema section 5.6). These are typed and strict on
 * purpose: a loose `taskBody` would let `acceptedOrders`, `supportedReasons`, `slotFits` or `keywordPartitions` through.
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
    /** What each option gives up, and the reasons a student can give for that cost. */
    tradeOffs: z.array(
      z
        .object({
          tradeOffId: z.string(),
          optionId: z.string(),
          text: z.string(),
          reasons: z.array(z.object({ reasonId: z.string(), text: z.string() }).strict()),
        })
        .strict(),
    ),
  })
  .strict();
export type Q3TaskBody = z.infer<typeof Q3TaskBody>;

export const Q4TaskBody = z
  .object({
    /** The argument, with a [slotId] token for each blank. */
    frame: z.string(),
    slots: z.array(z.object({ slotId: z.string(), label: z.string() }).strict()),
    /** One shared set, with more cards than blanks. */
    cards: z.array(z.object({ cardId: z.string(), text: z.string() }).strict()),
  })
  .strict();
export type Q4TaskBody = z.infer<typeof Q4TaskBody>;

export const Q5TaskBody = z
  .object({
    instructions: z.string(),
    maxCharsPerField: z.literal(120),
    /** Short sentences from the source for the student to finish. */
    starters: z.array(z.object({ starterId: z.string(), text: z.string() }).strict()),
  })
  .strict();
export type Q5TaskBody = z.infer<typeof Q5TaskBody>;
