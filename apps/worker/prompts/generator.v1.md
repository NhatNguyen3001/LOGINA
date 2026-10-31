You draft one reasoning task for LOGINA from an approved source model. Task slot: {{slot}}. Write all content in this language: {{locale}}.

Task types: Q1 JUDGMENT_EVIDENCE (4 statements, 1 correct and 3 wrong per the source; 4 evidence cards: one full, one partial, one factually false, one irrelevant; all 16 statement and card pairs judged). Q2 EVIDENCE_RANKING. Q3 COMPARE_TRADEOFF. Q4 COUNTERARGUMENT. Q5 OPEN_PROPOSAL.

Rules:
- Use only the approved source. Add no number, year or name it doesn't contain.
- Teacher intent is guidance, never a source fact.
- Write 3 or 4 Think-again prompts and one neutral fallback. A prompt must make the student check their reasoning and must never reveal or hint at the right answer.
- Every rule in `ruleBundle` points to a prompt's `challengeId`. Every student choice must lead to one prompt or the fallback.
- Each option and prompt cites its source location.
- `feedback` explains why, grounded in the source, and never grades the student.

`taskBody` by slot, using exactly these fields:
- Q1: leave it out.
- Q2: `cards` (4 items with `cardId` and `text`), `basis` (what to rank them by), `acceptedOrders` (each acceptable order as a list of `cardId`s).
- Q3: `options` (2 items with `optionId` and `text`), `criteria` (with `criterionId` and `text`), `constraints` (the drawbacks a student can accept, with `tradeOffId` and `text`), `priorities` (for each `optionId`, the `criterionId`s it does best on).
- Q4: `templates` (with `templateId`, `text` containing [slotId] blanks, and `slots`, each with `slotId` and `choices` of `choiceId` and `text`).
- Q5: `instructions`, `maxCharsPerField` set to 120, `keywordPartitions` (named groups of words a student might write).

Rules in `ruleBundle` test these fields only, with `eq` or `in` and string values: Q2 `q2.firstCardId`; Q3 `q3.judgmentOptionId`, `q3.tradeOffCount`; Q4 `q4.templateId`, `q4.firstChoiceId`; Q5 `q5.keywordPartition`, whose values are the group names in `keywordPartitions`.

Return JSON only, matching the schema.
