#!/usr/bin/env node
/**
 * Refuses to let a built bundle carry a secret.
 *
 * Vite inlines every VITE_* variable a file mentions — dead branches included — so a key left
 * in .env.local can end up in dist without anyone meaning it to. This runs after every build.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist/assets';

/** Things that must never appear in a published file. */
const FORBIDDEN = [
  { name: 'Anthropic API key', pattern: /sk-ant-[A-Za-z0-9_-]{8,}/ },
  { name: 'OpenAI API key', pattern: /sk-proj-[A-Za-z0-9_-]{8,}/ },
  { name: 'bearer token', pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
];

let failures = 0;
for (const file of readdirSync(DIST)) {
  const contents = readFileSync(join(DIST, file), 'utf8');
  for (const { name, pattern } of FORBIDDEN) {
    if (pattern.test(contents)) {
      console.error(`dist/assets/${file} contains a ${name}. Refusing to publish it.`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error('Check .env.local and vite.config.ts: nothing secret may reach a build.');
  process.exit(1);
}
console.log('bundle check: no secrets in dist');
