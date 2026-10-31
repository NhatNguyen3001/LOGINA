import { describe, expect, it, vi } from 'vitest';
import { cloudTasksEnqueue } from '../src/jobs/enqueue.js';

const createTask = vi.hoisted(() => vi.fn(async () => [{}]));
vi.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: class {
    createTask = createTask;
    queuePath = () => 'queue';
  },
}));

describe('cloudTasksEnqueue', () => {
  it('gives a job longer than the worker deadline, so a slow job is not started twice', async () => {
    await cloudTasksEnqueue({ WORKER_URL: 'https://worker', TASKS_QUEUE: 'q' })({ jobId: 'job_1', type: 'GENERATE', lessonId: 'l', targetIds: [] });
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ task: expect.objectContaining({ dispatchDeadline: { seconds: 1800 } }) }));
  });
});
