import { execa } from 'execa';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DiffError, extractSymbols, getDiff, parseDiff } from '../src/collector/diff.js';
import type { ChangedSymbol } from '../src/collector/types.js';

const fixture = (name: string) => readFile(join(__dirname, 'fixtures/diffs', name), 'utf8');
const sym = (
  file: string,
  line: number,
  kind: ChangedSymbol['kind'],
  name: string,
  change: ChangedSymbol['change'],
): ChangedSymbol => ({ kind, name, file, line, change });

describe('parseDiff: drift.diff (binary, added, modified, deleted, renamed)', () => {
  it('lists every file in diff order with status and paths', async () => {
    const files = parseDiff(await fixture('drift.diff'));
    expect(files.map((f) => [f.path, f.oldPath, f.status, f.binary])).toEqual([
      ['logo.png', null, 'modified', true],
      ['src/audit.ts', null, 'added', false],
      ['src/config.ts', null, 'modified', false],
      ['src/legacy.ts', null, 'deleted', false],
      ['src/math.ts', 'src/util.ts', 'renamed', false],
      ['src/pricing/discount.ts', null, 'modified', false],
      ['src/routes/orders.ts', null, 'modified', false],
    ]);
    expect(files[0]!.hunks).toEqual([]);
    expect(files[4]!.hunks).toEqual([]);
  });

  it('parses hunk ranges, header and changed line numbers', async () => {
    const files = parseDiff(await fixture('drift.diff'));
    const [audit, config, legacy, discount, orders] = [1, 2, 3, 5, 6].map((i) => files[i]!.hunks);
    expect(audit).toHaveLength(1);
    expect(audit![0]).toMatchObject({ oldStart: 0, oldLines: 0, newStart: 1, newLines: 5 });
    expect(audit![0]!.added).toEqual([1, 2, 3, 4, 5]);
    expect(config![0]).toMatchObject({ added: [2], removed: [2], header: '' });
    expect(legacy![0]).toMatchObject({ oldStart: 1, oldLines: 3, newStart: 0, newLines: 0 });
    expect(legacy![0]!.removed).toEqual([1, 2, 3]);
    expect(discount![0]).toMatchObject({ added: [5, 9, 10, 11, 12], removed: [5] });
    expect(orders![0]).toMatchObject({
      oldStart: 7,
      oldLines: 5,
      newStart: 7,
      newLines: 9,
      header: "router.get('/orders', (_req, res) => {",
      added: [12, 13, 14, 15],
      removed: [],
    });
    expect(orders![0]!.lines[0]).toBe(' });');
    expect(orders![0]!.lines.at(-1)).toBe('+});');
  });
});

describe('parseDiff: multi.diff (two hunks, no newline at EOF)', () => {
  it('parses both hunks and drops "\\ No newline" markers', async () => {
    const [big] = parseDiff(await fixture('multi.diff'));
    expect(big!.hunks).toHaveLength(2);
    const [h1, h2] = big!.hunks;
    expect(h1).toMatchObject({
      oldStart: 15,
      oldLines: 11,
      newStart: 15,
      newLines: 11,
      header: 'export function first(a: number) {',
      added: [20],
      removed: [20],
    });
    expect(h1!.lines).toHaveLength(12);
    expect(h2).toMatchObject({ oldStart: 37, oldLines: 6, newStart: 37, newLines: 7 });
    expect(h2).toMatchObject({ added: [42, 43], removed: [42] });
    expect(h2!.lines).toHaveLength(8);
    expect(h2!.lines.some((l) => l.startsWith('\\'))).toBe(false);
  });

  it('handles hunk headers without counts (@@ -3 +3 @@)', () => {
    const raw = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -3 +3 @@',
      '-const A = 1;',
      '+const A = 2;',
      '',
    ].join('\n');
    expect(parseDiff(raw)[0]!.hunks[0]).toMatchObject({
      oldStart: 3,
      oldLines: 1,
      newStart: 3,
      newLines: 1,
      added: [3],
      removed: [3],
    });
  });

  it('returns [] for an empty diff', () => {
    expect(parseDiff('')).toEqual([]);
  });
});

