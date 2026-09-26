import { execa } from 'execa';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDiff } from '../src/collector/diff.js';
import { runCheck } from '../src/commands/check.js';
import { loadConfig } from '../src/config/load.js';
import { buildContext } from '../src/context/builder.js';
import { bobReplyJsonSchema } from '../src/report/schema.js';

const SCRIPTS = resolve(__dirname, '../../../demo/scripts');

/** Runs the demo scripts (no install) into a fresh temp repo and returns its path. */
async function demo(...steps: string[]): Promise<string> {
  const dir = join(await mkdtemp(join(tmpdir(), 'kairos-demo-')), 'orders-api');
  const env = { KAIROS_DEMO_DIR: dir };
  for (const step of ['reset', ...steps])
    await execa('bash', [join(SCRIPTS, `${step}.sh`)], { env });
  return dir;
}

describe('demo/orders-api scenario', () => {
  it('drifts A, B and C produce the expected symbols and intent context', async () => {
    const cwd = await demo('drift-a', 'drift-b', 'drift-c');
    const config = await loadConfig(cwd);
    const diff = await getDiff(config.base, { cwd });

    expect(diff.files.map((f) => f.path).sort()).toEqual([
      'src/config.ts',
      'src/pricing.ts',
      'src/routes/orders.ts',
      'src/store.ts',
      'test/orders.test.ts',
      'test/pricing.test.ts',
    ]);
    const symbols = diff.symbols.map((s) => `${s.kind}:${s.name}:${s.change}`);
    expect(symbols).toEqual(
      expect.arrayContaining([
        'const:DISCOUNT_RATE:modified',
        'route:DELETE /orders/:id:added',
        'env:DATABASE_URL:added',
        'env:DB_URL:removed',
      ]),
    );

    const { selection } = await buildContext(cwd, diff, config, bobReplyJsonSchema());
    const picked = selection.excerpts.map((e) => `${e.file}#${e.heading ?? ''}`);
    expect(picked).toEqual(
      expect.arrayContaining([
        'docs/SPEC.md#Pricing',
        'docs/SPEC.md#Orders',
        'docs/SPEC.md#Config',
        'openapi.yaml#',
        'README.md#',
      ]),
    );
    expect(selection.omitted).toEqual([]);
  });

  it('the control commit only touches the spec text', async () => {
    const cwd = await demo('control');
    const diff = await getDiff('main', { cwd });
    expect(diff.files.map((f) => f.path)).toEqual(['docs/SPEC.md']);
    expect(diff.symbols).toEqual([]);

    const res = await runCheck(cwd, { engine: 'mock' });
    expect(res.exitCode).toBe(0);
  });
});

describe('demo fixtures', () => {
  it('replay the recorded Bob replies for A/B/C and control after a fresh reset', async () => {
    const abc = await runCheck(await demo('drift-a', 'drift-b', 'drift-c'), { engine: 'mock' });
    expect(abc.report.findings.map((f) => f.type).sort()).toEqual([
      'MISSING_TEST',
      'SPEC_VIOLATION',
      'STALE_DOC',
      'UNDOCUMENTED_BEHAVIOR',
    ]);
    expect(abc.exitCode).toBe(1);

    const control = await runCheck(await demo('control'), { engine: 'mock' });
    expect(control.report.findings).toEqual([]);
    expect(control.report.summary).not.toMatch(/no fixture/);
  });
});
