import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSymbols, parseDiff } from '../src/collector/diff.js';
import { KairosConfig } from '../src/config/schema.js';
import { buildContext } from '../src/context/builder.js';

const ROOT = join(__dirname, 'fixtures/intent');

async function diff() {
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

const config = (maxContextChars: number) =>
  KairosConfig.parse({
    map: {
      'src/pricing/**': ['docs/SPEC.md#Pricing'],
      'src/routes/**': ['docs/SPEC.md#Orders', 'openapi.yaml'],
    },
    budget: { maxContextChars },
  });

describe('buildContext', () => {
  it('builds a prompt with the selected intent excerpts', async () => {
    const { prompt, selection } = await buildContext(ROOT, await diff(), config(60_000), '{}');
    expect(selection.excerpts).toHaveLength(6);
    expect(prompt).toContain('### README.md · Setup · lines 3-6');
    expect(prompt).toContain('### docs/SPEC.md · Pricing · lines 5-12');
  });

  it('keeps the whole diff and spends only the remaining budget on excerpts', async () => {
    const d = await diff();
    const { prompt, selection } = await buildContext(ROOT, d, config(d.raw.length), '{}');
    expect(selection.excerpts).toEqual([]);
    expect(selection.omitted).toHaveLength(6);
    expect(prompt).toContain('+router.delete("/orders/:id"');
  });
});
