import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';
import { CONFIG_PATH } from '../config/load.js';
import { checkEnvironment, formatEnvChecks } from './doctor.js';
import { BOB_MODES_TEMPLATE } from '../templates/bob-modes.js';
import { CONFIG_TEMPLATE } from '../templates/config.js';
import {
  HOOK_MARKER,
  LIVING_DOCS,
  POINTER_FILES,
  postCommitHook,
  upsertPointer,
} from '../templates/living-docs.js';

export const BOB_MODES_PATH = '.bob/custom_modes.yaml';
export const POST_COMMIT_PATH = '.git/hooks/post-commit';

export interface InitResult {
  created: string[];
  skipped: string[];
  /** Existing files that got (or refreshed) a Kairos block. */
  updated: string[];
}

export interface InitOptions {
  force?: boolean;
  /** Entry script the post-commit hook runs with node, falling back to `kairos` on PATH. */
  kairosBin?: string;
}

const FILES: ReadonlyArray<[path: string, content: string]> = [
  [CONFIG_PATH, CONFIG_TEMPLATE],
  [BOB_MODES_PATH, BOB_MODES_TEMPLATE],
  ...LIVING_DOCS,
];

const readOrUndefined = (path: string) => readFile(path, 'utf8').catch(() => undefined);

/**
 * Writes the Kairos config, Bob modes and docs/kairos/ into `cwd` (never overwriting unless
 * `force`), adds the pointer block to CLAUDE.md / AGENTS.md, and installs the post-commit hook
 * in a git repo unless another hook is already there.
 */
export async function initProject(cwd: string, opts: InitOptions = {}): Promise<InitResult> {
  const result: InitResult = { created: [], skipped: [], updated: [] };
  for (const [rel, content] of FILES) {
    const path = join(cwd, rel);
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(path, content, { flag: opts.force ? 'w' : 'wx' });
      result.created.push(rel);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      result.skipped.push(rel);
    }
  }

  for (const rel of POINTER_FILES) {
    const path = join(cwd, rel);
    const existing = await readOrUndefined(path);
    const next = upsertPointer(existing);
    if (next === existing) continue;
    await writeFile(path, next);
    (existing === undefined ? result.created : result.updated).push(rel);
  }

  const isRepo = await stat(join(cwd, '.git')).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (isRepo) {
    const hook = join(cwd, POST_COMMIT_PATH);
    const existing = await readOrUndefined(hook);
    if (existing !== undefined && !existing.includes(HOOK_MARKER)) {
      result.skipped.push(POST_COMMIT_PATH);
    } else {
      const content = postCommitHook(opts.kairosBin);
      if (content !== existing) {
        await mkdir(dirname(hook), { recursive: true });
        await writeFile(hook, content);
        await chmod(hook, 0o755);
        (existing === undefined ? result.created : result.updated).push(POST_COMMIT_PATH);
      }
    }
  }
  return result;
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description(
      'Create .kairos/config.yaml, the Bob custom modes, docs/kairos/ living docs, agent pointers and the post-commit hook',
    )
    .option('--force', 'overwrite existing files')
    .action(async (opts: { force?: boolean }) => {
      const { created, skipped, updated } = await initProject(process.cwd(), {
        ...opts,
        kairosBin: process.argv[1],
      });
      for (const f of created) console.log(`created  ${f}`);
      for (const f of updated) console.log(`updated  ${f}`);
      for (const f of skipped) console.log(`exists   ${f} (use --force to overwrite)`);
      console.log(`\n${formatEnvChecks(await checkEnvironment())}`);
    });
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Check what live IBM Bob runs need: Bob Shell on PATH and BOB_API_KEY')
    .action(async () => {
      const checks = await checkEnvironment();
      console.log(formatEnvChecks(checks));
      if (!checks.every((c) => c.ok)) process.exitCode = 1;
    });
}
