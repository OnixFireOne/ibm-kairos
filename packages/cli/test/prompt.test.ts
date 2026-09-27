import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSymbols, parseDiff } from '../src/collector/diff.js';
import { buildPrompt, fence } from '../src/context/prompt.js';
import type { ContextSelection } from '../src/context/types.js';

async function driftDiff() {
  const raw = await readFile(join(__dirname, 'fixtures/diffs/drift.diff'), 'utf8');
  const files = parseDiff(raw);
  return {
    base: 'origin/main',
    head: 'abc1234def5678900',
    raw,
    files,
    symbols: extractSymbols(files),
  };
}

const selection: ContextSelection = {
  excerpts: [
    {
      file: 'README.md',
      heading: 'Setup',
      startLine: 3,
      endLine: 6,
      text: '## Setup\n\nSet `DB_URL` to your Postgres connection string.\nSet `PORT` (default 3000).',
      reasons: ['symbol:DB_URL'],
    },
    {
      file: 'docs/SPEC.md',
      heading: 'Pricing',
      startLine: 5,
      endLine: 12,
      text: '## Pricing\n\nOrders above $100 (DISCOUNT_THRESHOLD) get a 10% discount.\nThe discount is applied by `applyDiscount`.\n\n### Rounding\n\nTotals are rounded to 2 decimals.',
      reasons: ['map:src/pricing/**', 'symbol:applyDiscount'],
    },
  ],
  omitted: [
    { file: 'openapi.yaml', heading: null, startLine: 1, endLine: 22, text: '', reasons: [] },
  ],
  chars: 0,
};

describe('fence', () => {
  it('uses a fence longer than any backtick run in the content', () => {
    expect(fence('a', 'ts')).toBe('```ts\na\n```');
    expect(fence('x ```y``` z')).toBe('````\nx ```y``` z\n````');
  });
});

describe('buildPrompt', () => {
  it('renders task, change, numbered excerpts, omissions and the output schema', async () => {
    const prompt = buildPrompt({
      diff: await driftDiff(),
      selection,
      outputSchema: '{ "type": "object" }',
    });
    await expect(prompt).toMatchFileSnapshot('__snapshots__/prompt.drift.md');
  });

  it('says so when nothing matched', async () => {
    const prompt = buildPrompt({
      diff: await driftDiff(),
      selection: { excerpts: [], omitted: [], chars: 0 },
      outputSchema: '{}',
    });
    expect(prompt).toContain('No intent excerpts matched this change.');
  });

  it('is the same for a local base and its origin/ ref, so fixtures match in CI', async () => {
    const render = async (base: string) =>
      buildPrompt({ diff: { ...(await driftDiff()), base }, selection, outputSchema: '{}' });
    const local = await render('main');
    expect(local).toContain('Base: `main`');
    expect(await render('origin/main')).toBe(local);
    expect(await render('refs/remotes/origin/main')).toBe(local);
  });
});
