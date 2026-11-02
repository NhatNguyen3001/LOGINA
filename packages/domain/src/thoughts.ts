export interface Thought {
  title: string;
  text: string;
}

const MAX_CHARS = 400;

/** Gemini opens a thought with a bold title. Long ones are cut so a job document stays small. */
export function parseThought(raw: string): Thought {
  const [, title = '', body = raw] = /^\*\*(.+?)\*\*\s*([\s\S]*)$/.exec(raw.trim()) ?? [];
  return { title: title.slice(0, MAX_CHARS), text: body.trim().slice(0, MAX_CHARS) };
}
