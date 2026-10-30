import type { Condition, LockFacts, RuleBundle, RuleCandidate } from './rules.js';

export interface Selection {
  challengeId: string;
  mode: 'NORMAL' | 'FALLBACK';
  evaluations: { challengeId: string; matched: boolean }[];
}

export interface Q1Labels {
  answers: Record<string, string>;
  evidence: Record<string, string>;
  pairs: Record<string, string>;
}

function conditionHolds(condition: Condition, facts: LockFacts): boolean {
  const fact = facts[condition.field];
  if (fact === undefined) return false;
  return Array.isArray(condition.value) ? condition.value.includes(fact) : condition.value === fact;
}

const matches = (candidate: RuleCandidate, facts: LockFacts): boolean =>
  candidate.when.all.every((condition) => conditionHolds(condition, facts));

/** Pure code over the pinned bundle: no AI at student time. */
export function selectChallenge(bundle: RuleBundle, facts: LockFacts): Selection {
  const evaluations = bundle.candidates.map((c) => ({ challengeId: c.challengeId, matched: matches(c, facts) }));
  const [chosen] = bundle.candidates
    .filter((c) => matches(c, facts) && c.requires.targetRef !== '')
    .sort((a, b) => a.priorityOrder - b.priorityOrder);

  return chosen
    ? { challengeId: chosen.challengeId, mode: 'NORMAL', evaluations }
    : { challengeId: bundle.fallbackChallengeId, mode: 'FALLBACK', evaluations };
}

export function buildQ1Facts(answerId: string, evidenceId: string, labels: Q1Labels): LockFacts {
  const facts: LockFacts = { answerId, evidenceId };
  const answerCorrectness = labels.answers[answerId];
  const eQuality = labels.evidence[evidenceId];
  const pairAlignment = labels.pairs[`${answerId}__${evidenceId}`];
  if (answerCorrectness !== undefined) facts.answerCorrectness = answerCorrectness;
  if (eQuality !== undefined) facts.eQuality = eQuality;
  if (pairAlignment !== undefined) facts.pairAlignment = pairAlignment;
  return facts;
}

/** Every combination must yield one challenge, normal or fallback. */
export function checkCoverage(bundle: RuleBundle, allFactCombos: LockFacts[]): { ok: boolean; uncovered: LockFacts[] } {
  const uncovered = allFactCombos.filter((facts) => selectChallenge(bundle, facts).challengeId === '');
  return { ok: uncovered.length === 0, uncovered };
}
