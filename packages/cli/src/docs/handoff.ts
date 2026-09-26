import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import type { KairosConfig } from '../config/schema.js';
import { BobEngine, type BobEngineOptions } from '../engine/bob.js';
import { EngineError } from '../engine/types.js';
import { REPORT_FILE } from '../report/markdown.js';
import type { DriftReport } from '../report/schema.js';
import { KAIROS_DOCS_DIR } from '../templates/living-docs.js';
import { PLAN_PATH } from './freshness.js';

export const HANDOFF_PATH = `${KAIROS_DOCS_DIR}/HANDOFF.md`;
export const HANDOFF_MAX_CHARS = 3000;
export const DEV_MODE = 'kairos-dev';

export class HandoffError extends Error {
  override name = 'HandoffError';
}

export interface PlanStatus {
  done: string[];
  inProgress: string[];
  todo: string[];
}

export interface HandoffInput {
  date: string;
  /** Short hash of the last commit that touched HANDOFF.md, if any. */
  since?: string;
  /** `<hash> <subject>` since the last handoff (at most 30). */
  commits: string[];
  plan: PlanStatus;
  /** `git status --short` lines, ignoring Kairos runtime files. */
  dirty: string[];
  report?: Pick<DriftReport, 'runId' | 'summary' | 'findings'>;
  current?: string;
}

const readOrUndefined = (path: string) => readFile(path, 'utf8').catch(() => undefined);
const git = async (cwd: string, ...args: string[]) => (await execa('git', args, { cwd })).stdout;
const lines = (s: string) => s.split('\n').filter(Boolean);

/** `- [x] **T3 Context builder.** [→ task](…) Details` → `T3 Context builder` */
export const taskTitle = (item: string): string => {
  const bold = item.match(/\*\*(.+?)\*\*/);
  const text = (bold ? bold[1]! : item).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
  return text.replace(/\.$/, '').slice(0, 100);
};

export function parsePlan(plan: string): PlanStatus {
  const status: PlanStatus = { done: [], inProgress: [], todo: [] };
  for (const line of plan.split('\n')) {
    const m = line.match(/^\s*[-*] \[([ x~])\] (.+)$/i);
    if (!m) continue;
    const key = m[1] === ' ' ? 'todo' : m[1] === '~' ? 'inProgress' : 'done';
    status[key].push(taskTitle(m[2]!));
  }
  return status;
}

/** The task the next session should pick up: first `[~]`, else first `[ ]`. */
export const nextTask = (plan: PlanStatus): string | undefined =>
  plan.inProgress[0] ?? plan.todo[0];

/** `T3 Context builder` → `Continue T3: Context builder` */
export function firstMessage(plan: PlanStatus): string {
  const task = nextTask(plan);
  if (!task) return 'Continue';
  const m = task.match(/^(T\d+)\s+(.+)$/);
  return m ? `Continue ${m[1]}: ${m[2]}` : `Continue: ${task}`;
}

export async function collectHandoffInput(
  cwd: string,
  o: { now?: () => Date; report?: HandoffInput['report'] } = {},
): Promise<HandoffInput> {
  const [plan, current] = await Promise.all([
    readOrUndefined(join(cwd, PLAN_PATH)),
    readOrUndefined(join(cwd, HANDOFF_PATH)),
  ]);
  if (plan === undefined) {
    throw new HandoffError(`No ${PLAN_PATH} here. Run \`kairos init\` first.`);
  }
  const since =
    (await git(cwd, 'log', '-1', '--format=%h', '--', HANDOFF_PATH)).trim() || undefined;
  const range = since ? [`${since}..HEAD`] : ['-30'];
  const commits = lines(await git(cwd, 'log', '--format=%h %s', ...range)).slice(0, 30);
  const dirty = lines(await git(cwd, 'status', '--short')).filter(
    (l) => !/ (\.kairos\/|kairos-report\.md$)/.test(l),
  );
  return {
    date: (o.now?.() ?? new Date()).toISOString().slice(0, 10),
    since,
    commits,
    plan: parsePlan(plan),
    dirty,
    report: o.report,
    current,
  };
}

const section = (md: string | undefined, heading: string): string | undefined => {
  if (!md) return undefined;
  const m = md.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  const body = m?.[1]?.trim();
  return body || undefined;
};

const lastCheck = (r: HandoffInput['report']) =>
  r
    ? `- ${r.runId}: ${r.findings.length} finding(s). ${r.summary} Details: \`${REPORT_FILE}\`.`
    : '- No `kairos check` run yet.';

