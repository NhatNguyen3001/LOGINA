import { GoogleGenAI } from '@google/genai';
import type { GenaiClient } from './model.js';

/** Vertex AI with the service account's identity. Model IDs are exact, never aliases. */
export function vertexGenai(project: string, location: string): GenaiClient {
  const client = new GoogleGenAI({ vertexai: true, project, location });
  return {
    generate: async ({ model, parts, responseSchema }) => {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json', responseJsonSchema: responseSchema },
      });
      return response.text ?? '';
    },
  };
}
