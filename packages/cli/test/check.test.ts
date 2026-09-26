import { execa } from 'execa';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { HISTORY_DIR, runCheck } from '../src/commands/check.js';
import type { Exec } from '../src/engine/bob.js';
import { FIXTURES_DIR } from '../src/engine/index.js';
import { renderMarkdown, renderSummary, REPORT_FILE } from '../src/report/markdown.js';
import { DriftReport, type Finding } from '../src/report/schema.js';

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'KRS-001',
  type: 'SPEC_VIOLATION',
  severity: 'high',
  title: 'Discount raised to 15%',
  code: { file: 'src/pricing.ts', lines: [3, 3], excerpt: 'return total * 0.85;' },
  intent: { file: 'docs/SPEC.md', lines: [4, 5], excerpt: 'Orders above $100 get 10% off.' },
  explanation: 'The SPEC says 10%, the code applies 15%.',
  truth: 'intent',
  proposal: { action: 'update_code', summary: 'Restore the 10% discount.' },
  confidence: 0.9,
  ...over,
});

const reply = (findings: Finding[], summary = 'Drift found.') =>
  JSON.stringify({ findings, summary });

const NOW = () => new Date('2026-09-26T10:00:00.123Z');

async function git(cwd: string, ...args: string[]) {
  return execa('git', args, { cwd });
}

/** A repo with a SPEC and a pricing module, plus one drift commit on top of `base`. */
async function demoRepo(config = 'engine: mock\n') {
  const cwd = await mkdtemp(join(tmpdir(), 'kairos-check-'));
  await git(cwd, 'init', '-q', '-b', 'main');
  await git(cwd, 'config', 'user.email', 't@example.com');
  await git(cwd, 'config', 'user.name', 'Test');
  await mkdir(join(cwd, 'docs'));
  await mkdir(join(cwd, 'src'));
  await writeFile(
    join(cwd, 'docs/SPEC.md'),
    '# Spec\n\n## Pricing\n\nOrders above $100 get 10% off.\n',
  );
  await writeFile(
    join(cwd, 'src/pricing.ts'),
    'export function price(total: number) {\n  if (total <= 100) return total;\n  return total * 0.9;\n}\n',
  );
  await mkdir(join(cwd, '.kairos'));
  await writeFile(join(cwd, '.kairos/config.yaml'), config);
  await git(cwd, 'add', '.');
  await git(cwd, 'commit', '-q', '-m', 'base');
  await git(cwd, 'tag', 'base');
  await writeFile(
    join(cwd, 'src/pricing.ts'),
    'export function price(total: number) {\n  if (total <= 100) return total;\n  return total * 0.85;\n}\n',
  );
  await git(cwd, 'commit', '-qam', 'drift');
  return cwd;
}

async function withFallback(cwd: string, text: string) {
  await mkdir(join(cwd, FIXTURES_DIR), { recursive: true });
  await writeFile(join(cwd, FIXTURES_DIR, 'fallback.txt'), text);
}

describe('renderMarkdown', () => {
  const report = DriftReport.parse({
    runId: 'r1',
    base: 'main',
    head: 'abcdef1234',
    createdAt: '2026-09-26T10:00:00.000Z',
    summary: 'Two drifts.',
    findings: [
      finding({ id: 'KRS-001', severity: 'low', title: 'a | b', intent: null }),
      finding({ id: 'KRS-002', severity: 'high' }),
    ],
    cost: { bobcoins: 0.42 },
  });

  it('renders status, a sorted table and evidence on both sides', () => {
    const md = renderMarkdown(report, { failOn: 'medium' });
    expect(md).toContain('❌ **2 finding(s)**, 1 at or above `medium`.');
    expect(md).toContain('`main...abcdef1` · 0.42 Bobcoins');
    expect(md.indexOf('| KRS-002')).toBeLessThan(md.indexOf('| KRS-001'));
    expect(md).toContain('| a \\| b |');
    expect(md).toContain('**Intent** `docs/SPEC.md:4-5`');
    expect(md).toContain('**Code** `src/pricing.ts:3`');
    expect(md).toContain('Fix: `kairos fix --id KRS-002`');
    // KRS-001 has no intent side.
    const krs1 = md.slice(md.indexOf('### 🟡 KRS-001'));
    expect(krs1).not.toContain('**Intent**');
  });

  it('says clean when there are no findings', () => {
    const md = renderMarkdown({ ...report, findings: [] }, { failOn: 'medium' });
    expect(md).toContain('✅ **No drift found.**');
    expect(md).not.toContain('| ID |');
  });

  it('renders a terminal summary', () => {
    const text = renderSummary(report, { failOn: 'high' });
    expect(text).toMatch(/KRS-002\s+high\s+SPEC_VIOLATION\s+src\/pricing\.ts:3\s+Discount/);
    expect(text).toContain('2 finding(s), 1 at or above high.');
  });
});

