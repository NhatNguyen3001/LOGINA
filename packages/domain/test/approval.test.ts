import { describe, expect, it } from 'vitest';
import { checkApproval, type ApprovalInput } from '../src/approval.js';
import type { QualityGate } from '../src/gates.js';

const gate = (over: Partial<QualityGate>): QualityGate => ({
  gateId: 'QG3',
  status: 'PASS',
  findingCodes: [],
  sourceRefs: [],
  affectedArtifactIds: [],
  explanationForTeacher: 'x',
  validatorVersion: 'v',
  checkedHash: 'h',
  overridable: false,
  ...over,
});

const input = (over: Partial<ApprovalInput> = {}): ApprovalInput => ({
  draft: { draftVersion: 4, status: 'MACHINE_PASS', sourceModelVersionId: 'smv_1' },
  expectedDraftVersion: 4,
  report: { aggregate: 'MACHINE_PASS', previewHash: 'p1', candidateSetVersion: 2, gates: [gate({})] },
  submittedPreviewHash: 'p1',
  latestCandidateSetVersion: 2,
  dispositions: [],
  sourceApproved: true,
  actorIsEditor: true,
  confirmed: true,
  missingAltTextRefs: [],
  ...over,
});

const reasons = (over: Partial<ApprovalInput>): string[] => {
  const result = checkApproval(input(over));
  return result.ok ? [] : result.reasons;
};

const review = gate({ status: 'REVIEW_REQUIRED', findingCodes: ['DISTRACTOR_IMPLAUSIBLE'], overridable: true });
const reviewReport = { aggregate: 'REVIEW_REQUIRED' as const, previewHash: 'p1', candidateSetVersion: 2, gates: [review] };
const reviewDraft = { draftVersion: 4, status: 'REVIEW_REQUIRED' as const, sourceModelVersionId: 'smv_1' };

describe('checkApproval', () => {
  it('approves MACHINE_PASS current version', () => {
    expect(checkApproval(input())).toEqual({ ok: true });
  });

  it('R04 approve with stale draftVersion rejected', () => {
    expect(reasons({ expectedDraftVersion: 3 })).toContain('STALE_VERSION');
  });

  it('VC09 preview hash mismatch rejected', () => {
    expect(reasons({ submittedPreviewHash: 'old' })).toContain('PREVIEW_HASH_MISMATCH');
  });

  it.each(['STALE', 'VALIDATING', 'FAILED', 'BLOCKED', 'GENERATING', 'SUPERSEDED', 'APPROVED'] as const)(
    'X10 %s draft rejected',
    (status) => {
      expect(reasons({ draft: { draftVersion: 4, status, sourceModelVersionId: 'smv_1' } })).toContain('NOT_VALIDATED');
    },
  );

  it('QA13 accepting a BLOCKER is rejected', () => {
    const blocker = gate({ status: 'BLOCKER', findingCodes: ['LEAK'] });
    expect(
      reasons({
        report: { aggregate: 'BLOCKED', previewHash: 'p1', candidateSetVersion: 2, gates: [blocker] },
        dispositions: [{ gateId: 'QG3', findingCode: 'LEAK', decision: 'TEACHER_ACCEPT_WITH_REASON' }],
      }),
    ).toContain('BLOCKER_PRESENT');
  });

  it('QA12 accepted overridable warning allows approval', () => {
    expect(
      checkApproval(
        input({
          draft: reviewDraft,
          report: reviewReport,
          dispositions: [{ gateId: 'QG3', findingCode: 'DISTRACTOR_IMPLAUSIBLE', decision: 'TEACHER_ACCEPT_WITH_REASON' }],
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('an undecided warning is rejected', () => {
    expect(reasons({ draft: reviewDraft, report: reviewReport })).toContain('UNDISPOSITIONED_REVIEW');
  });

  it('a warning marked revise, not accepted, is rejected', () => {
    expect(
      reasons({
        draft: reviewDraft,
        report: reviewReport,
        dispositions: [{ gateId: 'QG3', findingCode: 'DISTRACTOR_IMPLAUSIBLE', decision: 'REVISE_AND_RERUN' }],
      }),
    ).toContain('UNDISPOSITIONED_REVIEW');
  });

  it('accepting a non-overridable warning is rejected', () => {
    const fixed = { ...review, overridable: false };
    expect(
      reasons({
        draft: reviewDraft,
        report: { ...reviewReport, gates: [fixed] },
        dispositions: [{ gateId: 'QG3', findingCode: 'DISTRACTOR_IMPLAUSIBLE', decision: 'TEACHER_ACCEPT_WITH_REASON' }],
      }),
    ).toContain('NON_OVERRIDABLE_ACCEPT');
  });

  it('QA16 candidate set changed since preview rejected', () => {
    expect(reasons({ latestCandidateSetVersion: 3 })).toContain('CANDIDATE_SET_CHANGED');
  });

  it('requires explicit confirmation', () => {
    expect(reasons({ confirmed: false })).toContain('NOT_CONFIRMED');
  });

  it('source must be approved and the actor an editor', () => {
    expect(reasons({ sourceApproved: false, actorIsEditor: false })).toEqual(
      expect.arrayContaining(['SOURCE_NOT_APPROVED', 'NOT_EDITOR']),
    );
  });

  it('F-L8 approval blocked while a task figure has no altText', () => {
    expect(reasons({ missingAltTextRefs: ['fig_1'] })).toContain('MISSING_ALT_TEXT');
  });

  it('collects every reason', () => {
    expect(reasons({ expectedDraftVersion: 3, confirmed: false, missingAltTextRefs: ['f'] })).toHaveLength(3);
  });
});
