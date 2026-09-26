import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { KairosConfig } from '../src/config/schema.js';
import {
  BobEngine,
  CACHE_DIR,
  CachedEngine,
  createEngine,
  type Engine,
  EngineError,
  FIXTURES_DIR,
  fixtureName,
  MockEngine,
  parseBobOutput,
  repairWith,
  RUNS_DIR,
} from '../src/engine/index.js';
import type { Exec } from '../src/engine/bob.js';
import { parseWithRepair } from '../src/report/parse.js';

const tmp = () => mkdtemp(join(tmpdir(), 'kairos-engine-'));
const REPLY = '{"findings":[],"summary":"No drift."}';
const resultLine = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'result',
    status: 'success',
    stats: { task_id: 't-123', session_costs: 0.42, max_cost: 2, tool_calls: 3 },
    last_message: REPLY,
    ...over,
  });
const errorLine = JSON.stringify({ type: 'error', severity: 'error', message: 'Max cost exceeded' });

function bob(cwd: string, stdout: string, extra: Partial<Awaited<ReturnType<Exec>>> = {}) {
  const exec = vi.fn<Exec>(async () => ({ stdout, stderr: '', exitCode: 0, ...extra }));
  const engine = new BobEngine({
    cwd,
    maxCost: 2,
    maxTurns: 8,
    env: { BOB_API_KEY: 'test' },
    exec,
    now: () => new Date('2026-09-26T10:00:00.123Z'),
  });
  return { engine, exec };
}

describe('parseBobOutput', () => {
  it('collects error lines and the result, skipping non-JSON lines', () => {
    const out = parseBobOutput(`banner\n${errorLine}\n\n${resultLine()}\n`);
    expect(out.errors).toEqual(['Max cost exceeded']);
    expect(out.result?.last_message).toBe(REPLY);
  });
});

describe('BobEngine', () => {
  it('runs bob in the kairos mode with the budget, prompt on stdin', async () => {
    const cwd = await tmp();
    const { engine, exec } = bob(cwd, `${resultLine()}\n`);
    const res = await engine.analyze('PROMPT');
    expect(res).toMatchObject({ text: REPLY, costBobcoins: 0.42, taskId: 't-123' });
    const [file, args, opts] = exec.mock.calls[0]!;
    expect(file).toBe('bob');
    expect(args).toEqual(
      ['run', '--trust', '--mode', 'kairos', '--format', 'json', '--max-cost', '2', '--max-turns', '8'],
    );
    expect(opts).toMatchObject({ input: 'PROMPT', cwd });
  });

  it('saves the raw output to .kairos/runs/<ts>-<kind>.json', async () => {
    const cwd = await tmp();
    const { engine } = bob(cwd, resultLine());
    await engine.analyze('P', { kind: 'repair' });
    const file = join(cwd, RUNS_DIR, '20260926T100000Z-repair.json');
    expect(await readFile(file, 'utf8')).toBe(resultLine());
  });

  it('fails on an error line even when the status is success (cost limit)', async () => {
    const cwd = await tmp();
    const { engine } = bob(cwd, `${errorLine}\n${resultLine({ last_message: 'half done' })}`);
    const err = await engine.analyze('P').catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.message).toContain('Max cost exceeded');
    expect(err.taskId).toBe('t-123');
    expect(await readdir(join(cwd, RUNS_DIR))).toHaveLength(1); // evidence kept
  });

  it('explains a missing bob binary', async () => {
    const { engine } = bob(await tmp(), '', { code: 'ENOENT', exitCode: undefined });
    await expect(engine.analyze('P')).rejects.toThrow(/not installed.*--engine mock/);
  });

  it('explains a missing BOB_API_KEY without spawning bob', async () => {
    const exec = vi.fn<Exec>();
    const engine = new BobEngine({ cwd: await tmp(), maxCost: 1, maxTurns: 1, env: {}, exec });
    await expect(engine.analyze('P')).rejects.toThrow(/BOB_API_KEY/);
    expect(exec).not.toHaveBeenCalled();
  });

  it('reports timeouts, missing results and failed statuses', async () => {
    await expect(bob(await tmp(), '', { timedOut: true }).engine.analyze('P')).rejects.toThrow(
      /timed out/,
    );
    await expect(
      bob(await tmp(), '', { stderr: 'boom', exitCode: 1 }).engine.analyze('P'),
    ).rejects.toThrow(/no result \(exit code 1\)[\s\S]*boom/);
    await expect(
      bob(await tmp(), resultLine({ status: 'error' })).engine.analyze('P'),
    ).rejects.toThrow(/status "error"/);
  });
});

