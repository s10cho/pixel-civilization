import { describe, expect, it } from 'vitest';
import { MAX_NOTE_LENGTH, MAX_PICKS, parseReply } from './prompt';

const allowed = new Set(['housing:3:4', 'green:9:9', 'expand:north']);

describe('reading the model reply', () => {
  it('keeps a well-formed answer', () => {
    const reply = parseReply(
      '{"note":"The city is comfortable.","picks":[{"id":"green:9:9","why":"Room to breathe."}]}',
      allowed,
    );
    expect(reply).toEqual({ note: 'The city is comfortable.', picks: [{ id: 'green:9:9', why: 'Room to breathe.' }] });
  });

  it('finds the answer inside stray prose', () => {
    const reply = parseReply('Sure! {"note":"All well.","picks":[]} Hope that helps.', allowed);
    expect(reply?.note).toBe('All well.');
  });

  it('drops plans the game never offered', () => {
    const reply = parseReply(
      '{"note":"Look here.","picks":[{"id":"temple:1:1","why":"no"},{"id":"housing:3:4","why":"yes"}]}',
      allowed,
    );
    expect(reply?.picks.map((pick) => pick.id)).toEqual(['housing:3:4']);
  });

  it('drops a plan named twice and stops at the cap', () => {
    const picks = [...allowed, ...allowed].map((id) => `{"id":"${id}","why":"x"}`).join(',');
    const reply = parseReply(`{"note":"n","picks":[${picks}]}`, allowed);
    expect(reply!.picks.length).toBeLessThanOrEqual(MAX_PICKS);
    expect(new Set(reply!.picks.map((pick) => pick.id)).size).toBe(reply!.picks.length);
  });

  it('shortens a note that runs on', () => {
    const reply = parseReply(`{"note":"${'a'.repeat(900)}","picks":[]}`, allowed);
    expect(reply!.note.length).toBe(MAX_NOTE_LENGTH);
  });

  it('gives up on anything that is not an answer', () => {
    expect(parseReply('I cannot help with that.', allowed)).toBeNull();
    expect(parseReply('{ broken', allowed)).toBeNull();
    expect(parseReply('{"picks":[]}', allowed)).toBeNull();
  });
});
