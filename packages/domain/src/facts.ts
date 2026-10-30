import type { Artifact } from '@logina/contracts';
import { normalizeText } from './normalize.js';
import type { LockFacts } from './rules.js';
import { buildQ1Facts, type Q1Labels } from './selector.js';

const OTHER_PARTITION = 'other';

function keywordPartition(text: string, partitions: Record<string, string[]>): string {
  const normalized = normalizeText(text).toLowerCase();
  const match = Object.entries(partitions).find(([, words]) => words.some((word) => normalized.includes(word.toLowerCase())));
  return match?.[0] ?? OTHER_PARTITION;
}

/** The observable facts of a locked answer. Q1 is expected in authoring IDs. */
export function buildLockFacts(artifact: Artifact, labels: Q1Labels, keywordPartitions: Record<string, string[]> = {}): LockFacts {
  switch (artifact.slot) {
    case 'Q1':
      return buildQ1Facts(artifact.answerId, artifact.evidenceId, labels);
    case 'Q2': {
      const [firstCard] = artifact.orderedCardIds;
      return firstCard ? { 'q2.firstCardId': firstCard } : {};
    }
    case 'Q3':
      return { 'q3.judgmentOptionId': artifact.judgmentOptionId, 'q3.tradeOffCount': String(artifact.tradeOffIds.length) };
    case 'Q4': {
      const [firstSlot] = artifact.slots;
      return { 'q4.templateId': artifact.templateId, ...(firstSlot ? { 'q4.firstChoiceId': firstSlot.choiceId } : {}) };
    }
    case 'Q5':
      return { 'q5.keywordPartition': keywordPartition(`${artifact.proposal} ${artifact.reason}`, keywordPartitions) };
  }
}
