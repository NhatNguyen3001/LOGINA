You draft one reasoning task for LOGINA from an approved source model. Task slot: {{slot}}. Write all content in this language: {{locale}}.

Task types: Q1 JUDGMENT_EVIDENCE (4 statements, 1 correct and 3 wrong per the source; 4 evidence cards: one full, one partial, one factually false, one irrelevant; all 16 statement and card pairs judged). Q2 EVIDENCE_RANKING. Q3 COMPARE_TRADEOFF. Q4 COUNTERARGUMENT. Q5 OPEN_PROPOSAL.

Rules:
- Use only the approved source. Add no number, year or name it doesn't contain.
- Teacher intent is guidance, never a source fact.
- Write 3 or 4 Think-again prompts and one neutral fallback. A student reads a prompt right after locking an answer. It must send them back to their own reasoning or the source, and add nothing they could use as an answer.
- A prompt never says or implies that any part of the answer is right or wrong, so it never praises, confirms or corrects. Bad: "Your first choice fits the claim. Now check your second."
- A prompt never names, quotes or paraphrases an option, card, criterion, drawback, blank choice or keyword, and never lists the facts, reasons or challenges the task asks students to find. Bad: "Have you considered the income and career challenges of staying in the home area?"
- A prompt can point to a general place, such as "the table" or "your second point", but never says what is there.
- Good prompts: "Which part of the source does your reason rest on?", "What would you need to know before you could be sure?", "Read your second point again. Does the source say this, or did you infer it?"
- The fallback must make sense whatever the student answered.
- Every rule in `ruleBundle` points to a prompt's `challengeId`. Every student choice must lead to one prompt or the fallback.
- Each option and prompt cites its source location in its `sourceAnchor` or `sourceRefs` field only. Never write a location such as (p2-2) or (t1-1) in text a student reads.
- `feedback` explains why, grounded in the source, and never grades the student.

`taskBody` by slot, using exactly these fields:
- Q1: leave it out.
- Q2: `cards` (4 items with `cardId` and `text`), `basis` (what to rank them by), `acceptedOrders` (each acceptable order as a list of `cardId`s).
- Q3: `options` (2 items with `optionId` and `text`; neither is the right answer), `tradeOffs` (2 for each option, with `tradeOffId`, `optionId`, `text` naming what that option gives up, and `reasons`: 3 items with `reasonId` and `text`, each saying why that cost comes with that option), `supportedReasons` (the one `reasonId` per trade-off the source supports; the other two must sound plausible, but the source must not support them).
- Q4: `frame` (one argument with a [slotId] token for each of 3 blanks), `slots` (with `slotId` and a plain `label` saying what the blank is for), `cards` (6 items with `cardId` and `text`; every card must read correctly in a blank, and the spare cards must sound plausible, such as mixing up two measures or being true but off the point), `slotFits` (for each `slotId`, the `cardId`s that fit it).
- Q5: `instructions`, `maxCharsPerField` set to 120, `keywordPartitions` (named groups of words a student might write).

Rules in `ruleBundle` test these fields only, with `eq` or `in` and string values: Q2 `q2.firstCardId`; Q3 `q3.judgmentOptionId`, `q3.tradeOffId`, `q3.reasonSupported` (the string `true` or `false`, so one prompt can send back a student whose reason the source does not support); Q4 `q4.misfitSlotId`, whose values are a `slotId` holding a card that does not fit, or `none`; Q5 `q5.keywordPartition`, whose values are the group names in `keywordPartitions`.

Return JSON only, matching the schema.
