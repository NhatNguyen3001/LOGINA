import type { Artifact, ResearchRow } from '@logina/contracts';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

/** Random, never derived from anything about the person. Not a credential. */
export function newParticipantCode(random: () => number = Math.random): string {
  const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]);
  return `P-${code.join('')}`;
}

export const materialHash = (sha256: string): string => sha256.slice(0, 12);

const RELATION = {
  SUPPORTS_FULL: 'full',
  SUPPORTS_PARTIAL: 'partial',
  CONTRADICTS: 'contradicts',
  SAME_CLAIM_UNSUPPORTED: 'contradicts',
  INSUFFICIENT: 'irrelevant',
  IRRELEVANT: 'irrelevant',
} as const;

export const relationBucket = (pairAlignment: string): (typeof RELATION)[keyof typeof RELATION] =>
  RELATION[pairAlignment as keyof typeof RELATION] ?? 'irrelevant';

/** `2026-11-02 14:03:10`, in UTC+7. */
export const researchTime = (date: Date): string =>
  date.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

export interface Q1Letters {
  answerLetter: (runtimeId: string) => string;
  cardLabel: (runtimeId: string) => string;
  answerAuthoring: (runtimeId: string) => string;
  evidenceAuthoring: (runtimeId: string) => string;
  relation: (answerRuntimeId: string, evidenceRuntimeId: string) => string;
}

export interface AnswerColumns {
  answer: string;
  evidence: string | null;
  relation: string | null;
}

/** Q1 stays one row: letter with authoring label. Q5 keeps the full text as typed. */
export function answerColumns(artifact: Artifact, letters: Q1Letters): AnswerColumns {
  switch (artifact.slot) {
    case 'Q1':
      return {
        answer: `${letters.answerLetter(artifact.answerId)} (${letters.answerAuthoring(artifact.answerId)})`,
        evidence: `${letters.cardLabel(artifact.evidenceId)} (${letters.evidenceAuthoring(artifact.evidenceId)})`,
        relation: letters.relation(artifact.answerId, artifact.evidenceId),
      };
    case 'Q2':
      return { answer: artifact.orderedCardIds.join(' > '), evidence: null, relation: null };
    case 'Q3': {
      const comparisons = artifact.comparisons.map((c) => `${c.criterionId}=${c.value}`).join(', ');
      return { answer: `${artifact.judgmentOptionId}; ${comparisons}; accepts ${artifact.tradeOffIds.join(', ') || 'none'}`, evidence: null, relation: null };
    }
    case 'Q4':
      return { answer: `${artifact.templateId}: ${artifact.slots.map((s) => s.choiceId).join(', ')}`, evidence: null, relation: null };
    case 'Q5':
      return { answer: `${artifact.proposal} | ${artifact.reason}`, evidence: null, relation: null };
  }
}

export type ResearchInput = Omit<
  ResearchRow,
  'first_answer' | 'first_evidence' | 'first_relation' | 'final_answer' | 'final_evidence' | 'final_relation' | 'confidence_change'
> & { first: AnswerColumns; final: AnswerColumns };

export function buildResearchRow({ first, final, ...row }: ResearchInput): ResearchRow {
  return {
    ...row,
    first_answer: first.answer,
    first_evidence: first.evidence,
    first_relation: first.relation,
    final_answer: final.answer,
    final_evidence: final.evidence,
    final_relation: final.relation,
    confidence_change: row.final_confidence - row.first_confidence,
  };
}
