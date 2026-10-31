import type { Slot } from '@logina/contracts';

export interface ClosureDraft {
  taskDraftId: string;
  slot: Slot;
  manifest: {
    sourceEvidenceIds: string[];
    sourceClaimIds: string[];
    sourceUnitIds: string[];
    relationIds: string[];
  };
}

/** Which drafts depend on the changed refs (P0-04). Only actual dependencies count. */
export function dependencyClosure(
  changedRefs: string[],
  drafts: ClosureDraft[],
): { affectedDraftIds: string[]; unaffectedDraftIds: string[] } {
  const changed = new Set(changedRefs);
  const isAffected = ({ manifest }: ClosureDraft): boolean =>
    [...manifest.sourceEvidenceIds, ...manifest.sourceClaimIds, ...manifest.sourceUnitIds, ...manifest.relationIds].some(
      (ref) => changed.has(ref),
    );

  return {
    affectedDraftIds: drafts.filter(isAffected).map((d) => d.taskDraftId),
    unaffectedDraftIds: drafts.filter((d) => !isAffected(d)).map((d) => d.taskDraftId),
  };
}
