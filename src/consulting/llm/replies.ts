/**
 * Digging the answer text out of whatever shape it arrives in. Three are worth handling: the
 * relay's own finished object, Anthropic's `content` blocks, and Gemini's `candidates`. A shape
 * that fits none of them is no answer at all, and the card keeps the local advice.
 */
export function replyText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as Record<string, unknown>;

  // A relay may simply answer with the finished object.
  if (typeof body.note === 'string' || Array.isArray(body.picks)) return JSON.stringify(body);
  if (typeof body.text === 'string') return body.text;

  // Anthropic: { content: [{ type: 'text', text }] }
  const fromContent = joinParts(body.content);
  if (fromContent) return fromContent;

  // Gemini: { candidates: [{ content: { parts: [{ text }] } }] }
  if (Array.isArray(body.candidates)) {
    for (const candidate of body.candidates) {
      if (typeof candidate !== 'object' || candidate === null) continue;
      const content = (candidate as { content?: unknown }).content;
      if (typeof content !== 'object' || content === null) continue;
      const fromParts = joinParts((content as { parts?: unknown }).parts);
      if (fromParts) return fromParts;
    }
  }
  return null;
}

/** The text of every part of a list of blocks, run together. */
function joinParts(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  const texts = parts
    .map((part) => (typeof part === 'object' && part !== null ? (part as { text?: unknown }).text : null))
    .filter((text): text is string => typeof text === 'string' && text.length > 0);
  return texts.length > 0 ? texts.join('\n') : null;
}
