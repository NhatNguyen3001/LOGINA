import type { Artifact } from '@logina/contracts';
import { normalizeText } from './normalize.js';

export interface ArtifactComparison {
  revised: boolean;
  changedElements: string[];
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

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
    mark('judgment', initial.judgmentOptionId === final.judgmentOptionId);
    mark('tradeOff', initial.tradeOffId === final.tradeOffId);
    mark('reason', initial.reasonId === final.reasonId);
  } else if (initial.slot === 'Q4' && final.slot === 'Q4') {
    const placed = (a: Artifact & { slot: 'Q4' }) => a.placements.map((p) => `${p.slotId}=${p.cardId}`).sort();
    mark('placements', sameJson(placed(initial), placed(final)));
  } else if (initial.slot === 'Q5' && final.slot === 'Q5') {
    const said = (a: Artifact & { slot: 'Q5' }) => a.answers.map((x) => `${x.starterId}=${x.declared ?? normalizeText(x.text)}`).sort();
    mark('answers', sameJson(said(initial), said(final)));
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