describe('extractSymbols', () => {
  it('finds declarations, routes and env vars on changed lines plus enclosing declarations (drift.diff)', async () => {
    const symbols = extractSymbols(parseDiff(await fixture('drift.diff')));
    expect(symbols).toEqual([
      sym('src/audit.ts', 1, 'const', 'AUDIT_ENABLED', 'added'),
      sym('src/audit.ts', 1, 'env', 'AUDIT_ENABLED', 'added'),
      sym('src/audit.ts', 3, 'function', 'audit', 'added'),
      // enclosing `export const config = {` of the changed line 2
      sym('src/config.ts', 2, 'const', 'config', 'modified'),
      // drift C: env var renamed (bracket and dot notation)
      sym('src/config.ts', 2, 'env', 'DATABASE_URL', 'added'),
      sym('src/config.ts', 2, 'env', 'DB_URL', 'removed'),
      sym('src/legacy.ts', 1, 'function', 'legacyTotal', 'removed'),
      // drift A: body change inside applyDiscount, found via the context line above it
      sym('src/pricing/discount.ts', 5, 'function', 'applyDiscount', 'modified'),
      sym('src/pricing/discount.ts', 10, 'class', 'PriceCalculator', 'added'),
      // drift B: new route (double quotes); POST /orders is context only and must not appear
      sym('src/routes/orders.ts', 13, 'route', 'DELETE /orders/:id', 'added'),
    ]);
  });

  it('uses the hunk header, collapses removed+added into modified, stops at top-level closers (multi.diff)', async () => {
    const symbols = extractSymbols(parseDiff(await fixture('multi.diff')));
    expect(symbols).toEqual([
      // enclosing declaration is above the hunk: taken from the @@ header
      sym('big.ts', 20, 'function', 'first', 'modified'),
      // same const removed (old 42) and added (new 43) => one "modified" at the new line.
      // console.log on new line 42 follows a column-0 "}" so it is NOT attributed to second()
      sym('big.ts', 43, 'const', 'LAST', 'modified'),
    ]);
  });

  it('recognises every route method and env access style', () => {
    const raw = [
      'diff --git a/r.ts b/r.ts',
      '--- a/r.ts',
      '+++ b/r.ts',
      '@@ -0,0 +1,6 @@',
      "+app.get('/a', h);",
      '+router.post(`/b`, h);',
      "+app.put( '/c/:id', h);",
      "+app.patch('/d', h); map.get('notARoute');",
      "+const k = process.env.API_BASE + process.env['REGION'];",
      '+export default async function* gen() {}',
      '',
    ].join('\n');
    expect(extractSymbols(parseDiff(raw))).toEqual([
      sym('r.ts', 1, 'route', 'GET /a', 'added'),
      sym('r.ts', 2, 'route', 'POST /b', 'added'),
      sym('r.ts', 3, 'route', 'PUT /c/:id', 'added'),
      sym('r.ts', 4, 'route', 'PATCH /d', 'added'),
      sym('r.ts', 5, 'const', 'k', 'added'),
      sym('r.ts', 5, 'env', 'API_BASE', 'added'),
      sym('r.ts', 5, 'env', 'REGION', 'added'),
      sym('r.ts', 6, 'function', 'gen', 'added'),
    ]);
  });
});

describe('getDiff (real git)', () => {
  async function repo() {
    const dir = await mkdtemp(join(tmpdir(), 'kairos-diff-'));
    const git = (...args: string[]) => execa('git', args, { cwd: dir });
    await git('init', '-q', '-b', 'main');
    await git('config', 'user.email', 'test@example.com');
    await git('config', 'user.name', 'test');
    await writeFile(join(dir, 'a.ts'), 'export const RATE = 0.9;\n');
    await git('add', '-A');
    await git('commit', '-qm', 'base');
    await writeFile(join(dir, 'a.ts'), 'export const RATE = 0.85;\n');
    await git('commit', '-qam', 'change');
    return { dir, git };
  }

  it('diffs base...HEAD in the given cwd and resolves head to a sha', async () => {
    const { dir, git } = await repo();
    const res = await getDiff('HEAD~1', { cwd: dir });
    expect(res.base).toBe('HEAD~1');
    expect(res.head).toBe((await git('rev-parse', 'HEAD')).stdout.trim());
    expect(res.raw).toContain('+export const RATE = 0.85;');
    expect(res.files.map((f) => f.path)).toEqual(['a.ts']);
    expect(res.symbols).toEqual([sym('a.ts', 1, 'const', 'RATE', 'modified')]);
  });

  it('throws DiffError naming the base when the ref does not exist', async () => {
    const { dir } = await repo();
    await expect(getDiff('no-such-ref', { cwd: dir })).rejects.toThrow(DiffError);
    await expect(getDiff('no-such-ref', { cwd: dir })).rejects.toThrow(/no-such-ref/);
  });
});
