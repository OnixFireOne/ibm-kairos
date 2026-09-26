import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import type { Command } from 'commander';
import { execa } from 'execa';
import type { KairosConfig } from '../config/schema.js';
import { REPORT_FILE } from '../report/markdown.js';

export const PRE_PUSH_MARKER = '# kairos:pre-push';

export interface HookOptions {
  /** Entry script the hook runs with node, falling back to `kairos` on PATH. */
  kairosBin?: string;
  /** Engine baked into the hook (default: the config engine at push time). */
  engine?: KairosConfig['engine'];
  /** Replace a pre-push hook Kairos did not write. */
  force?: boolean;
}

export type HookStatus = 'created' | 'updated' | 'unchanged' | 'foreign' | 'removed' | 'absent';

export class HookError extends Error {}

/**
 * `pre-push` hook: runs `kairos check`. Exit 1 (drift at or above failOn) blocks the push;
 * any other failure (no kairos, no Bob, bad config) only warns, so a broken tool never locks
 * the user out of pushing.
 */
export function prePushHook(opts: HookOptions = {}): string {
  const engine = opts.engine ? ` --engine ${opts.engine}` : '';
  const pick = opts.kairosBin
    ? `if [ -f "${opts.kairosBin}" ]; then set -- node "${opts.kairosBin}"; else set -- kairos; fi`
    : 'set -- kairos';
  return `#!/bin/sh
${PRE_PUSH_MARKER} (written by kairos hook install): block the push on intent drift.
# Skip once with: git push --no-verify
${pick}
"$@" check${engine}
status=$?
if [ "$status" -eq 1 ]; then
  echo "kairos: drift found, push blocked. See ${REPORT_FILE}; fix it or push with --no-verify." >&2
  exit 1
fi
if [ "$status" -ne 0 ]; then
  echo "kairos: check could not run (exit $status); pushing anyway." >&2
fi
exit 0
`;
}

/** Hook path as git sees it (honours worktrees and core.hooksPath). */
export async function hookPath(cwd: string, name: string): Promise<string> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--git-path', `hooks/${name}`], { cwd });
    return isAbsolute(stdout) ? stdout : join(cwd, stdout);
  } catch {
    throw new HookError('not a git repository');
  }
}

const readOrUndefined = (path: string) => readFile(path, 'utf8').catch(() => undefined);

export async function installPrePush(cwd: string, opts: HookOptions = {}): Promise<HookStatus> {
  const path = await hookPath(cwd, 'pre-push');
  const existing = await readOrUndefined(path);
  if (existing !== undefined && !existing.includes(PRE_PUSH_MARKER) && !opts.force) {
    return 'foreign';
  }
  const content = prePushHook(opts);
  if (content === existing) return 'unchanged';
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  await chmod(path, 0o755);
  return existing === undefined ? 'created' : 'updated';
}

/** Removes the pre-push hook only if Kairos wrote it. */
export async function uninstallPrePush(cwd: string): Promise<HookStatus> {
  const path = await hookPath(cwd, 'pre-push');
  const existing = await readOrUndefined(path);
  if (existing === undefined) return 'absent';
  if (!existing.includes(PRE_PUSH_MARKER)) return 'foreign';
  await rm(path);
  return 'removed';
}

const MESSAGES: Record<HookStatus, string> = {
  created: 'Installed the pre-push hook: `git push` now runs `kairos check`.',
  updated: 'Updated the pre-push hook.',
  unchanged: 'The pre-push hook is already installed.',
  foreign: 'A pre-push hook Kairos did not write is in place; left it alone (use --force).',
  removed: 'Removed the pre-push hook.',
  absent: 'No pre-push hook installed.',
};

export function registerHook(program: Command): void {
  const hook = program.command('hook').description('Manage the git pre-push hook');
  hook
    .command('install')
    .description('Install a pre-push hook that runs `kairos check` and blocks the push on drift')
    .option('--engine <engine>', 'bob | mock (default: config engine at push time)')
    .option('--force', 'replace an existing pre-push hook')
    .action(async (o: { engine?: string; force?: boolean }) => {
      if (o.engine !== undefined && o.engine !== 'bob' && o.engine !== 'mock') {
        console.error(`kairos: unknown engine "${o.engine}" (use bob or mock)`);
        process.exitCode = 2;
        return;
      }
      const engine = o.engine;
      await run(() =>
        installPrePush(process.cwd(), {
          engine,
          force: o.force,
          kairosBin: process.argv[1],
        }),
      );
    });
  hook
    .command('uninstall')
    .description('Remove the pre-push hook if Kairos installed it')
    .action(() => run(() => uninstallPrePush(process.cwd())));
}

async function run(action: () => Promise<HookStatus>): Promise<void> {
  try {
    const status = await action();
    console.log(MESSAGES[status]);
    if (status === 'foreign') process.exitCode = 1;
  } catch (err) {
    if (!(err instanceof HookError)) throw err;
    console.error(`kairos: ${err.message}`);
    process.exitCode = 2;
  }
}
