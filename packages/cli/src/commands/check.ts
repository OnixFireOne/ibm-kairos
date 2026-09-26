import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';
import { DiffError, getDiff } from '../collector/diff.js';
import { ConfigError, loadConfig } from '../config/load.js';
import type { KairosConfig } from '../config/schema.js';
import { buildContext } from '../context/builder.js';
import { createEngine, EngineError, type CreateEngineOptions } from '../engine/index.js';
import { blocking, renderMarkdown, renderSummary, REPORT_FILE } from '../report/markdown.js';
import { parseWithRepair, ReplyParseError } from '../report/parse.js';
import { bobReplyJsonSchema, DriftReport } from '../report/schema.js';

export const HISTORY_DIR = '.kairos/history';

export interface CheckOptions {
  base?: string;
  engine?: KairosConfig['engine'];
  noCache?: boolean;
  /** Test hooks. */
  now?: () => Date;
  bob?: CreateEngineOptions['bob'];
}

export interface CheckResult {
  report: DriftReport;
  config: KairosConfig;
  markdown: string;
  /** 1 if any finding reaches `failOn`, else 0. */
  exitCode: 0 | 1;
  historyPath: string;
  reportPath: string;
}

/** `20260926T100000Z-abc1234`: sortable, unique per head and second. */
const makeRunId = (at: Date, head: string): string =>
  `${at.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}-${head.slice(0, 7)}`;

/** diff → context → engine → validated report → history + Markdown files. */
export async function runCheck(cwd: string, opts: CheckOptions = {}): Promise<CheckResult> {
  const config = await loadConfig(cwd);
  const diff = await getDiff(opts.base ?? config.base, { cwd });
  const at = (opts.now ?? (() => new Date()))();

  let reply: { findings: DriftReport['findings']; summary: string };
  let bobcoins: number | undefined;
  if (diff.files.length === 0) {
    // Nothing to analyse: do not spend Bobcoins.
    reply = { findings: [], summary: `No changes between ${diff.base} and HEAD.` };
  } else {
    const { prompt } = await buildContext(cwd, diff, config, bobReplyJsonSchema());
    const engine = createEngine(config, {
      cwd,
      engine: opts.engine,
      noCache: opts.noCache,
      bob: opts.bob,
    });
    const addCost = (c?: number) => {
      if (c !== undefined) bobcoins = (bobcoins ?? 0) + c;
    };
    const first = await engine.analyze(prompt, { kind: 'check' });
    addCost(first.costBobcoins);
    reply = await parseWithRepair(first.text, async (repair) => {
      const res = await engine.analyze(repair, { kind: 'repair' });
      addCost(res.costBobcoins);
      return res.text;
    });
  }

  const report = DriftReport.parse({
    runId: makeRunId(at, diff.head),
    base: diff.base,
    head: diff.head,
    createdAt: at.toISOString(),
    summary: reply.summary,
    findings: reply.findings.filter((f) => f.confidence >= config.minConfidence),
    ...(bobcoins === undefined ? {} : { cost: { bobcoins: Math.round(bobcoins * 1e4) / 1e4 } }),
  });

  const markdown = renderMarkdown(report, { failOn: config.failOn });
  const historyPath = join(cwd, HISTORY_DIR, `${report.runId}.json`);
  const reportPath = join(cwd, REPORT_FILE);
  await mkdir(join(cwd, HISTORY_DIR), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(reportPath, markdown);

  const exitCode = blocking(report.findings, config.failOn).length > 0 ? 1 : 0;
  return { report, config, markdown, exitCode, historyPath, reportPath };
}

const KNOWN_ERRORS = [ConfigError, DiffError, EngineError, ReplyParseError];

export function registerCheck(program: Command): void {
  program
    .command('check')
    .description('Check the diff against the intent sources; exit 1 on drift at or above failOn')
    .option('--base <ref>', 'git base ref (default: config base)')
    .option('--engine <engine>', 'bob | mock (default: config engine)')
    .option('--json', 'print the report as JSON')
    .option('--no-cache', 'always call the engine, ignoring .kairos/cache')
    .action(async (o: { base?: string; engine?: string; json?: boolean; cache: boolean }) => {
      if (o.engine !== undefined && o.engine !== 'bob' && o.engine !== 'mock') {
        console.error(`kairos: unknown engine "${o.engine}" (use bob or mock)`);
        process.exitCode = 2;
        return;
      }
      try {
        const res = await runCheck(process.cwd(), {
          base: o.base,
          engine: o.engine,
          noCache: !o.cache,
        });
        if (o.json) {
          console.log(JSON.stringify(res.report, null, 2));
        } else {
          console.log(renderSummary(res.report, { failOn: res.config.failOn }));
          console.log(
            `\nReport: ${REPORT_FILE} · history: ${HISTORY_DIR}/${res.report.runId}.json`,
          );
          if (res.report.cost?.bobcoins !== undefined) {
            console.log(`Cost: ${res.report.cost.bobcoins} Bobcoins`);
          }
        }
        process.exitCode = res.exitCode;
      } catch (err) {
        if (!KNOWN_ERRORS.some((E) => err instanceof E)) throw err;
        const taskId = err instanceof EngineError && err.taskId ? ` (Bob task ${err.taskId})` : '';
        console.error(`kairos: ${(err as Error).message}${taskId}`);
        process.exitCode = 2;
      }
    });
}
