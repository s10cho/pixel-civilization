#!/usr/bin/env node
/**
 * The consulting relay, as a development server.
 *
 * The game's client never holds an API key: it POSTs `{ brief }` here and gets
 * `{ note, picks }` back. The released game will point VITE_CONSULTING_URL at a deployed
 * version of exactly this, so the key, the prompt and any rate limiting live on the server.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... node tools/consulting-relay.mjs
 *   CONSULTING_STUB=1 node tools/consulting-relay.mjs      # canned answer, no key, no cost
 *   CONSULTING_DELAY_MS=1500 ...                           # answer slowly, to see the wait
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.CONSULTING_MODEL || 'claude-sonnet-5';
const KEY = process.env.ANTHROPIC_API_KEY || '';
const STUB = process.env.CONSULTING_STUB === '1' || !KEY;
/** Answer this slowly, to see the card's waiting state. */
const DELAY_MS = Number(process.env.CONSULTING_DELAY_MS) || 0;

// Kept in step with src/consulting/llm/prompt.ts; when this moves to a real server, that file
// keeps only the client half and this becomes the single copy.
const SYSTEM = [
  'You advise the mayor of a small, calm city-building game. The game is a healing game:',
  'there is no failure state, no scoring, and no urgency. Never warn, scold, or press.',
  '',
  'You are given a summary of the city and a list of plans the game has already worked out.',
  'Write a short reading of the city, then say which of those plans you would look at first',
  'and why, in one line each. You may only refer to plans by the ids you were given.',
  'Never invent a plan, a building, a place, or a number that is not in the summary.',
  '',
  'Write in the language named by "locale" ("ko" = Korean, "en" = English).',
  'The city has no religious buildings and never will; do not suggest any.',
  '',
  'Answer with JSON only, no prose around it, in this shape:',
  '{"note": "<2-3 sentences>", "picks": [{"id": "<an id from options>", "why": "<one line>"}]}',
  'Keep note under 320 characters, each why under 120, and at most 3 picks.',
].join('\n');

/** A fixed answer, so the whole path can be exercised without spending anything. */
function stubReply(brief) {
  const korean = brief?.locale === 'ko';
  const picks = (brief?.options ?? []).slice(0, 2).map((option, index) => ({
    id: option.id,
    why: korean
      ? index === 0
        ? '지금 가장 아쉬운 부분을 먼저 채웁니다.'
        : '여유가 생기면 이어서 해볼 만합니다.'
      : index === 0
        ? 'It fills the gap the city feels most.'
        : 'Worth doing next, once there is room.',
  }));
  const note = korean
    ? `인구 ${brief?.population ?? 0}명에 행복도 ${brief?.happiness ?? 0}. 도시는 무리 없이 굴러가고 있습니다. 급할 것 없이 천천히 넓혀 가셔도 좋겠습니다.`
    : `A city of ${brief?.population ?? 0} with happiness at ${brief?.happiness ?? 0}. Everything is ticking over. There is no hurry here.`;
  return { note, picks };
}

async function askAnthropic(brief) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: `City summary:\n${JSON.stringify(brief, null, 1)}` }],
    }),
  });
  if (!response.ok) throw new Error(`anthropic ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = (payload.content ?? []).map((part) => part.text ?? '').join('\n');
  return { text };
}

const server = createServer((request, response) => {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-headers', 'content-type');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  if (request.method !== 'POST') return response.writeHead(405).end();

  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 64_000) request.destroy();
  });
  request.on('end', async () => {
    try {
      const { brief } = JSON.parse(body || '{}');
      if (DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      const answer = STUB ? stubReply(brief) : await askAnthropic(brief);
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer));
      console.log(`[relay] ${STUB ? 'stub' : MODEL} -> ${brief?.options?.length ?? 0} options`);
    } catch (error) {
      console.error('[relay]', error);
      response.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'upstream' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[relay] listening on http://localhost:${PORT}  (${STUB ? 'stub answers — set ANTHROPIC_API_KEY for a real model' : MODEL})`);
});
