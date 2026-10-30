import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Aggregate, GateId, GateStatus, Severity, Slot } from '@logina/contracts';

const text = z.string().min(1);
const ids = z.array(z.string());

const Unit = z
  .object({
    id: z.string(),
    unitType: z.enum(['DEFINITION', 'FACT', 'ASSUMPTION', 'TEACHER_RULE', 'CONTEXT']),
    span: z.object({ page: z.number(), paragraph: z.number().optional(), table: z.string().optional() }).strict(),
    text,
    figure: z.object({ altText: text, dataTable: z.array(z.array(z.string())) }).strict().optional(),
  })
  .strict();

export const SourceFixture = z
  .object({
    material: z
      .object({ title: text, edition: text, author: text, locator: text, rights: text, fileName: text })
      .strict(),
    intent: z
      .object({ objective: text, reasoningTarget: text, learnerTask: text, constraints: text, evaluationBasis: text })
      .strict(),
    units: z.array(Unit),
    evidence: z
      .array(z.object({ id: z.string(), sourceUnitId: z.string(), text, locator: text }).strict()),
    claims: z
      .array(
        z
          .object({
            id: z.string(),
            wording: text,
            sourceEvidenceIds: ids,
            acceptedStatus: z.enum(['VERIFIED', 'CONTEXT_ONLY', 'INSUFFICIENT', 'EXCLUDED']),
          })
          .strict(),
      ),
    relations: z
      .array(
        z
          .object({
            id: z.string(),
            sourceClaimId: z.string(),
            sourceEvidenceIds: ids,
            relationType: z.enum(['SUPPORTS', 'CONTRADICTS', 'QUALIFIES', 'CONTEXT']),
            scope: text,
            explanation: text,
          })
          .strict(),
      ),
  })
  .strict();
export type SourceFixture = z.infer<typeof SourceFixture>;

export const IssuesFixture = z.array(
  z
    .object({
      id: z.string(),
      pointNumber: z.number(),
      spans: z.array(z.object({ paragraphId: z.string(), start: z.number(), end: z.number() }).strict()),
      issueType: z.enum(['AMBIGUOUS', 'MISSING', 'CONFLICT', 'ASSUMPTION']),
      questionKind: z.enum(['SOURCE', 'TEACHER_INTENT']),
      severity: Severity,
      sourceRef: text,
      bubble: text,
      currentInterpretation: text,
      suggestions: z.array(z.object({ id: z.string(), text, sourceRef: text, rationale: text }).strict()),
      state: z.enum(['UNRESOLVED', 'EXCLUDED']),
      excludeReason: text.optional(),
    })
    .strict(),
);
export type IssuesFixture = z.infer<typeof IssuesFixture>;

export const SufficiencyFixture = z.array(
  z
    .object({
      slot: Slot,
      taskType: z.string(),
      reasoningTarget: text,
      targetClaimIds: ids,
      eligibleSourceEvidenceIds: ids,
      scopeConditions: text,
      assessment: z.enum(['SUFFICIENT', 'INSUFFICIENT', 'UNCERTAIN']),
      sourceRefs: text,
      explanationForTeacher: text,
    })
    .strict(),
);

const Candidate = z
  .object({
    challengeId: z.string(),
    label: text,
    isNeutralFallback: z.boolean(),
    primaryFunction: z.enum(['BASIS_CHECK', 'COUNTERPOINT', 'TRADEOFF_CHECK', 'CLARIFICATION']),
    challengeTarget: z.enum([
      'SOURCE_DIRECTION',
      'EVIDENCE_SUFFICIENCY',
      'PAIR_CONSISTENCY',
      'RELEVANCE',
      'CLARIFY_MISSING',
    ]),
    purposeForTeacher: text,
    whenShownForTeacher: text,
    sourceAnchor: text,
    message: text,
  })
  .strict();

export const DraftFixture = z
  .object({
    slot: Slot,
    taskType: z.enum(['JUDGMENT_EVIDENCE', 'EVIDENCE_RANKING', 'COMPARE_TRADEOFF', 'COUNTERARGUMENT', 'OPEN_PROPOSAL']),
    draftVersion: z.number(),
    questionStem: text,
    answerOptions: z
      .array(
        z
          .object({
            answerOptionId: z.string(),
            text,
            answerCorrectness: z.enum(['SUPPORTED_CORRECT', 'CONTRADICTED_INCORRECT', 'INVALID_UNDETERMINED']),
            teacherLabel: text,
            sourceAnchor: text,
            falsifyingSourceRef: z.string().optional(),
            plausibilityRationale: text,
          })
          .strict(),
      )
      .optional(),
    generatedE: z
      .array(
        z
          .object({
            generatedEId: z.string(),
            text,
            qualityRelativeToCorrectA: z.enum(['FULL_SUPPORT', 'PARTIAL_SUPPORT', 'FACTUALLY_FALSE', 'IRRELEVANT']),
            eFactuality: z.enum(['SOURCE_SUPPORTED', 'SOURCE_CONTRADICTED', 'INSUFFICIENT', 'UNVERIFIABLE']),
            eSupportCompleteness: z.enum(['FULL', 'PARTIAL', 'NONE']),
            teacherLabel: text,
            relationNote: text,
            sourceAnchor: text,
            supportSourceEvidenceIds: ids,
            counterSourceEvidenceIds: ids,
            supportExtentRationale: text,
          })
          .strict(),
      )
      .optional(),
    pairAlignments: z
      .array(
        z
          .object({
            answerOptionId: z.string(),
            generatedEId: z.string(),
            pairAlignment: z.enum([
              'SUPPORTS_FULL',
              'SUPPORTS_PARTIAL',
              'CONTRADICTS',
              'SAME_CLAIM_UNSUPPORTED',
              'INSUFFICIENT',
              'IRRELEVANT',
            ]),
            relationLabel: text,
            explanationForTeacher: text,
            sourceEvidenceRefs: ids,
            goesToChallengeLabel: text,
          })
          .strict(),
      )
      .optional(),
    taskBody: z.record(z.string(), z.unknown()).optional(),
    challengeCandidates: z.array(Candidate),
    neutralFallbackId: z.string(),
    displayOrder: z.object({ answers: ids, evidence: ids }).strict().optional(),
    dependencyManifest: z
      .object({ sourceEvidenceIds: ids, sourceUnitIds: ids, sourceClaimIds: ids, relationIds: ids })
      .strict(),
    feedback: z.array(z.object({ optionId: z.string(), relationLabel: text, text }).strict()),
  })
  .strict();
