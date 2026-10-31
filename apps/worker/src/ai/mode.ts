export type AiPath = 'SEEDED' | 'LIVE' | 'LIVE_DISABLED';

/** `lessons.aiMode` decides. `SEEDED_AI=true` is a test and local-dev override only. */
export function resolveAiMode(lesson: { aiMode: string }, config: { seededAi: boolean }): AiPath {
  if (lesson.aiMode === 'SEEDED') return 'SEEDED';
  return config.seededAi ? 'LIVE_DISABLED' : 'LIVE';
}
