import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import { type BobEvent, type ProgressSink, ttyProgress } from './progress.js';
import {
  type AnalyzeOptions,
  type Engine,
  EngineError,
  type EngineResult,
  type RunKind,
} from './types.js';

export const RUNS_DIR = '.kairos/runs';

/** Result of spawning a process, normalised so tests can fake it. */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode?: number;
  timedOut?: boolean;
  /** Spawn error code, e.g. `ENOENT` when the binary is missing. */
  code?: string;
}
export type Exec = (
  file: string,
  args: string[],
  opts: {
    input: string;
    cwd: string;
    timeoutMs: number;
    env: NodeJS.ProcessEnv;
    /** Called with each complete stdout line as it arrives. */
    onLine?: (line: string) => void;
  },
) => Promise<ExecResult>;

const defaultExec: Exec = async (file, args, { input, cwd, timeoutMs, env, onLine }) => {
  const sub = execa(file, args, { input, cwd, env, timeout: timeoutMs, reject: false });
  let pending = '';
  sub.stdout?.on('data', (chunk: Buffer) => {
    const lines = (pending + chunk.toString()).split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) onLine?.(line);
  });
  const res = await sub;
  return {
    stdout: String(res.stdout ?? ''),
    stderr: String(res.stderr ?? ''),
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    code: (res as { code?: string }).code,
  };
};

export interface BobEngineOptions {
  cwd: string;
  maxCost: number;
  maxTurns: number;
  mode?: string;
  timeoutMs?: number;
  bin?: string;
  env?: NodeJS.ProcessEnv;
  exec?: Exec;
  now?: () => Date;
  /** Receives stream events while Bob works. Default: a live status line when stderr is a TTY. */
  progress?: ProgressSink | false;
}

interface BobResultLine {
  type: 'result';
  status: string;
  stats?: { task_id?: string; session_costs?: number; tool_calls?: number };
  last_message?: string;
}

/**
 * Splits `bob run` output (one JSON object per line) into error lines and the result.
 * `--format json` puts the reply in `result.last_message`; `--format stream-json` streams it as
 * assistant `message` chunks, so the reply is the text after the last tool call.
 */
export function parseBobOutput(stdout: string): { errors: string[]; result?: BobResultLine } {
  const errors: string[] = [];
  let result: BobResultLine | undefined;
  let reply = '';
  for (const line of stdout.split('\n')) {
    let event: BobEvent & { message?: string; content?: unknown };
    try {
      event = JSON.parse(line);
    } catch {
      continue; // banners, blank lines
    }
    if (event?.type === 'error') errors.push(String(event.message ?? 'unknown error'));
    if (event?.type === 'tool_use') reply = '';
    if (
      event?.type === 'message' &&
      event.role === 'assistant' &&
      typeof event.content === 'string'
    ) {
      reply += event.content;
    }
    if (event?.type === 'result') result = event as BobResultLine;
  }
  if (result && result.last_message === undefined && reply)
    result = { ...result, last_message: reply };
  return { errors, result };
}

const tail = (text: string, n = 500) => (text.length > n ? `…${text.slice(-n)}` : text).trim();

/** Runs prompts through IBM Bob Shell: `bob run --mode kairos --format stream-json`. */
export class BobEngine implements Engine {
  readonly name = 'bob';
  constructor(private readonly o: BobEngineOptions) {}

  async analyze(prompt: string, opts: AnalyzeOptions = {}): Promise<EngineResult> {
    const env = this.o.env ?? process.env;
    if (!env.BOB_API_KEY) {
      throw new EngineError(
        'BOB_API_KEY is not set. Headless `bob run` needs an IBM Bob API key with the Inference scope ' +
          '(the Bob IDE SSO login is not used). Export it, or run with `--engine mock`.',
      );
    }
    const bin = this.o.bin ?? 'bob';
    const args = [
      'run',
      '--trust',
      '--mode',
      this.o.mode ?? 'kairos',
      '--format',
      'stream-json',
      '--max-cost',
      String(this.o.maxCost),
      '--max-turns',
      String(this.o.maxTurns),
    ];
    const timeoutMs = this.o.timeoutMs ?? 10 * 60_000;
    const live =
      this.o.progress === undefined && !this.o.exec && process.stderr.isTTY
        ? ttyProgress(this.o.cwd)
        : undefined;
    const sink = this.o.progress || live?.sink;
    const onLine = sink
      ? (line: string) => {
          try {
            sink(JSON.parse(line) as BobEvent);
          } catch {
            // not an event
          }
        }
      : undefined;
    let res: ExecResult;
    try {
      res = await (this.o.exec ?? defaultExec)(bin, args, {
        input: prompt,
        cwd: this.o.cwd,
        timeoutMs,
        env,
        onLine,
      });
    } finally {
      live?.stop();
    }

    if (res.code === 'ENOENT') {
      throw new EngineError(
        `IBM Bob Shell (\`${bin}\`) is not installed or not on PATH. Install Bob Shell, or run with \`--engine mock\`.`,
      );
    }
    if (res.stdout.trim()) await this.saveRun(res.stdout, opts.kind ?? 'check');
    if (res.timedOut) {
      throw new EngineError(`\`bob run\` timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }

    const { errors, result } = parseBobOutput(res.stdout);
    const taskId = result?.stats?.task_id;
    // Bob ends with status "success" even when it hits --max-cost; the error line is what tells.
    if (errors.length) {
      throw new EngineError(`Bob reported an error: ${errors.join('; ')}`, taskId);
    }
    if (!result) {
      throw new EngineError(
        `\`bob run\` produced no result (exit code ${res.exitCode ?? '?'}).\n${tail(res.stderr || res.stdout)}`,
      );
    }
    if (result.status !== 'success' || typeof result.last_message !== 'string') {
      throw new EngineError(`Bob run ended with status "${result.status}".`, taskId);
    }
    return {
      text: result.last_message,
      costBobcoins: result.stats?.session_costs,
      toolCalls: result.stats?.tool_calls,
      taskId,
      raw: res.stdout,
    };
  }

  private async saveRun(stdout: string, kind: RunKind): Promise<void> {
    const ts = (this.o.now?.() ?? new Date())
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+/, '');
    const dir = join(this.o.cwd, RUNS_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${ts}-${kind}.json`), stdout);
  }
}
