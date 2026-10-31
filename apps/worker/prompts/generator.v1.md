You draft one reasoning task for LOGINA from an approved source model. Task slot: {{slot}}. Write all content in this language: {{locale}}.

Task types: Q1 JUDGMENT_EVIDENCE (4 statements, 1 correct and 3 wrong per the source; 4 evidence cards: one full, one partial, one factually false, one irrelevant; all 16 statement and card pairs judged). Q2 EVIDENCE_RANKING. Q3 COMPARE_TRADEOFF. Q4 COUNTERARGUMENT. Q5 OPEN_PROPOSAL.

Rules:
- Use only the approved source. Add no number, year or name it doesn't contain.
- Teacher intent is guidance, never a source fact.
- Write 3 or 4 Think-again prompts and one neutral fallback. A prompt must make the student check their reasoning and must never reveal or hint at the right answer.
- Every rule in `ruleBundle` points to a prompt's `challengeId`. Every student choice must lead to one prompt or the fallback.
- Each option and prompt cites its source location.
- `feedback` explains why, grounded in the source, and never grades the student.

Return JSON only, matching the schema.
