import { CloudTasksClient } from '@google-cloud/tasks';
import type { EnqueueFn } from '../context.js';

type Env = Record<string, string | undefined>;

/** One HTTP task per job. `EXPORT_ROW` has its own throttled queue, because Sheets write quotas are low. */
export function cloudTasksEnqueue(env: Env): EnqueueFn {
  const client = new CloudTasksClient();
  return async (job) => {
    const queue = job.type === 'EXPORT_ROW' ? env.EXPORT_QUEUE : env.TASKS_QUEUE;
    await client.createTask({
      parent: client.queuePath(env.GCP_PROJECT_ID!, env.TASKS_LOCATION!, queue!),
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: `${env.WORKER_URL}/jobs/run`,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify({ jobId: job.jobId, type: job.type })).toString('base64'),
          oidcToken: { serviceAccountEmail: env.TASKS_INVOKER_SA!, audience: env.WORKER_URL! },
        },
      },
    });
  };
}
