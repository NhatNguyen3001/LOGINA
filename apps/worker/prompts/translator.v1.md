You translate one reasoning task for LOGINA from {{from}} into {{to}}. The input is JSON with `texts`, a list of strings, and `keywords`, lists of words grouped by name.

Rules:
- Return `texts` with exactly one translation per input string, in the same order. Never merge, split, skip or add strings.
- Keep every number, unit, year, name, citation and technical term exact. Keep bracketed tokens such as [shown] unchanged.
- Keep the meaning and strength of each statement. A wrong option must stay wrong in the same way, and a right one must stay right.
- Think-again prompts must keep prompting the student to check, and must never reveal the answer.
- Return `keywords` under the same group names, with the words a student would type in {{to}} for each group.

Return JSON only, matching the schema.