export type DraftFixture = z.infer<typeof DraftFixture>;

export const ReportFixture = z
  .object({
    deterministic: z
      .array(z.object({ checkId: z.string(), label: text, status: z.enum(['PASS', 'FAIL']), affectedIds: ids }).strict()),
    gates: z.array(
      z
        .object({
          gateId: GateId,
          status: GateStatus,
          findingCodes: ids,
          sourceRefs: ids,
          affectedArtifactIds: ids,
          explanationForTeacher: text,
          overridable: z.boolean(),
        })
        .strict(),
    ),
    aggregate: Aggregate,
    candidateSetVersion: z.number(),
  })
  .strict();
export type ReportFixture = z.infer<typeof ReportFixture>;

export const RuleBundleFixture = z
  .object({
    slot: Slot,
    version: z.number(),
    fallbackChallengeId: z.string(),
    candidates: z.array(
      z
        .object({
          challengeId: z.string(),
          label: text,
          priorityOrder: z.number(),
          when: z.object({
            all: z.array(
              z
                .object({
                  field: z.string(),
                  op: z.enum(['eq', 'in']),
                  value: z.union([z.string(), z.array(z.string())]),
                })
                .strict(),
            ),
          }),
          requires: z.object({ message: z.literal(true), targetRef: text }).strict(),
        })
        .strict(),
    ),
  })
  .strict();

export const ScriptedEditsFixture = z.array(
  z
    .object({
      id: z.string(),
      slot: Slot,
      editScope: z.enum(['CONTENT', 'LOGIC']),
      fromDraftVersion: z.number(),
      payload: z
        .object({
          optionId: z.string().optional(),
          text: z.string().optional(),
          challengeId: z.string().optional(),
          message: z.string().optional(),
        })
        .strict(),
      resultDraftFixture: z.string(),
      resultReportFixture: z.string(),
    })
    .strict(),
);

export const SimulateClassFixture = z.array(
  z
    .object({
      participantNumber: z.number(),
      tasks: z.array(
        z
          .object({
            slot: Slot,
            initial: z.record(z.string(), z.unknown()),
            initialConfidence: z.number(),
            choice: z.enum(['KEEP', 'REVISE']),
            final: z.record(z.string(), z.unknown()),
            finalConfidence: z.number(),
          })
          .strict(),
      ),
    })
    .strict(),
);

const draftNames = ['q1-v3', 'q1-v4', 'q2', 'q3', 'q4-v3', 'q4-v4', 'q5'] as const;
const reportNames = draftNames.map((name) => `reports/${name}` as const);
const bundleNames = (['q1', 'q2', 'q3', 'q4', 'q5'] as const).map((name) => `rule-bundles/${name}` as const);

export const FIXTURE_NAMES = [
  'source',
  'issues',
  'sufficiency',
  'scripted-edits',
  'simulate-class',
  ...draftNames,
  ...reportNames,
  ...bundleNames,
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

const schemaFor = (name: FixtureName): z.ZodType => {
  if (name === 'source') return SourceFixture;
  if (name === 'issues') return IssuesFixture;
  if (name === 'sufficiency') return SufficiencyFixture;
  if (name === 'scripted-edits') return ScriptedEditsFixture;
  if (name === 'simulate-class') return SimulateClassFixture;
  if (name.startsWith('reports/')) return ReportFixture;
  if (name.startsWith('rule-bundles/')) return RuleBundleFixture;
  return DraftFixture;
};

export const FIXTURE_SCHEMAS = Object.fromEntries(FIXTURE_NAMES.map((name) => [name, schemaFor(name)])) as Record<
  FixtureName,
  z.ZodType
>;

const FIXTURE_ROOT = '../fixtures/dia-ly-12-bai-8';

/** Relative to this module, for tests and scripts that need the files next to the JSON. */
export const fixtureDir = (locale: 'en' | 'vi'): string =>
  new URL(`${FIXTURE_ROOT}/${locale}`, import.meta.url).href;

export function loadFixture(name: FixtureName, locale: 'en' | 'vi'): unknown {
  const path = fileURLToPath(new URL(`${FIXTURE_ROOT}/${locale}/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}