/** HANDOFF.md built from git + PLAN + the last report with no LLM (mock engine, offline). */
export function draftHandoff(input: HandoffInput): string {
  const { plan } = input;
  const next = nextTask(plan);
  const list = (items: string[], empty: string) =>
    items.length ? items.map((i) => `- ${i}`).join('\n') : `- ${empty}`;
  const text = [
    '# Handoff',
    '',
    `Updated: ${input.date} by \`kairos handoff\` (draft from git and PLAN.md).`,
    '',
    '## State',
    `- Done: ${plan.done.join('; ') || 'nothing marked [x] yet'}.`,
    `- Uncommitted changes: ${input.dirty.length ? input.dirty.map((d) => `\`${d.trim()}\``).join(', ') : 'none'}.`,
    '',
    '## In progress',
    list(plan.inProgress, 'Nothing marked [~] in PLAN.md.'),
    '',
    '## Next step',
    `1. ${next ?? 'All PLAN.md tasks are done: add the next ones.'}`,
    '',
    '## Recent commits',
    list(input.commits.slice(0, 10), 'none since the last handoff'),
    '',
    '## Gotchas',
    section(input.current, 'Gotchas') ?? '- None recorded yet.',
    '',
    '## Read first',
    `- This file, \`${PLAN_PATH}\`, the current task file in \`${KAIROS_DOCS_DIR}/tasks/\`, and only the \`SPEC.md\` sections the task needs.`,
    '',
    '## Last check',
    lastCheck(input.report),
    '',
  ].join('\n');
  return text;
}

/** The task given to Bob (`kairos-dev` mode) to write HANDOFF.md. */
export function buildHandoffPrompt(input: HandoffInput): string {
  const { plan } = input;
  return [
    '# Kairos handoff',
    '',
    `Write ${HANDOFF_PATH}: the snapshot a new session (any model) reads first to continue this work without the chat history.`,
    '',
    'Rules:',
    '- Use exactly these sections: `## State`, `## In progress`, `## Next step`, `## Gotchas`, `## Read first` (file list), `## Last check`.',
    '- Keep what is still true in the current handoff, update what changed, drop what is done. Keep the gotchas unless they are obsolete.',
    '- "Next step" must be concrete enough to start from a single "continue" message.',
    `- At most ${HANDOFF_MAX_CHARS} characters. Open repository files if you need to confirm something.`,
    '- Do not modify any files. Reply with the complete Markdown of HANDOFF.md only, starting with `# Handoff`.',
    '',
    `## Today\n${input.date}`,
    `## Commits since the last handoff${input.since ? ` (${input.since})` : ''}`,
    input.commits.map((c) => `- ${c}`).join('\n') || '- none',
    '## PLAN.md status',
    `Done: ${plan.done.join('; ') || 'none'}`,
    `In progress: ${plan.inProgress.join('; ') || 'none'}`,
    `Todo: ${plan.todo.join('; ') || 'none'}`,
    `## Uncommitted changes\n${input.dirty.join('\n') || 'none'}`,
    `## Last check\n${lastCheck(input.report)}`,
    '## Current HANDOFF.md',
    input.current?.trim() || '(empty)',
    '',
  ].join('\n\n');
}

/** Bob's reply → HANDOFF.md text; rejects replies that are not a handoff. */
export function extractHandoff(reply: string): string {
  const start = reply.indexOf('# Handoff');
  if (start === -1 || !/^## Next step/m.test(reply)) {
    throw new EngineError(
      'Bob did not return a HANDOFF.md (missing "# Handoff" or "## Next step").',
    );
  }
  // Cut a closing code fence and anything Bob wrote after it.
  const body = reply.slice(start).split(/\n`{3,}/)[0]!;
  return `${body.trim()}\n`;
}

export interface HandoffOptions {
  engine?: KairosConfig['engine'];
  report?: HandoffInput['report'];
  now?: () => Date;
  bob?: Partial<BobEngineOptions>;
}

export interface HandoffResult {
  path: string;
  text: string;
  firstMessage: string;
  costBobcoins?: number;
  taskId?: string;
}

/** git log + PLAN + last report → HANDOFF.md, drafted by Bob (or deterministically with mock). */
export async function runHandoff(
  cwd: string,
  config: KairosConfig,
  o: HandoffOptions = {},
): Promise<HandoffResult> {
  const input = await collectHandoffInput(cwd, o);
  let text: string;
  let costBobcoins: number | undefined;
  let taskId: string | undefined;
  if ((o.engine ?? config.engine) === 'mock') {
    text = draftHandoff(input);
  } else {
    const bob = new BobEngine({
      cwd,
      maxCost: config.budget.maxCost,
      maxTurns: config.budget.maxTurns,
      mode: DEV_MODE,
      now: o.now,
      ...o.bob,
    });
    const res = await bob.analyze(buildHandoffPrompt(input), { kind: 'handoff' });
    text = extractHandoff(res.text);
    costBobcoins = res.costBobcoins;
    taskId = res.taskId;
  }
  await writeFile(join(cwd, HANDOFF_PATH), text);
  return { path: HANDOFF_PATH, text, firstMessage: firstMessage(input.plan), costBobcoins, taskId };
}
