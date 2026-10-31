import mammoth from 'mammoth';

export async function docxToText(buffer: Buffer): Promise<{ text: string; wordCount: number }> {
  const { value } = await mammoth.extractRawText({ buffer });
  return { text: value, wordCount: value.split(/\s+/).filter(Boolean).length };
}