describe('MockEngine', () => {
  it('answers from the fixture named by the prompt hash, then fallback, then empty', async () => {
    const dir = await tmp();
    const engine = new MockEngine(dir);
    expect(JSON.parse((await engine.analyze('A')).text).findings).toEqual([]);
    await writeFile(join(dir, 'fallback.txt'), 'FALLBACK');
    expect((await engine.analyze('A')).text).toBe('FALLBACK');
    await writeFile(join(dir, fixtureName('A')), 'FOR A');
    expect(await engine.analyze('A')).toEqual({ text: 'FOR A', costBobcoins: 0, raw: 'FOR A' });
    expect((await engine.analyze('B')).text).toBe('FALLBACK');
  });
});

describe('CachedEngine', () => {
  const counting = (): Engine & { calls: number } => {
    const e = {
      name: 'bob' as const,
      calls: 0,
      async analyze(prompt: string) {
        e.calls++;
        return { text: `reply to ${prompt}`, costBobcoins: 0.5, taskId: 't', raw: 'raw' };
      },
    };
    return e;
  };

  it('serves a repeated prompt from disk at zero cost', async () => {
    const dir = join(await tmp(), CACHE_DIR);
    const inner = counting();
    const engine = new CachedEngine(inner, dir);
    expect((await engine.analyze('P')).costBobcoins).toBe(0.5);
    const again = await engine.analyze('P');
    expect(again).toMatchObject({ text: 'reply to P', costBobcoins: 0, cached: true, taskId: 't' });
    expect(inner.calls).toBe(1);
    await engine.analyze('Q');
    expect(inner.calls).toBe(2);
  });

  it('treats a corrupt entry as a miss and does not cache failures', async () => {
    const dir = await tmp();
    const inner = counting();
    const engine = new CachedEngine(inner, dir);
    await engine.analyze('P');
    const [file] = await readdir(dir);
    await writeFile(join(dir, file!), '{oops');
    await engine.analyze('P');
    expect(inner.calls).toBe(2);

    const failing = new CachedEngine(
      { name: 'bob', analyze: async () => Promise.reject(new EngineError('x')) },
      await tmp(),
    );
    await expect(failing.analyze('P')).rejects.toThrow('x');
  });
});

describe('createEngine', () => {
  const config = KairosConfig.parse({ budget: { maxCost: 1.5, maxTurns: 4 } });

  it('builds a cached Bob engine with the config budget by default', async () => {
    const cwd = await tmp();
    const exec = vi.fn<Exec>(async () => ({ stdout: resultLine(), stderr: '' }));
    const engine = createEngine(config, { cwd, bob: { exec, env: { BOB_API_KEY: 'k' } } });
    expect(engine).toBeInstanceOf(CachedEngine);
    await engine.analyze('P');
    await engine.analyze('P');
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0]![1]).toContain('1.5');
    expect(createEngine(config, { cwd, noCache: true })).toBeInstanceOf(BobEngine);
  });

  it('builds a mock engine reading .kairos/fixtures', async () => {
    const cwd = await tmp();
    await mkdir(join(cwd, FIXTURES_DIR), { recursive: true });
    await writeFile(join(cwd, FIXTURES_DIR, fixtureName('P')), REPLY);
    const engine = createEngine(config, { cwd, engine: 'mock' });
    expect((await engine.analyze('P')).text).toBe(REPLY);
  });
});

describe('repairWith', () => {
  it('lets parseWithRepair ask the engine for a corrected reply', async () => {
    const dir = await tmp();
    await writeFile(join(dir, 'fallback.txt'), REPLY);
    const reply = await parseWithRepair('not json', repairWith(new MockEngine(dir)));
    expect(reply.summary).toBe('No drift.');
  });
});
