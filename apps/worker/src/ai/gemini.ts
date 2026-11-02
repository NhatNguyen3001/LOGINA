import { GoogleGenAI, type ThinkingLevel } from '@google/genai';
import type { GenaiClient } from './model.js';

/** Vertex AI with the service account's identity. Model IDs are exact, never aliases. */
export function vertexGenai(project: string, location: string): GenaiClient {
  const client = new GoogleGenAI({ vertexai: true, project, location });
  return {
    generate: async ({ model, parts, responseSchema, thinking, onThought }) => {
      const contents = [{ role: 'user', parts }];
      const config = { responseMimeType: 'application/json', responseJsonSchema: responseSchema };
      if (!thinking) return (await client.models.generateContent({ model, contents, config })).text ?? '';

      const stream = await client.models.generateContentStream({
        model,
        contents,
        config: { ...config, thinkingConfig: { includeThoughts: true, thinkingLevel: thinking as ThinkingLevel } },
      });
      let answer = '';
      let thought = '';
      /** A thought can arrive in pieces; the next bold title means the last one is whole. */
      const finishThought = async (): Promise<void> => {
        if (thought.trim()) await onThought?.(thought);
        thought = '';
      };
      for await (const chunk of stream) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (!part.thought) answer += part.text ?? '';
          else {
            if (part.text?.startsWith('**')) await finishThought();
            thought += part.text ?? '';
          }
        }
      }
      await finishThought();
      return answer;
    },
  };
}
