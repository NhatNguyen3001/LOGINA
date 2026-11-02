import type { Artifact } from '@logina/contracts';
import { normalizeText } from './normalize.js';
import type { LockFacts } from './rules.js';
import { buildQ1Facts, type Q1Labels } from './selector.js';

const hasKeyword = (text: string, words: string[]): boolean => {
  const normalized = normalizeText(text).toLowerCase();
  return words.some((word) => normalized.includes(word.toLowerCase()));
};

/** The observable facts of a locked answer. Q1 is expected in authoring IDs. */
/** The scoring data in a release's server-only body. */
export interface ServerBody {
  keywordPartitions?: Record<string, string[]>;
  supportedReasons?: string[];
  slotFits?: Record<string, string[]>;
}

export function buildLockFacts(artifact: Artifact, labels: Q1Labels, { keywordPartitions = {}, supportedReasons = [], slotFits = {} }: ServerBody = {}): LockFacts {
  switch (artifact.slot) {
    case 'Q1':
      return buildQ1Facts(artifact.answerId, artifact.evidenceId, labels);
    case 'Q2': {
      const [firstCard] = artifact.orderedCardIds;
      return firstCard ? { 'q2.firstCardId': firstCard } : {};
    }
    case 'Q3':
      return { 'q3.judgmentOptionId': artifact.judgmentOptionId, 'q3.tradeOffId': artifact.tradeOffId, 'q3.reasonSupported': String(supportedReasons.includes(artifact.reasonId)) };
    case 'Q4': {
      const misfit = artifact.placements.find(({ slotId, cardId }) => !slotFits[slotId]?.includes(cardId));
      return { 'q4.misfitSlotId': misfit?.slotId ?? 'none' };
    }
    case 'Q5':
      return { 'q5.openStarterId': artifact.answers.find((a) => a.declared || !hasKeyword(a.text, keywordPartitions[a.starterId] ?? []))?.starterId ?? 'none' };
  }
}
