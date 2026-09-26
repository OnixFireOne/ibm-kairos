import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDiff, extractSymbols } from '../src/collector/diff.js';
import type { ChangedSymbol, FileDiff } from '../src/collector/types.js';
import { matchesGlob } from '../src/context/glob.js';
import { loadIntentFiles } from '../src/context/intent.js';
import { isSearchable, selectContext } from '../src/context/select.js';
import { splitMarkdown } from '../src/context/sections.js';
import type { Excerpt, IntentFile } from '../src/context/types.js';

const ROOT = join(__dirname, 'fixtures/intent');
const PATTERNS = {
  intent: ['docs/**/*.md', 'adr/**/*.md', 'openapi.yaml', 'README.md'],
  tests: ['**/*.test.ts'],
};
const MAP = {
  'src/pricing/**': ['docs/SPEC.md#Pricing'],
  'src/routes/**': ['docs/SPEC.md#Orders', 'openapi.yaml'],
};

async function driftInput() {
  const files = parseDiff(await readFile(join(__dirname, 'fixtures/diffs/drift.diff'), 'utf8'));
  return { files, symbols: extractSymbols(files) };
}

/** Expected excerpt text taken straight from the fixture file. */
async function lines(file: string, start: number, end: number): Promise<string> {
  const all = (await readFile(join(ROOT, file), 'utf8')).split('\n');
  return all.slice(start - 1, end).join('\n');
}

async function ex(
  file: string,
  heading: string | null,
  startLine: number,
  endLine: number,
  reasons: string[],
): Promise<Excerpt> {
  return {
    file,
    heading,
    startLine,
    endLine,
    text: await lines(file, startLine, endLine),
    reasons,
  };
}

describe('matchesGlob', () => {
  it.each([
    ['src/pricing/discount.ts', 'src/pricing/**', true],
    ['src/pricing/deep/x.ts', 'src/pricing/**', true],
    ['src/pricing.ts', 'src/pricing/**', false],
    ['a/b/c.test.ts', '**/*.test.ts', true],
    ['c.test.ts', '**/*.test.ts', true],
    ['src/a.ts', 'src/*.ts', true],
    ['src/x/a.ts', 'src/*.ts', false],
    ['src/a1.ts', 'src/a?.ts', true],
    ['src/aXts', 'src/a.ts', false],
    ['README.md', 'README.md', true],
  ])('%s vs %s => %s', (path, glob, expected) => {
    expect(matchesGlob(path, glob)).toBe(expected);
  });
});

describe('splitMarkdown', () => {
  it('splits by ATX headings, trims trailing blanks, computes blockEnd, ignores fenced code', async () => {
    const text = await readFile(join(ROOT, 'docs/SPEC.md'), 'utf8');
    expect(splitMarkdown('docs/SPEC.md', text)).toEqual([
      {
        file: 'docs/SPEC.md',
        heading: 'Orders API spec',
        level: 1,
        startLine: 1,
        endLine: 3,
        blockEnd: 26,
      },
      {
        file: 'docs/SPEC.md',
        heading: 'Pricing',
        level: 2,
        startLine: 5,
        endLine: 8,
        blockEnd: 12,
      },
      {
        file: 'docs/SPEC.md',
        heading: 'Rounding',
        level: 3,
        startLine: 10,
        endLine: 12,
        blockEnd: 12,
      },
      {
        file: 'docs/SPEC.md',
        heading: 'Orders',
        level: 2,
        startLine: 14,
        endLine: 18,
        blockEnd: 18,
      },
      {
        file: 'docs/SPEC.md',
        heading: 'Config',
        level: 2,
        startLine: 20,
        endLine: 26,
        blockEnd: 26,
      },
    ]);
  });

  it('adds a level-0 preamble for text before the first heading, starting at its first non-blank line', () => {
    const text = '\nIntro line\n\n## A\nbody\n';
    expect(splitMarkdown('x.md', text)).toEqual([
      { file: 'x.md', heading: '', level: 0, startLine: 2, endLine: 2, blockEnd: 2 },
      { file: 'x.md', heading: 'A', level: 2, startLine: 4, endLine: 5, blockEnd: 5 },
    ]);
  });

  it('returns [] for an empty document', () => {
    expect(splitMarkdown('x.md', '')).toEqual([]);
  });
});

describe('loadIntentFiles', () => {
  it('globs intent and test files relative to cwd, sorted, with kinds', async () => {
    const files = await loadIntentFiles(ROOT, PATTERNS);
    expect(files.map((f) => [f.path, f.kind])).toEqual([
      ['README.md', 'markdown'],
      ['docs/SPEC.md', 'markdown'],
      ['openapi.yaml', 'other'],
      ['test/pricing.test.ts', 'test'],
    ]);
    expect(files[0]!.text).toBe(await readFile(join(ROOT, 'README.md'), 'utf8'));
  });
});

