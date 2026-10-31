import { describe, expect, it } from 'vitest';
import { aggregateGates, type QualityGate } from '../src/gates.js';

const gate = (status: QualityGate['status']): QualityGate => ({
  gateId: 'QG1',
  status,
  findingCodes: [],
  sourceRefs: [],
  affectedArtifactIds: [],
  explanationForTeacher: 'x',
  validatorVersion: 'xreason@0+seeded',
  checkedHash: 'h',
  overridable: status === 'REVIEW_REQUIRED',
});
const pass = { status: 'PASS' as const };

describe('aggregateGates', () => {
  it('all passing is MACHINE_PASS', () => {
    expect(aggregateGates([gate('PASS')], [pass])).toBe('MACHINE_PASS');
  });

  it('QA03 REVIEW_REQUIRED never aggregates to MACHINE_PASS', () => {
    expect(aggregateGates([gate('PASS'), gate('REVIEW_REQUIRED')], [pass])).toBe('REVIEW_REQUIRED');
  });

  it('a gate BLOCKER aggregates to BLOCKED', () => {
    expect(aggregateGates([gate('REVIEW_REQUIRED'), gate('BLOCKER')], [pass])).toBe('BLOCKED');
  });

  it('VC02 deterministic FAIL aggregates to BLOCKED', () => {
    expect(aggregateGates([gate('PASS')], [{ status: 'FAIL' }])).toBe('BLOCKED');
  });
});
