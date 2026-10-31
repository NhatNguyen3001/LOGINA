import type { Artifact } from '@logina/contracts';
import { normalizeText } from './normalize.js';

export interface ArtifactComparison {
  revised: boolean;
  changedElements: string[];
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const sorted = (items: string[]): string[] => [...items].sort();

function changedElements(initial: Artifact, final: Artifact): string[] {
  const changed: string[] = [];
  const mark = (name: string, same: boolean): void => {
    if (!same) changed.push(name);
  };

  if (initial.slot === 'Q1' && final.slot === 'Q1') {
    mark('answer', initial.answerId === final.answerId);
    mark('evidence', initial.evidenceId === final.evidenceId);
  } else if (initial.slot === 'Q2' && final.slot === 'Q2') {
    mark('order', sameJson(initial.orderedCardIds, final.orderedCardIds));
  } else if (initial.slot === 'Q3' && final.slot === 'Q3') {
    const byCriterion = (a: Artifact & { slot: 'Q3' }) =>
      [...a.comparisons].sort((x, y) => x.criterionId.localeCompare(y.criterionId));
    mark('comparisons', sameJson(byCriterion(initial), byCriterion(final)));
    mark('judgment', initial.judgmentOptionId === final.judgmentOptionId);
    mark('tradeOffs', sameJson(sorted(initial.tradeOffIds), sorted(final.tradeOffIds)));
  } else if (initial.slot === 'Q4' && final.slot === 'Q4') {
    mark('template', initial.templateId === final.templateId);
    const active = (a: Artifact & { slot: 'Q4' }) =>
      a.slots
        .filter((s) => !a.activeSlotIds || a.activeSlotIds.includes(s.slotId))
        .map((s) => `${s.slotId}=${s.choiceId}`)
        .sort();
    if (initial.templateId === final.templateId) mark('slots', sameJson(active(initial), active(final)));
  } else if (initial.slot === 'Q5' && final.slot === 'Q5') {
    mark('proposal', normalizeText(initial.proposal) === normalizeText(final.proposal));
    mark('reason', normalizeText(initial.reason) === normalizeText(final.reason));
    mark('basis', normalizeText(initial.basis ?? '') === normalizeText(final.basis ?? ''));
  } else {
    throw new Error(`compareArtifacts: slot mismatch ${initial.slot} and ${final.slot}`);
  }
  return changed;
}

/** Canonical comparison for KEEP or REVISE (05-Backend-Schema section 6). Confidence never counts. */
export function compareArtifacts(initial: Artifact, final: Artifact): ArtifactComparison {
  const changed = changedElements(initial, final);
  return { revised: changed.length > 0, changedElements: changed };
}
