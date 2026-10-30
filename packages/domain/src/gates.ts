import type { Aggregate, GateId, GateStatus } from '@logina/contracts';

/** v2.1.2b section 4 (05-Backend-Schema section 5). */
export interface QualityGate {
  gateId: GateId;
  status: GateStatus;
  findingCodes: string[];
  sourceRefs: string[];
  affectedArtifactIds: string[];
  explanationForTeacher: string;
  validatorVersion: string;
  checkedHash: string;
  overridable: boolean;
}

export function aggregateGates(gates: QualityGate[], deterministic: { status: 'PASS' | 'FAIL' }[]): Aggregate {
  if (deterministic.some((c) => c.status === 'FAIL') || gates.some((g) => g.status === 'BLOCKER')) return 'BLOCKED';
  if (gates.some((g) => g.status === 'REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  return 'MACHINE_PASS';
}
