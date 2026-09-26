import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Command } from 'commander';
import { ConfigError, loadConfig } from '../config/load.js';
import { renderTimelineHtml, TIMELINE_FILE } from '../report/html.js';
import { buildTimeline, loadHistory, type Timeline } from '../report/timeline.js';
import { HISTORY_DIR } from './check.js';

export interface ReportOptions {
  html?: boolean;
  /** Output path, absolute or relative to cwd (default `kairos-timeline.html`). */
  out?: string;
  now?: () => Date;
}

export interface ReportResult {
  timeline: Timeline;
  htmlPath?: string;
}

/** `.kairos/history` → timeline, and with `html` the single-file page. */
export async function runReport(cwd: string, opts: ReportOptions = {}): Promise<ReportResult> {
  const config = await loadConfig(cwd);
  const { reports, skipped } = await loadHistory(join(cwd, HISTORY_DIR));
  const timeline = buildTimeline(reports, skipped);
  if (!opts.html) return { timeline };
  const htmlPath = resolve(cwd, opts.out ?? TIMELINE_FILE);
  const now = (opts.now ?? (() => new Date()))();
  await writeFile(
    htmlPath,
    renderTimelineHtml(timeline, { failOn: config.failOn, generatedAt: now }),
  );
  return { timeline, htmlPath };
}

/** One line per run for the terminal. */
export function renderTimelineText(timeline: Timeline): string {
  if (timeline.runs.length === 0) return 'No runs in .kairos/history yet. Run `kairos check`.';
  const lines = timeline.runs.map((r, i) => {
    const n = r.report.findings.length;
    const delta = [
      r.opened.length > 0 ? `+${r.opened.length} opened` : '',
      r.resolved.length > 0 ? `-${r.resolved.length} resolved` : '',
    ]
      .filter(Boolean)
      .join(', ');
    return `#${i + 1}  ${r.report.createdAt.slice(0, 16).replace('T', ' ')}  ${r.report.head.slice(0, 7)}  ${n === 0 ? 'clean' : `${n} finding(s)`}${delta ? `  (${delta})` : ''}`;
  });
  const t = timeline.totals;
  lines.push(
    '',
    `${t.runs} run(s), ${t.open} open now, ${t.opened} drift moment(s), ${t.resolved} resolved, ${t.bobcoins} Bobcoins.`,
  );
  return lines.join('\n');
}

export function registerReport(program: Command): void {
  program
    .command('report')
    .description('Show the drift history from .kairos/history; --html writes a timeline page')
    .option('--html', `write a single-file HTML timeline (${TIMELINE_FILE})`)
    .option('--out <file>', 'HTML output path')
    .action(async (o: { html?: boolean; out?: string }) => {
      try {
        const res = await runReport(process.cwd(), {
          html: o.html || o.out !== undefined,
          out: o.out,
        });
        console.log(renderTimelineText(res.timeline));
        if (res.timeline.skipped.length > 0) {
          console.error(`Skipped invalid history files: ${res.timeline.skipped.join(', ')}`);
        }
        if (res.htmlPath) console.log(`\nTimeline: ${res.htmlPath}`);
      } catch (err) {
        if (!(err instanceof ConfigError)) throw err;
        console.error(`kairos: ${err.message}`);
        process.exitCode = 2;
      }
    });
}
