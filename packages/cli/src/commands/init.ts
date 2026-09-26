import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';
import { CONFIG_PATH } from '../config/load.js';
import { BOB_MODES_TEMPLATE } from '../templates/bob-modes.js';
import { CONFIG_TEMPLATE } from '../templates/config.js';

export const BOB_MODES_PATH = '.bob/custom_modes.yaml';

export interface InitResult {
  created: string[];
  skipped: string[];
}

const FILES: ReadonlyArray<[path: string, content: string]> = [
  [CONFIG_PATH, CONFIG_TEMPLATE],
  [BOB_MODES_PATH, BOB_MODES_TEMPLATE],
];

/** Writes the Kairos config and Bob modes into `cwd`, never overwriting unless `force`. */
export async function initProject(
  cwd: string,
  opts: { force?: boolean } = {},
): Promise<InitResult> {
  const result: InitResult = { created: [], skipped: [] };
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
  return result;
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create .kairos/config.yaml and the Bob custom modes if missing')
    .option('--force', 'overwrite existing files')
    .action(async (opts: { force?: boolean }) => {
      const { created, skipped } = await initProject(process.cwd(), opts);
      for (const f of created) console.log(`created  ${f}`);
      for (const f of skipped) console.log(`exists   ${f} (use --force to overwrite)`);
    });
}
