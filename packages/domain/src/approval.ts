import type { Aggregate, TaskStatus } from '@logina/contracts';
import type { QualityGate } from './gates.js';

export type ApprovalBlock =
  | 'STALE_VERSION'
  | 'PREVIEW_HASH_MISMATCH'
  | 'CANDIDATE_SET_CHANGED'
  | 'NOT_VALIDATED'
  | 'BLOCKER_PRESENT'
  | 'UNDISPOSITIONED_REVIEW'
  | 'NON_OVERRIDABLE_ACCEPT'
  | 'SOURCE_NOT_APPROVED'
  | 'NOT_EDITOR'
  | 'NOT_CONFIRMED'
  | 'MISSING_ALT_TEXT';

export interface ApprovalInput {
  draft: { draftVersion: number; status: TaskStatus; sourceModelVersionId: string };
  expectedDraftVersion: number;
  report: { aggregate: Aggregate; previewHash: string; candidateSetVersion: number; gates: QualityGate[] };
  submittedPreviewHash: string;
  latestCandidateSetVersion: number;
  dispositions: { gateId: string; findingCode: string; decision: 'REVISE_AND_RERUN' | 'TEACHER_ACCEPT_WITH_REASON' }[];
  sourceApproved: boolean;
  actorIsEditor: boolean;
  confirmed: boolean;
  missingAltTextRefs: string[];
}

export type ApprovalResult = { ok: true } | { ok: false; reasons: ApprovalBlock[] };

/** The G3 guard (05-Backend-Schema section 7). Collects every reason. */
export function checkApproval(input: ApprovalInput): ApprovalResult {
  const reasons = new Set<ApprovalBlock>();
  const { draft, report } = input;

  if (input.expectedDraftVersion !== draft.draftVersion) reasons.add('STALE_VERSION');
  if (input.submittedPreviewHash !== report.previewHash) reasons.add('PREVIEW_HASH_MISMATCH');
  if (input.latestCandidateSetVersion !== report.candidateSetVersion) reasons.add('CANDIDATE_SET_CHANGED');
  if (draft.status !== 'MACHINE_PASS' && draft.status !== 'REVIEW_REQUIRED') reasons.add('NOT_VALIDATED');
  if (report.aggregate === 'BLOCKED' || report.gates.some((g) => g.status === 'BLOCKER')) reasons.add('BLOCKER_PRESENT');

  for (const gate of report.gates.filter((g) => g.status === 'REVIEW_REQUIRED')) {
    for (const findingCode of gate.findingCodes) {
      const accepted = input.dispositions.some(
        (d) =>
          d.gateId === gate.gateId && d.findingCode === findingCode && d.decision === 'TEACHER_ACCEPT_WITH_REASON',
      );
      if (!accepted) reasons.add('UNDISPOSITIONED_REVIEW');
      else if (!gate.overridable) reasons.add('NON_OVERRIDABLE_ACCEPT');
    }
  }

  if (!input.sourceApproved) reasons.add('SOURCE_NOT_APPROVED');
  if (!input.actorIsEditor) reasons.add('NOT_EDITOR');
  if (!input.confirmed) reasons.add('NOT_CONFIRMED');
  if (input.missingAltTextRefs.length > 0) reasons.add('MISSING_ALT_TEXT');

  return reasons.size === 0 ? { ok: true } : { ok: false, reasons: [...reasons] };
}
