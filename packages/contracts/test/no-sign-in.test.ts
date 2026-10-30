import { describe, expect, it } from 'vitest';
import { examples } from '../src/examples/index.js';
import {
  ConsentReq,
  ConsentResultDTO,
  CURRENT_CONSENT_VERSION,
  JobType,
  LimitsDTO,
  MeDTO,
  RateAction,
  RateLimitDTO,
  RESEARCH_COLUMNS,
  ResearchRow,
  Role,
} from '../src/index.js';

const row = {
  row_id: 'att_1_Q1',
  participant_code: 'P-7K2M',
  participant_type: 'judge',
  is_simulated: false,
  consent_version: '2026-10-v1',
  consent_at: '2026-11-02 14:03:10',
  interface_language: 'en',
  material_hash: 'a3f9c2e81b04',
  material_title: 'Labor and Employment sample',
  run_number: 1,
  lesson_id: 'les_1',
  lesson_type: 'SEEDED',
  content_language: 'en',
  task: 'Q1',
  task_type: 'JUDGMENT_EVIDENCE',
  release: 'r4',
  first_answer: 'B (A2)',
  first_evidence: 'Card 3 (E3)',
  first_relation: 'contradicts',
  first_confidence: 70,
  locked_at: '2026-11-02 14:05:00',
  prompt_label: 'TN1',
  prompt_mode: 'NORMAL',
  choice: 'REVISE',
  changed: 'answer, evidence',
  final_answer: 'A (A1)',
  final_evidence: 'Card 1 (E1)',
  final_relation: 'full',
  final_confidence: 82,
  confidence_change: 12,
  submitted_at: '2026-11-02 14:07:20',
  seconds_to_lock: 95,
  seconds_to_submit: 140,
};

describe('rate limits', () => {
  it('RateAction has the four action limits', () => {
    expect(RateAction.options).toEqual(['UPLOAD', 'AI_ACTION', 'SIMULATE_CLASS', 'RESET']);
  });

  it('RateLimitDTO rejects a stack key', () => {
    expect(() => RateLimitDTO.parse({ ...examples.rateLimit, stack: 'x' })).toThrow();
  });

  it('RateLimitDTO allows API and SESSION as 429 actions', () => {
    expect(() => RateLimitDTO.parse({ ...examples.rateLimit, action: 'API' })).not.toThrow();
    expect(() => RateLimitDTO.parse({ ...examples.rateLimit, action: 'SESSION' })).not.toThrow();
    expect(() => RateLimitDTO.parse({ ...examples.rateLimit, action: 'OTHER' })).toThrow();
  });

  it('LimitsDTO never carries the 429-only actions', () => {
    const limit = examples.limits.limits[0]!;
    expect(() => LimitsDTO.parse({ limits: [{ ...limit, action: 'UPLOAD' }] })).not.toThrow();
    expect(() => LimitsDTO.parse({ limits: [{ ...limit, action: 'API' }] })).toThrow();
    expect(() => LimitsDTO.parse({ limits: [{ ...limit, action: 'SESSION' }] })).toThrow();
  });
});

describe('consent', () => {
  it('ConsentReq accepts AGREED or DECLINED only', () => {
    const body = { consentVersion: CURRENT_CONSENT_VERSION };
    expect(() => ConsentReq.parse({ ...body, choice: 'AGREED' })).not.toThrow();
    expect(() => ConsentReq.parse({ ...body, choice: 'DECLINED' })).not.toThrow();
    expect(() => ConsentReq.parse({ ...body, choice: 'MAYBE' })).toThrow();
  });

  it('ConsentResultDTO carries a participant code only as an option', () => {
    expect(() => ConsentResultDTO.parse({ consent: 'DECLINED' })).not.toThrow();
    expect(() => ConsentResultDTO.parse({ consent: 'AGREED', participantCode: 'P-7K2M' })).not.toThrow();
  });

  it('the current consent version is 2026-10-v1', () => {
    expect(CURRENT_CONSENT_VERSION).toBe('2026-10-v1');
  });

  it('MeDTO has no dataNoticeRequired', () => {
    expect(Object.keys(MeDTO.shape)).not.toContain('dataNoticeRequired');
    expect(Object.keys(MeDTO.shape)).not.toContain('currentNoticeVersion');
    expect(() => MeDTO.parse({ ...examples.me, dataNoticeRequired: true })).toThrow();
  });

  it('MeDTO requires consentRequired and currentConsentVersion', () => {
    expect(Object.keys(MeDTO.shape)).toEqual(expect.arrayContaining(['consentRequired', 'currentConsentVersion']));
    expect(examples.me.currentConsentVersion).toBe(CURRENT_CONSENT_VERSION);
  });
});

describe('roles and jobs', () => {
  it('Role allows demo', () => {
    expect(Role.options).toContain('demo');
  });

  it('JobType includes EXPORT_ROW', () => {
    expect(JobType.options).toContain('EXPORT_ROW');
  });
});

describe('research rows', () => {
  it('RESEARCH_COLUMNS starts with row_id and contains run_number, material_hash and is_simulated', () => {
    expect(RESEARCH_COLUMNS[0]).toBe('row_id');
    expect(RESEARCH_COLUMNS).toEqual(expect.arrayContaining(['run_number', 'material_hash', 'is_simulated']));
  });

  it('RESEARCH_COLUMNS follow the design order', () => {
    expect(RESEARCH_COLUMNS).toEqual(Object.keys(row));
  });

  it('ResearchRow has exactly the research columns', () => {
    expect(ResearchRow.parse(row)).toEqual(row);
    expect(Object.keys(ResearchRow.shape)).toEqual([...RESEARCH_COLUMNS]);
  });

  it('ResearchRow rejects displayName and email keys', () => {
    expect(() => ResearchRow.parse({ ...row, displayName: 'An' })).toThrow();
    expect(() => ResearchRow.parse({ ...row, email: 'a@example.com' })).toThrow();
  });

  it('ResearchRow keeps is_simulated a boolean, and exportedAt stays out', () => {
    expect(() => ResearchRow.parse({ ...row, is_simulated: 'TRUE' })).toThrow();
    expect(() => ResearchRow.parse({ ...row, exportedAt: null })).toThrow();
  });

  it('Q1-only columns can be empty for Q2 to Q5', () => {
    const q2 = { ...row, task: 'Q2', first_evidence: null, first_relation: null, final_evidence: null, final_relation: null };
    expect(() => ResearchRow.parse(q2)).not.toThrow();
  });
});
