import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import { execa } from 'execa';
import { ConfigError, loadConfig } from '../config/load.js';
import type { KairosConfig } from '../config/schema.js';
import { DiffError } from '../collector/diff.js';
import { BobEngine, type BobEngineOptions } from '../engine/bob.js';
import { EngineError, FIXTURES_DIR } from '../engine/index.js';
import { logDecision } from '../docs/log.js';
import { location } from '../report/markdown.js';
import { ReplyParseError } from '../report/parse.js';
import { DriftReport, type Finding } from '../report/schema.js';
import { DECISIONS_PATH, PROGRESS_PATH } from '../templates/living-docs.js';
import { type CheckResult, HISTORY_DIR, runCheck } from './check.js';

/** Files the `kairos-fix` mode may edit; mirrors its `fileRegex` in `.bob/custom_modes.yaml`. */
export const INTENT_FILE_RE = /\.(md|ya?ml|json|test\.ts)$/;
export const FIX_MODE = 'kairos-fix';
export const FIX_CODE_MODE = 'kairos-fix-code';

export class FixError extends Error {
  override name = 'FixError';
}

export type Truth = 'intent' | 'code';

export interface FixOptions {
  id: string;
  truth?: Truth;
  allowCode?: boolean;
  /** Keep the change without asking. */
  yes?: boolean;
  /** Re-run `check` after committing (default true). */
  check?: boolean;
  engine?: KairosConfig['engine'];
  /** Asks the user whether to keep the diff; required unless `yes`. */
  confirm?: (diff: string) => Promise<boolean>;
  log?: (line: string) => void;
  /** Test hooks. */
  bob?: Partial<BobEngineOptions>;
  now?: () => Date;
}

export type FixStatus = 'resolved' | 'still-open' | 'committed' | 'rejected' | 'no-change';

export interface FixResult {
  finding: Finding;
  truth: Truth;
  status: FixStatus;
  changedFiles: string[];
  diff: string;
  /** Bob's closing message (what it changed). */
  summary: string;
  costBobcoins?: number;
  taskId?: string;
  commit?: string;
  recheck?: CheckResult;
}

const git = async (cwd: string, ...args: string[]) => (await execa('git', args, { cwd })).stdout;

