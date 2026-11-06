import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { JobDTO } from '@logina/contracts';
import { toJobDTO, type JobDoc } from '../src/services/jobs.js';

describe('job DTO', () => {
  it('job DTO lists AI waits', () => {
    const retryAt = new Date('2026-11-06T05:07:30.000Z');
    const doc = {
      id: 'job_1',
      schoolId: 's',
      lessonId: 'l',
      type: 'GENERATE',
      status: 'RUNNING',
      steps: [],
      targetIds: [],
      waits: { 'draft Q3': { step: 'draft Q3', attempt: 2, of: 4, retryAt: Timestamp.fromDate(retryAt) } },
    } as JobDoc;
    const dto = JobDTO.parse(toJobDTO(doc));
    expect(dto.waits).toEqual([{ step: 'draft Q3', attempt: 2, of: 4, retryAt: retryAt.toISOString() }]);
  });

  it('a job with no waits has no waits field', () => {
    const doc = { id: 'job_1', schoolId: 's', lessonId: 'l', type: 'GENERATE', status: 'RUNNING', steps: [], targetIds: [], waits: {} } as JobDoc;
    expect(toJobDTO(doc)).not.toHaveProperty('waits');
  });
});
