import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HISTORY_DIR } from '../src/commands/check.js';
import { renderTimelineText, runReport } from '../src/commands/report.js';
import { renderTimelineHtml, TIMELINE_FILE } from '../src/report/html.js';
import type { DriftReport, Finding } from '../src/report/schema.js';
import { buildTimeline, loadHistory } from '../src/report/timeline.js';

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

const report = (at: string, findings: Finding[], bobcoins?: number): DriftReport => ({
  runId: `${at.replace(/[-:]/g, '').slice(0, 15)}Z-abc1234`,
  base: 'main',
  head: 'abc1234def',
  createdAt: at,
  summary: findings.length ? 'Drift found.' : 'No drift.',
  findings,
  ...(bobcoins === undefined ? {} : { cost: { bobcoins } }),
});

const A = finding();
const B = finding({
  id: 'KRS-002',
  type: 'UNDOCUMENTED_BEHAVIOR',
  severity: 'medium',
  title: 'New <script> route',
  code: { file: 'src/routes.ts', lines: [10, 12], excerpt: "app.delete('/orders/:id')" },
  intent: null,
});

// Out of order on purpose: the timeline sorts by createdAt.
const HISTORY = [
  report('2026-09-26T12:00:00.000Z', [{ ...A, id: 'KRS-001' }], 0.05),
  report('2026-09-26T10:00:00.000Z', [], 0.01),
  report('2026-09-26T11:00:00.000Z', [A, B], 0.1),
];

describe('buildTimeline', () => {
  it('orders runs and tracks opened/resolved findings across runs', () => {
    const t = buildTimeline(HISTORY);
    expect(t.runs.map((r) => r.report.createdAt.slice(11, 13))).toEqual(['10', '11', '12']);
    expect(t.runs[0]!.opened).toEqual([]);
    expect(t.runs[1]!.opened.map((f) => f.id)).toEqual(['KRS-001', 'KRS-002']);
    expect(t.runs[1]!.counts).toEqual({ high: 1, medium: 1, low: 0 });
    // A persists (same type + file, even if Bob renumbers it), B is resolved.
    expect(t.runs[2]!.opened).toEqual([]);
    expect(t.runs[2]!.resolved.map((f) => f.code.file)).toEqual(['src/routes.ts']);
    expect(t.totals).toEqual({ runs: 3, opened: 2, resolved: 1, open: 1, bobcoins: 0.16 });
  });

  it('keeps two findings of the same type in the same file apart', () => {
    const twice = [A, finding({ id: 'KRS-002', title: 'Threshold moved' })];
    const t = buildTimeline([
      report('2026-09-26T10:00:00.000Z', twice),
      report('2026-09-26T11:00:00.000Z', [A]),
    ]);
    expect(t.runs[1]!.resolved).toHaveLength(1);
  });

  it('handles an empty history', () => {
    expect(buildTimeline([]).totals).toEqual({
      runs: 0,
      opened: 0,
      resolved: 0,
      open: 0,
      bobcoins: 0,
    });
  });
});

describe('renderTimelineHtml', () => {
  const html = renderTimelineHtml(buildTimeline(HISTORY), {
    failOn: 'medium',
    generatedAt: new Date('2026-09-26T13:00:00Z'),
  });

  it('is a self-contained page with the logo, chart and every run', () => {
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<img src="data:image/svg+xml;base64,');
    expect(html).toContain('<svg class="chart"');
    for (const i of [1, 2, 3]) expect(html).toContain(`id="run-${i}"`);
    expect(html).toContain('Resolved since #2');
    expect(html).not.toMatch(/<script|src="http|href="http/);
  });

  it('escapes text from the report', () => {
    expect(html).toContain('New &lt;script&gt; route');
    expect(html).not.toContain('New <script> route');
  });

  it('says how to start when there are no runs', () => {
    const empty = renderTimelineHtml(buildTimeline([]), {
      failOn: 'medium',
      generatedAt: new Date(),
    });
    expect(empty).toContain('No runs yet');
  });
});

describe('runReport', () => {
  async function repoWithHistory() {
    const cwd = await mkdtemp(join(tmpdir(), 'kairos-report-'));
    await mkdir(join(cwd, HISTORY_DIR), { recursive: true });
    for (const r of HISTORY) {
      await writeFile(join(cwd, HISTORY_DIR, `${r.runId}.json`), JSON.stringify(r));
    }
    await writeFile(join(cwd, HISTORY_DIR, 'broken.json'), '{"not": "a report"}');
    return cwd;
  }

  it('loads history, skipping invalid files', async () => {
    const cwd = await repoWithHistory();
    const { reports, skipped } = await loadHistory(join(cwd, HISTORY_DIR));
    expect(reports).toHaveLength(3);
    expect(skipped).toEqual(['broken.json']);
  });

  it('prints a text timeline without writing HTML by default', async () => {
    const cwd = await repoWithHistory();
    const res = await runReport(cwd);
    expect(res.htmlPath).toBeUndefined();
    const text = renderTimelineText(res.timeline);
    expect(text).toContain('#2  2026-09-26 11:00  abc1234  2 finding(s)  (+2 opened)');
    expect(text).toContain('#3  2026-09-26 12:00  abc1234  1 finding(s)  (-1 resolved)');
    expect(text).toContain('3 run(s), 1 open now, 2 drift moment(s), 1 resolved, 0.16 Bobcoins.');
  });

  it('writes kairos-timeline.html with --html', async () => {
    const cwd = await repoWithHistory();
    const res = await runReport(cwd, { html: true, now: () => new Date('2026-09-26T13:00:00Z') });
    expect(res.htmlPath).toBe(join(cwd, TIMELINE_FILE));
    const html = await readFile(res.htmlPath!, 'utf8');
    expect(html).toContain('Generated 2026-09-26 13:00 UTC');
  });

  it('accepts an absolute --out path', async () => {
    const cwd = await repoWithHistory();
    const out = join(await mkdtemp(join(tmpdir(), 'kairos-out-')), 't.html');
    expect((await runReport(cwd, { html: true, out })).htmlPath).toBe(out);
    expect(await readFile(out, 'utf8')).toContain('Kairos timeline');
  });

  it('works without any history', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kairos-report-'));
    const res = await runReport(cwd);
    expect(renderTimelineText(res.timeline)).toContain('No runs');
  });
});
