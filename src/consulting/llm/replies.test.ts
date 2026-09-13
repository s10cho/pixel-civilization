import { describe, expect, it } from 'vitest';
import { replyText } from './replies';

describe('finding the answer in a reply', () => {
  it('reads the relay answering with the finished object', () => {
    const text = replyText({ note: 'All well.', picks: [{ id: 'green:1:1', why: 'x' }] });
    expect(JSON.parse(text!).note).toBe('All well.');
  });

  it('reads Anthropic content blocks', () => {
    expect(replyText({ content: [{ type: 'text', text: '{"note":"a"}' }] })).toBe('{"note":"a"}');
  });

  it('reads Gemini candidates', () => {
    const payload = {
      candidates: [{ content: { role: 'model', parts: [{ text: '{"note":"b","picks":[]}' }] }, finishReason: 'STOP' }],
    };
    expect(replyText(payload)).toBe('{"note":"b","picks":[]}');
  });

  it('runs several parts of one Gemini answer together', () => {
    const payload = { candidates: [{ content: { parts: [{ text: '{"note":' }, { text: '"c"}' }] } }] };
    expect(replyText(payload)).toBe('{"note":\n"c"}');
  });

  it('gives up on a shape it does not know', () => {
    expect(replyText(null)).toBeNull();
    expect(replyText({})).toBeNull();
    // Gemini stopping without any text at all, e.g. on a token budget.
    expect(replyText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] })).toBeNull();
    expect(replyText({ promptFeedback: { blockReason: 'SAFETY' } })).toBeNull();
  });
});
