# Sample material: Labor and Employment (Bài 8)

The team-written source material for the LOGINA demo, kept here so the whole team can read and review it. **This folder is the master copy.** In backend task B7a (`.claude/docs/plans/2026-10-28-backend.md`) it is copied into `packages/domain/fixtures/dia-ly-12-bai-8/{en,vi}/material.md` in the repo; edit it here first, then copy again. Schema: `.claude/docs/05-Backend-Schema.md` §12.

## Sample material (`{en,vi}/material.md`)

- **Team-written, not textbook pages.** It states the same facts as SGK Địa lý 12, Bài 8 in our own words, so the public demo does not redistribute copyrighted pages. Do not paste textbook text into these files.
- **Layout and locators** match the design screens: page 8 has Section 2, paragraphs 1–3 and Table 8.1; page 9 has paragraphs 1–4 and the 2015 secondary-source box. `source.json` must use the `{{…}}` markers in the files as locators.
- **Deliberate gaps** the demo depends on: no total number of employed people (T3 Point 1) and no labor productivity data (T6, Q4). Don't add them.
- **PDFs:** in the repo, `material.pdf` is generated next to each copied `material.md` by `pnpm make:material` (`tools/seed/make-material-pdf.ts`, B7a). Regenerate after any edit.
- **Recognised by sha256** (live upload, decided 28/10/2026): when material is registered, the API compares the file's sha256 with the sha256 of both sample PDFs (`demo/material.{en,vi}.pdf`). A match takes the seeded path (`aiMode: SEEDED`), so a judge who downloads the sample PDF and uploads it again gets the same deterministic Bài 8 flow as **Use sample material**, with no Gemini call. Any other file, including an edited copy of the sample, takes the live path. Because of this, regenerating the PDFs changes their sha256: re-seed after every regeneration so the stored hashes match. See [live upload design](../plans/2026-10-28-live-upload-design.md) §3.1.

## Figures to verify before the demo

The figures are approximate values from the General Statistics Office of Vietnam (GSO). Check them against the GSO Statistical Yearbook (labor and employment chapter) and update both language files together.

| Item | 2010 | 2021 | 2015 (secondary box) |
|---|---|---|---|
| Agriculture, forestry and fisheries | 49.5 | 29.1 | 44.0 |
| Industry and construction | 21.0 | 33.1 | 22.8 |
| Services | 29.5 | 37.8 | 33.2 |

Cross-check: GSO's Q1 2022 labor force report gives about 27.8 / 33.5 / 38.7, consistent with the 2021 column.

## Review log

| Content | Reviewer | Date |
|---|---|---|
| Vietnamese sample material and Q2–Q5 content | [Grade 12 Geography reviewer] | [date] |
| English sample material | [fluent English reader] | [date] |
| GSO figures verified | [name] | [date] |

## Fixture review status

Q1 follows the approved screens. Q2 to Q5, their prompts and the Vietnamese wording were drafted by the builder and have not been reviewed. A Grade 12 Geography reviewer and a fluent English reader should check them, then fill in the review log above.