describe('isSearchable', () => {
  const s = (kind: ChangedSymbol['kind'], name: string): ChangedSymbol => ({
    kind,
    name,
    file: 'a.ts',
    line: 1,
    change: 'added',
  });
  it.each([
    [s('const', 'config'), false], // plain lowercase word: too noisy
    [s('const', 'path'), false],
    [s('const', 'DISCOUNT_THRESHOLD'), true], // UPPER_CASE
    [s('const', 'dbUrl'), true], // camelCase
    [s('const', 'X'), false],
    [s('function', 'go'), false], // shorter than 3
    [s('function', 'audit'), true],
    [s('class', 'PriceCalculator'), true],
    [s('env', 'DB'), true], // env vars and routes are always searchable
    [s('route', 'GET /'), true],
  ])('%o => %s', (symbol, expected) => {
    expect(isSearchable(symbol)).toBe(expected);
  });
});

describe('selectContext', () => {
  it('selects map sections and symbol matches for the drift scenario (A, B, C)', async () => {
    const intent = await loadIntentFiles(ROOT, PATTERNS);
    const sel = selectContext(await driftInput(), intent, { map: MAP, maxChars: 60_000 });
    expect(sel.excerpts).toEqual([
      // C: README documents the removed env var
      await ex('README.md', 'Setup', 3, 6, ['symbol:DB_URL']),
      // A: map section (with its ### Rounding subsection) merged with the applyDiscount match
      await ex('docs/SPEC.md', 'Pricing', 5, 12, ['map:src/pricing/**', 'symbol:applyDiscount']),
      // B: routes map to the Orders section and the whole OpenAPI file
      await ex('docs/SPEC.md', 'Orders', 14, 18, ['map:src/routes/**']),
      await ex('openapi.yaml', null, 1, 22, ['map:src/routes/**', 'symbol:DELETE /orders/:id']),
      // non-markdown matches become ±10 line windows; non-overlapping windows stay separate
      await ex('test/pricing.test.ts', null, 1, 12, ['symbol:applyDiscount']),
      // line 30 `describe('applyDiscount'` and line 32 both match: windows 20-34 and 22-34 merge
      await ex('test/pricing.test.ts', null, 20, 34, ['symbol:applyDiscount']),
    ]);
    expect(sel.omitted).toEqual([]);
    expect(sel.chars).toBe(sel.excerpts.reduce((n, e) => n + e.text.length, 0));
  });

  it('matches routes with :param or {param} and only on a path boundary', async () => {
    const intent = await loadIntentFiles(ROOT, PATTERNS);
    const files: FileDiff[] = [];
    const symbols: ChangedSymbol[] = [
      { kind: 'route', name: 'GET /orders', file: 'src/x.ts', line: 1, change: 'added' },
    ];
    const sel = selectContext({ files, symbols }, intent, { map: {}, maxChars: 60_000 });
    expect(sel.excerpts).toEqual([
      await ex('docs/SPEC.md', 'Orders', 14, 18, ['symbol:GET /orders']),
      // line 6 `/orders:` matches, line 17 `/orders/{id}:` does not (window would reach 22)
      await ex('openapi.yaml', null, 1, 16, ['symbol:GET /orders']),
    ]);
  });

  it('fills the budget in priority order: map first, then more symbol matches, then file/line', async () => {
    const intent = await loadIntentFiles(ROOT, PATTERNS);
    const pricing = await lines('docs/SPEC.md', 5, 12);
    const openapi = await lines('openapi.yaml', 1, 22);
    const sel = selectContext(await driftInput(), intent, {
      map: MAP,
      maxChars: pricing.length + openapi.length,
    });
    expect(sel.excerpts.map((e) => [e.file, e.startLine])).toEqual([
      ['docs/SPEC.md', 5],
      ['openapi.yaml', 1],
    ]);
    expect(sel.omitted.map((e) => [e.file, e.startLine])).toEqual([
      ['docs/SPEC.md', 14],
      ['README.md', 3],
      ['test/pricing.test.ts', 1],
      ['test/pricing.test.ts', 20],
    ]);
    expect(sel.chars).toBe(pricing.length + openapi.length);
  });

  it('ignores map targets that do not exist and changes that match no map key', async () => {
    const intent: IntentFile[] = [{ path: 'docs/A.md', kind: 'markdown', text: '# A\nbody\n' }];
    const files = parseDiff(
      'diff --git a/lib/z.ts b/lib/z.ts\n--- a/lib/z.ts\n+++ b/lib/z.ts\n@@ -1 +1 @@\n-a\n+b\n',
    );
    const sel = selectContext({ files, symbols: [] }, intent, {
      map: { 'lib/**': ['docs/A.md#Missing', 'docs/B.md'], 'src/**': ['docs/A.md'] },
      maxChars: 1000,
    });
    expect(sel).toEqual({ excerpts: [], omitted: [], chars: 0 });
  });
});