/** The newest `.kairos/history/<runId>.json` (run ids sort by time). */
export async function latestReport(cwd: string): Promise<DriftReport> {
  let names: string[] = [];
  try {
    names = (await readdir(join(cwd, HISTORY_DIR))).filter((n) => n.endsWith('.json'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const last = names.sort().at(-1);
  if (!last) throw new FixError('No check results yet. Run `kairos check` first.');
  return DriftReport.parse(JSON.parse(await readFile(join(cwd, HISTORY_DIR, last), 'utf8')));
}

/** Resolving on the code side means editing source unless the fix is just a missing test. */
export const needsCodeChange = (f: Finding, truth: Truth): boolean =>
  truth === 'intent' && f.type !== 'MISSING_TEST' && f.proposal.action !== 'add_test';

const TRUTH_TEXT: Record<Truth, string> = {
  intent:
    'The documented intent (spec, docs, contract) is correct: change the implementation or tests to match it.',
  code: 'The code is correct: update the intent side (spec, docs, contract) and tests to match the code.',
};

const evidence = (label: string, e: Finding['code']) =>
  `${label} \`${location(e)}\`\n\`\`\`\n${e.excerpt}\n\`\`\``;

/** The task given to Bob in the `kairos-fix` / `kairos-fix-code` mode. */
export function buildFixPrompt(f: Finding, truth: Truth, allowCode: boolean): string {
  const overridden = f.truth !== truth;
  return [
    `Resolve one Kairos drift finding in this repository.`,
    ``,
    `## ${f.id} · ${f.type} · severity ${f.severity}`,
    f.title,
    ``,
    evidence('Code', f.code),
    f.intent ? evidence('Intent', f.intent) : 'Intent: no intent source covers this yet.',
    ``,
    `Why it is drift: ${f.explanation}`,
    ``,
    `Source of truth: **${truth}**. ${TRUTH_TEXT[truth]}`,
    overridden
      ? `The auditor suggested "${f.truth}" and proposed (${f.proposal.action}): ${f.proposal.summary} The user decided otherwise, so adapt the fix to the source of truth above.`
      : `Proposed fix (${f.proposal.action}): ${f.proposal.summary}`,
    ``,
    `Rules:`,
    `- Make the smallest change that resolves this finding only. Do not fix other findings.`,
    allowCode
      ? `- You may edit source code, docs, specs, contracts and tests.`
      : `- Edit only docs, specs, contracts and tests (.md, .yaml, .yml, .json, .test.ts). Do not edit source code.`,
    `- If you add or change tests, run them.`,
    `- Do not commit. Finish with one or two sentences saying what you changed.`,
  ].join('\n');
}

interface Applied {
  summary: string;
  costBobcoins?: number;
  taskId?: string;
}

/** Bob edits the working tree; the mock applies `.kairos/fixtures/fix-<ID>.patch` if present. */
async function applyFix(
  cwd: string,
  config: KairosConfig,
  f: Finding,
  prompt: string,
  o: FixOptions,
): Promise<Applied> {
  if ((o.engine ?? config.engine) === 'mock') {
    // Ids renumber per run, so `fix-<ID>-<TYPE>.patch` tells apart KRS-002 of different runs.
    for (const name of [`fix-${f.id}-${f.type}.patch`, `fix-${f.id}.patch`]) {
      const patch = join(cwd, FIXTURES_DIR, name);
      if (
        !(await readFile(patch).then(
          () => true,
          () => false,
        ))
      )
        continue;
      await git(cwd, 'apply', patch);
      return { summary: `MockEngine: applied ${name}.`, costBobcoins: 0 };
    }
    return { summary: `MockEngine: no fixture fix-${f.id}-${f.type}.patch, nothing changed.` };
  }
  const bob = new BobEngine({
    cwd,
    // An edit run (read, edit, run tests) needs more turns than a read-only check.
    maxCost: config.session.maxCostPerRun,
    maxTurns: config.session.maxTurnsPerRun,
    mode: o.allowCode ? FIX_CODE_MODE : FIX_MODE,
    ...o.bob,
  });
  const res = await bob.analyze(prompt, { kind: 'fix' });
  return { summary: res.text.trim(), costBobcoins: res.costBobcoins, taskId: res.taskId };
}

const lines = (out: string) => out.split('\n').filter(Boolean);
/** Written by Kairos itself: run output, and PROGRESS.md entries the post-commit hook leaves behind. */
const isRuntime = (path: string) =>
  path.startsWith('.kairos/') || path === 'kairos-report.md' || path === PROGRESS_PATH;

async function untracked(cwd: string): Promise<string[]> {
  return lines(await git(cwd, 'ls-files', '--others', '--exclude-standard'));
}

async function revert(cwd: string, tracked: string[], added: string[]): Promise<void> {
  if (added.length) await git(cwd, 'reset', '-q', '--', ...added);
  if (tracked.length) await git(cwd, 'checkout', '--', ...tracked);
  await Promise.all(added.map((p) => rm(join(cwd, p), { force: true })));
}

/** Same finding in a later report: ids are renumbered per run, so match on type + code file. */
export const sameFinding = (a: Finding, b: Finding): boolean =>
  a.type === b.type && a.code.file === b.code.file;

/** finding → Bob edits → diff → confirm → commit → re-check. */
export async function runFix(cwd: string, o: FixOptions): Promise<FixResult> {
  const log = o.log ?? (() => {});
  const config = await loadConfig(cwd);
  const report = await latestReport(cwd);
  const id = o.id.trim().toUpperCase();
  const finding = report.findings.find((f) => f.id.toUpperCase() === id);
  if (!finding) {
    const ids = report.findings.map((f) => f.id).join(', ') || 'none';
    throw new FixError(`No finding ${o.id} in run ${report.runId} (findings: ${ids}).`);
  }

  const truth = o.truth ?? finding.truth;
  if (truth === 'ask') {
    throw new FixError(
      `${finding.id} needs your decision: pass --truth intent (change the code to match the docs) ` +
        `or --truth code (update the docs to match the code).`,
    );
  }
  const allowCode = o.allowCode ?? false;
  if (needsCodeChange(finding, truth) && !allowCode) {
    throw new FixError(
      `${finding.id} with source of truth "intent" changes source code. Re-run with --allow-code, ` +
        `or pass --truth code to update the docs instead.`,
    );
  }
  if (!o.yes && !o.confirm) {
    throw new FixError('Not an interactive terminal: pass --yes to keep the fix without asking.');
  }
  const dirty = lines(await git(cwd, 'status', '--porcelain', '--untracked-files=no'))
    .map((l) => l.slice(3))
    .filter((p) => !isRuntime(p));
  if (dirty.length) {
    throw new FixError('The working tree has uncommitted changes. Commit or stash them first.');
  }

  const before = new Set(await untracked(cwd));
  log(`Fixing ${finding.id} (${finding.type}): ${finding.title}\nSource of truth: ${truth}`);
  const changes = async () => ({
    tracked: lines(await git(cwd, 'diff', '--name-only')).filter((p) => !isRuntime(p)),
    added: (await untracked(cwd)).filter((p) => !before.has(p) && !isRuntime(p)),
  });
  let applied: Applied;
  try {
    applied = await applyFix(cwd, config, finding, buildFixPrompt(finding, truth, allowCode), o);
  } catch (err) {
    // Bob stopped midway (turn or cost cap, crash): never leave half a fix in the tree.
    const partial = await changes();
    if (err instanceof EngineError && partial.tracked.length + partial.added.length > 0) {
      await revert(cwd, partial.tracked, partial.added);
      err.message += ` Bob's partial changes (${[...partial.tracked, ...partial.added].join(', ')}) were reverted.`;
    }
    throw err;
  }

  const { tracked, added } = await changes();
  const changedFiles = [...tracked, ...added].sort();
  const base: Omit<FixResult, 'status' | 'diff'> = {
    finding,
    truth,
    changedFiles,
    summary: applied.summary,
    costBobcoins: applied.costBobcoins,
    taskId: applied.taskId,
  };
  if (changedFiles.length === 0) return { ...base, status: 'no-change', diff: '' };

  if (added.length) await git(cwd, 'add', '--intent-to-add', '--', ...added);
  const diff = await git(cwd, 'diff', '--no-color', '--', ...changedFiles);

  const outside = changedFiles.filter((p) => !INTENT_FILE_RE.test(p));
  if (!allowCode && outside.length) {
    await revert(cwd, tracked, added);
    throw new FixError(
      `The fix touched source files without --allow-code (${outside.join(', ')}); reverted.`,
    );
  }

  const keep = o.yes || (await o.confirm!(diff));
  if (!keep) {
    await revert(cwd, tracked, added);
    return { ...base, status: 'rejected', diff };
  }

  const logged = await logDecision(cwd, {
    date: (o.now?.() ?? new Date()).toISOString().slice(0, 10),
    id: finding.id,
    type: finding.type,
    title: finding.title,
    truth,
    location: location(finding.code),
    files: changedFiles,
    summary: applied.summary,
  });
  await git(cwd, 'add', '--', ...changedFiles, ...(logged ? [DECISIONS_PATH] : []));
  await git(
    cwd,
    'commit',
    '-q',
    '-m',
    `kairos fix ${finding.id}: ${finding.title}`,
    '-m',
    `Source of truth: ${truth}. ${finding.type}, ${location(finding.code)}.\n\n${applied.summary}`,
  );
  const commit = (await git(cwd, 'rev-parse', '--short', 'HEAD')).trim();
  if (o.check === false) return { ...base, status: 'committed', diff, commit };

  const recheck = await runCheck(cwd, { engine: o.engine, now: o.now, bob: o.bob });
  const open = recheck.report.findings.some((f) => sameFinding(f, finding));
  return { ...base, status: open ? 'still-open' : 'resolved', diff, commit, recheck };
}

async function askKeep(diff: string): Promise<boolean> {
  console.log(`\n${diff}\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question('Keep this fix and commit it? [y/N] ')).trim());
  } finally {
    rl.close();
  }
}

const KNOWN_ERRORS = [FixError, ConfigError, DiffError, EngineError, ReplyParseError];

export function registerFix(program: Command): void {
  program
    .command('fix')
    .description('Let IBM Bob resolve one finding from the last check, then commit and re-check')
    .requiredOption('--id <id>', 'finding id from the last report, e.g. KRS-002')
    .option('--truth <side>', 'intent | code: which side is correct (overrides the report)')
    .option('--allow-code', 'allow Bob to edit source code, not only docs and tests')
    .option('--yes', 'keep the fix without asking')
    .option('--engine <engine>', 'bob | mock (default: config engine)')
    .option('--no-check', 'do not re-run check after committing')
    .action(
      async (o: {
        id: string;
        truth?: string;
        allowCode?: boolean;
        yes?: boolean;
        engine?: string;
        check: boolean;
      }) => {
        if (o.truth !== undefined && o.truth !== 'intent' && o.truth !== 'code') {
          console.error(`kairos: --truth must be intent or code, got "${o.truth}"`);
          process.exitCode = 2;
          return;
        }
        if (o.engine !== undefined && o.engine !== 'bob' && o.engine !== 'mock') {
          console.error(`kairos: unknown engine "${o.engine}" (use bob or mock)`);
          process.exitCode = 2;
          return;
        }
        try {
          const res = await runFix(process.cwd(), {
            id: o.id,
            truth: o.truth as Truth | undefined,
            allowCode: o.allowCode,
            yes: o.yes,
            engine: o.engine as KairosConfig['engine'] | undefined,
            check: o.check,
            confirm: process.stdin.isTTY ? askKeep : undefined,
            log: (line) => console.log(line),
          });
          if (o.yes && res.diff) console.log(`\n${res.diff}\n`);
          console.log(res.summary);
          if (res.costBobcoins !== undefined) console.log(`Cost: ${res.costBobcoins} Bobcoins`);
          const MESSAGES: Record<FixStatus, string> = {
            resolved: `✅ ${res.finding.id} resolved (commit ${res.commit}); re-check no longer reports it.`,
            'still-open': `⚠️ Committed ${res.commit}, but the re-check still reports this drift. See kairos-report.md.`,
            committed: `Committed ${res.commit}. Run \`kairos check\` to confirm.`,
            rejected: 'Fix discarded; the working tree is back to where it was.',
            'no-change': 'Bob made no changes.',
          };
          console.log(MESSAGES[res.status]);
          process.exitCode = res.status === 'still-open' || res.status === 'no-change' ? 1 : 0;
        } catch (err) {
          if (!KNOWN_ERRORS.some((E) => err instanceof E)) throw err;
          const taskId =
            err instanceof EngineError && err.taskId ? ` (Bob task ${err.taskId})` : '';
          console.error(`kairos: ${(err as Error).message}${taskId}`);
          process.exitCode = 2;
        }
      },
    );
}
