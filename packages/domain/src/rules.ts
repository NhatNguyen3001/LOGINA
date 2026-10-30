import type { Slot } from '@logina/contracts';

export type FactField =
  | 'answerId'
  | 'evidenceId'
  | 'answerCorrectness'
  | 'eQuality'
  | 'pairAlignment'
  | 'q2.firstCardId'
  | 'q3.judgmentOptionId'
  | 'q4.templateId'
  | 'q5.keywordPartition';

export interface Condition {
  field: FactField;
  op: 'eq' | 'in';
  value: string | string[];
}

export interface RuleCandidate {
  challengeId: string;
  label: string;
  priorityOrder: number;
  when: { all: Condition[] };
  requires: { message: true; targetRef: string };
}

export interface RuleBundle {
  ruleBundleId: string;
  slot: Slot;
  candidates: RuleCandidate[];
  fallbackChallengeId: string;
  version: number;
}

export type LockFacts = Partial<Record<FactField, string>>;
