import { describe, expect, it } from 'vitest';
import { parseThought } from '../src/thoughts.js';

describe('parseThought', () => {
  it('splits the bold title from the body', () => {
    expect(parseThought('**Checking the table**\n\nThe shares add up.\n')).toEqual({ title: 'Checking the table', text: 'The shares add up.' });
  });

  it('keeps a thought with no title as body text', () => {
    expect(parseThought('Just a sentence.')).toEqual({ title: '', text: 'Just a sentence.' });
  });

  it('keeps a title with no body', () => {
    expect(parseThought('**Addressing gaps**\n\n')).toEqual({ title: 'Addressing gaps', text: '' });
  });

  it('cuts a long thought', () => {
    expect(parseThought(`**T**\n\n${'a'.repeat(900)}`).text).toHaveLength(400);
  });
});
