import type { GenaiClient, GenerateRequest } from '../../src/ai/model.js';

export interface StubGenai extends GenaiClient {
  calls: GenerateRequest[];
}

/** Records every request and answers per role from `responses`. A function can throw to simulate failure. */
export function stubGenai(responses: Record<string, unknown | (() => unknown)> = {}): StubGenai {
  const calls: GenerateRequest[] = [];
  return {
    calls,
    generate: async (request) => {
      calls.push(request);
      if (!(request.role in responses)) throw new Error(`No stub for ${request.role}`);
      const answer = responses[request.role];
      return JSON.stringify(typeof answer === 'function' ? await (answer as () => unknown)() : answer);
    },
  };
}