describe('runCheck', () => {
  it('runs the mock engine, writes history + Markdown and fails on drift', async () => {
    const cwd = await demoRepo();
    await withFallback(cwd, `Here you go:\n\`\`\`json\n${reply([finding()])}\n\`\`\``);
    const res = await runCheck(cwd, { base: 'base', now: NOW });

    expect(res.exitCode).toBe(1);
    expect(res.report.runId).toMatch(/^20260926T100000Z-[0-9a-f]{7}$/);
    expect(res.report.base).toBe('base');
    expect(res.report.findings.map((f) => f.id)).toEqual(['KRS-001']);
    expect(res.report.cost).toEqual({ bobcoins: 0 });

    const history = await readdir(join(cwd, HISTORY_DIR));
    expect(history).toEqual([`${res.report.runId}.json`]);
    const stored = DriftReport.parse(JSON.parse(await readFile(res.historyPath, 'utf8')));
    expect(stored).toEqual(res.report);
    expect(await readFile(join(cwd, REPORT_FILE), 'utf8')).toBe(res.markdown);
  });

  it('drops findings below minConfidence and passes below failOn', async () => {
    const cwd = await demoRepo('engine: mock\nfailOn: high\nminConfidence: 0.7\n');
    await withFallback(
      cwd,
      reply([
        finding({ id: 'KRS-001', confidence: 0.5 }),
        finding({ id: 'KRS-002', severity: 'medium' }),
      ]),
    );
    const res = await runCheck(cwd, { base: 'base', now: NOW });
    expect(res.report.findings.map((f) => f.id)).toEqual(['KRS-002']);
    expect(res.exitCode).toBe(0);
  });

  it('does not call the engine when nothing changed', async () => {
    const cwd = await demoRepo();
    await withFallback(cwd, 'not json at all');
    const res = await runCheck(cwd, { base: 'HEAD', now: NOW });
    expect(res.exitCode).toBe(0);
    expect(res.report.findings).toEqual([]);
    expect(res.report.cost).toBeUndefined();
  });

  it('repairs an invalid reply through the same engine and sums the cost', async () => {
    const cwd = await demoRepo('engine: bob\n');
    const line = (msg: string, cost: number) =>
      `${JSON.stringify({ type: 'result', status: 'success', stats: { task_id: 't', session_costs: cost }, last_message: msg })}\n`;
    const exec = vi
      .fn<Exec>()
      .mockResolvedValueOnce({ stdout: line('I found drift!', 0.3), stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: line(reply([finding()]), 0.1), stderr: '', exitCode: 0 });
    const res = await runCheck(cwd, {
      base: 'base',
      noCache: true,
      now: NOW,
      bob: { env: { BOB_API_KEY: 'test' }, exec },
    });
    expect(exec).toHaveBeenCalledTimes(2);
    expect(res.report.cost).toEqual({ bobcoins: 0.4 });
    expect(res.exitCode).toBe(1);
  });

  it('lets --engine override the config', async () => {
    const cwd = await demoRepo('engine: bob\n');
    await withFallback(cwd, reply([]));
    const res = await runCheck(cwd, { base: 'base', engine: 'mock', now: NOW });
    expect(res.exitCode).toBe(0);
    expect(res.report.summary).toBe('Drift found.');
  });
});
