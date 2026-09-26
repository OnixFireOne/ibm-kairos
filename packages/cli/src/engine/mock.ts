import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Engine, type EngineResult, sha256 } from './types.js';

export const FIXTURES_DIR = '.kairos/fixtures';
export const FALLBACK_FIXTURE = 'fallback.txt';
export const EMPTY_REPLY = JSON.stringify({
  findings: [],
  summary: 'MockEngine: no fixture for this prompt.',
});

/** File name of the fixture that answers `prompt`. */
export const fixtureName = (prompt: string): string => `${sha256(prompt)}.txt`;

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

/** Replays recorded replies: `<dir>/<sha256(prompt)>.txt`, else `<dir>/fallback.txt`, else no findings. */
export class MockEngine implements Engine {
  readonly name = 'mock';
  constructor(private readonly dir: string) {}

  async analyze(prompt: string): Promise<EngineResult> {
    const text =
      (await readIfExists(join(this.dir, fixtureName(prompt)))) ??
      (await readIfExists(join(this.dir, FALLBACK_FIXTURE))) ??
      EMPTY_REPLY;
    return { text, costBobcoins: 0, raw: text };
  }
}
