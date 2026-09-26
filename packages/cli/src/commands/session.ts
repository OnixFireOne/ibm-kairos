import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';
import { ConfigError, loadConfig } from '../config/load.js';
import type { KairosConfig } from '../config/schema.js';
import {
  DEV_MODE,
  HANDOFF_PATH,
  HandoffError,
  type HandoffResult,
  runHandoff,
} from '../docs/handoff.js';
import { BobEngine, type BobEngineOptions } from '../engine/bob.js';
import { EngineError, FIXTURES_DIR, MockEngine } from '../engine/index.js';
import { EMPTY_REPLY } from '../engine/mock.js';
import { FixError, latestReport } from './fix.js';

export const SESSION_PATH = '.kairos/session.json';

export interface SessionRun {
  at: string;
  task: string;
  taskId?: string;
  toolCalls: number;
  bobcoins: number;
}

export interface SessionState {
  startedAt: string;
  runs: SessionRun[];
  toolCalls: number;
  bobcoins: number;
}

export interface SessionOptions {
  engine?: KairosConfig['engine'];
  /** Start a new session, forgetting the previous totals. */
  fresh?: boolean;
  now?: () => Date;
  bob?: Partial<BobEngineOptions>;
}

export interface SessionResult {
  reply: string;
  run: SessionRun;
  state: SessionState;
  overBudget: boolean;
  /** Written when the session went over budget; the session then starts over. */
  handoff?: HandoffResult;
}

export async function readSession(cwd: string): Promise<SessionState | undefined> {
  try {
    return JSON.parse(await readFile(join(cwd, SESSION_PATH), 'utf8')) as SessionState;
  } catch {
    return undefined;
  }
}

/** The newest check report, if any (for the handoff's "Last check"). */
export async function lastReportOrUndefined(cwd: string) {
  try {
    return await latestReport(cwd);
  } catch (err) {
    if (err instanceof FixError) return undefined;
    throw err;
  }
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * One `bob run --mode kairos-dev` step of a dev session. Totals (tool calls, Bobcoins) add up
 * in `.kairos/session.json`; over the budget Kairos writes HANDOFF.md and the session restarts,
 * which is the "good moment to start a new chat".
 */
export async function runSession(
  cwd: string,
  task: string,
  o: SessionOptions = {},
): Promise<SessionResult> {
  const config = await loadConfig(cwd);
  const now = o.now ?? (() => new Date());
  if (o.fresh) await rm(join(cwd, SESSION_PATH), { force: true });
  const engine = o.engine ?? config.engine;

  const res =
    engine === 'mock'
      ? await new MockEngine(join(cwd, FIXTURES_DIR)).analyze(task)
      : await new BobEngine({
          cwd,
          maxCost: config.session.maxCostPerRun,
          maxTurns: config.session.maxTurnsPerRun,
          mode: DEV_MODE,
          timeoutMs: 30 * 60_000,
          now: o.now,
          ...o.bob,
        }).analyze(task, { kind: 'session' });

  const reply =
    res.text === EMPTY_REPLY ? 'MockEngine: no fixture for this task.' : res.text.trim();
  const run: SessionRun = {
    at: now().toISOString(),
    task,
    ...(res.taskId ? { taskId: res.taskId } : {}),
    toolCalls: res.toolCalls ?? 0,
    bobcoins: res.costBobcoins ?? 0,
  };
  const prev = (await readSession(cwd)) ?? {
    startedAt: run.at,
    runs: [],
    toolCalls: 0,
    bobcoins: 0,
  };
  const state: SessionState = {
    startedAt: prev.startedAt,
    runs: [...prev.runs, run],
    toolCalls: prev.toolCalls + run.toolCalls,
    bobcoins: round(prev.bobcoins + run.bobcoins),
  };
  const overBudget =
    state.toolCalls >= config.session.toolCallBudget ||
    state.bobcoins >= config.session.bobcoinBudget;

  const path = join(cwd, SESSION_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`);
  if (!overBudget) return { reply, run, state, overBudget };

  const handoff = await runHandoff(cwd, config, {
    engine,
    report: await lastReportOrUndefined(cwd),
    now: o.now,
    bob: o.bob,
  });
  await rm(path, { force: true });
  return { reply, run, state, overBudget, handoff };
}

export const newChatMessage = (h: HandoffResult) =>
  `Good moment to start a new chat. Handoff is in ${HANDOFF_PATH}. First message: "${h.firstMessage}".`;

const KNOWN_ERRORS = [ConfigError, EngineError, HandoffError];

export function registerSession(program: Command): void {
  program
    .command('session')
    .description('Run one dev task through IBM Bob (kairos-dev mode) and track the session budget')
    .argument('<task>', 'what Bob should do, e.g. "continue" or "Continue T3: context builder"')
    .option('--new', 'start a new session (reset the totals)')
    .option('--engine <engine>', 'bob | mock (default: config engine)')
    .action(async (task: string, o: { new?: boolean; engine?: string }) => {
      if (o.engine !== undefined && o.engine !== 'bob' && o.engine !== 'mock') {
        console.error(`kairos: unknown engine "${o.engine}" (use bob or mock)`);
        process.exitCode = 2;
        return;
      }
      try {
        const cwd = process.cwd();
        const res = await runSession(cwd, task, {
          engine: o.engine as KairosConfig['engine'] | undefined,
          fresh: o.new,
        });
        const { session } = await loadConfig(cwd);
        console.log(res.reply);
        console.log(
          `\nSession: ${res.state.runs.length} run(s), ${res.state.toolCalls}/${session.toolCallBudget} tool calls, ` +
            `${res.state.bobcoins}/${session.bobcoinBudget} Bobcoins.`,
        );
        if (res.handoff) console.log(`\n${newChatMessage(res.handoff)}`);
      } catch (err) {
        if (!KNOWN_ERRORS.some((E) => err instanceof E)) throw err;
        const taskId = err instanceof EngineError && err.taskId ? ` (Bob task ${err.taskId})` : '';
        console.error(`kairos: ${(err as Error).message}${taskId}`);
        process.exitCode = 2;
      }
    });
}
