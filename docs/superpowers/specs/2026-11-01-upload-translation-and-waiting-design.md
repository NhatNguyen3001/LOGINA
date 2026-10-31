# Uploaded lesson translation and a clearer wait

Status: draft for owner review, 01/11/2026.

## Why

The project leaders want the language switch on the student side to change everything, including questions and answers. Today it changes only the interface text.

Uploaded lessons exist in one language, so a second version has to be produced by AI. LOGINA's core rule is that nothing from AI reaches a student without a teacher's approval, so the translation needs approval as well. That adds time to an upload that is already slow, and teachers need to understand the wait instead of thinking the app has failed. A real user gave up after about 100 seconds and reset the demo.

## Goals

- A student on an uploaded lesson can switch between English and Vietnamese and see all task content in that language.
- A teacher approves the translation as part of Approval 2.
- A teacher can always see what is happening during a long job, and can leave and come back.

## Non-goals

- Translating the uploaded source material. It stays as uploaded.
- Languages other than English and Vietnamese.
- Any AI use at student time. Translation happens before Approval 2, never when a student switches.
- Translating the teacher side.
- Changing research export. Rows keep letters and codes, which do not depend on language.

## Anti-goals

- A translation a teacher has not approved reaching a student.
- A third content approval. LOGINA keeps exactly two, Approval 1 and Approval 2.
- A partly switched lesson, where some tasks change language and others do not.
- A student's answer, option order or A to D letters changing when the language changes.

## Related work, built separately

The sample lesson's language switch is a small change and comes first. Its English and Vietnamese fixtures already exist with matching IDs, so it needs no AI and no translation job. A teacher's edit to a sample task stays as written in both languages.

The step 4 fix (job limit, page loading, Cloud Tasks deadline, Regenerate) must ship before this work, which builds on it.

## Decisions made by the owner

- Every uploaded lesson is translated. There is no skip option.
- The teacher approves the translation inside Approval 2, so a lesson cannot be assigned until its translation is approved.
- Translation runs as a separate AI step.
- A better wait is part of this work.

## The flow

1. **Draft.** The five tasks are drafted. Each draft opens for review as soon as it is ready.
2. **Translate.** A `TRANSLATE` job translates each task into the other language: English to Vietnamese, or Vietnamese to English, based on `lessons.contentLocale`.
3. **Check.** A separate AI review compares the two versions for changed meaning, numbers, or which answer is correct. Findings reach the teacher in the same form as `REVIEW_REQUIRED` findings.
4. **Review.** At Approval 2 the teacher sees both languages side by side for each task.
5. **Approve.** One approval per task covers both languages.
6. **Assign.** As today, with both languages available to students.

## What gets translated

Student-visible and teacher-reviewed task content: question stems, answer options, evidence cards, Q2 to Q5 task bodies, Think again prompts and feedback. IDs stay the same in both languages, so `answerIdMap`, `evidenceIdMap`, rule bundles and stored answers keep working.

Server-only data, such as `acceptedOrders` and `priorities`, is not shown to students. Translation must not change what it means. Fields in it that hold IDs stay as they are.

Q5 `keywordPartitions` are the exception, because they are words matched against what a student types, and that match picks the Think again prompt. Students can type in either language under either setting, so each partition holds keywords in both languages in one combined list. AI adds the translated keywords, the translation check covers them, and the teacher reviews them at Approval 2. This adds a keyword section to the approval page for Q5. Keywords stay hidden from students. (Owner's decision.)

## Editing

If a teacher edits one language of a task, only the edited field is retranslated into the other language. That field is checked and reviewed again before approval, and the rest of the task, including earlier hand edits, is left alone. The two versions can't drift apart. (Builder's call, for the owner to check.)

The existing edit check compares new numbers and names against the source. It applies only to edits in the source language. An edit in the other language is covered by the translation check instead, because the source text is not in that language. (Builder's call.)

## Check results

The translation check uses the existing two levels. A finding that changes which answer is correct, or changes a number, is a `BLOCKER` and stops approval. Any other finding is `REVIEW_REQUIRED` and can be accepted with a reason.

If the check itself fails, the task can't be approved until the teacher retries it. An unchecked translation must not reach students on review alone. (Builder's call, stricter than `rerun.ts`, which allows approval after a failed recheck.)

## Releases

A release holds both languages. The student routes return the version matching the student's language. The sample lesson's language switch comes first and sets this release shape, and this work reuses it. (Builder's call.)

Lessons released before this work have only one language, and students see it whatever the setting. There is no backfill. A lesson can't be assigned if its tasks are a mix of one-language and two-language releases. Lessons in progress when this ships get their translation when they next reach Approval 2. (Builder's call: there are no real classes yet.)

## Failure

If translation fails for a task, the task can't be approved yet, and the teacher can retry that task. Finished translations are kept. Assign stays unavailable until all five tasks are approved, in line with the rule above.

## The wait

The teacher sees one line per task, showing Drafting, Translating, Checking or Ready, plus the time so far and a note that they can close the tab and return. Progress comes from the job on the server, so it survives a reload and a return visit. Failures appear on the same screen with a way to retry.

The reading step gets the same treatment on `AnalyzePage`: expected time, time so far, and the note about leaving and returning. It has no per-task lines, because tasks don't exist yet. (Builder's call: reading takes about 6 minutes, longer than the time at which a real user gave up on a later step.)

Drafting tasks at the same time, rather than one by one, is expected to cut the wait most. Measured on a real 5-page paper, one-at-a-time generation takes about 13 minutes, after about 6 minutes of reading.

## Constraints

- Every job must finish inside the existing limits: 25 minutes for a job and 30 minutes for the Cloud Tasks dispatch deadline.
- Tests never call Vertex AI. Gemini stays stubbed.
- All interface text goes through the translation files, in both languages.
- No em dashes in code, copy or documents.
- Region `asia-southeast1` for regional resources.

## Left to the builder

- The data model for translated content, as long as IDs stay stable and approval covers both languages.
- Whether drafting and translation run as one job or as linked jobs, as long as the teacher sees per-task progress and one task's failure does not stop the others.
- The model behind the new `translator` role. It gets its own `TRANSLATOR_MODEL` setting, and any cheaper model must be tested on real tasks first.
- The screen layout for side-by-side review, using the existing design tokens.
- Whether parallel drafting ships with this work, after testing it against Gemini rate limits.
