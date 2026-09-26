import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type AnalyzeOptions, type Engine, type EngineResult, sha256 } from './types.js';

export const CACHE_DIR = '.kairos/cache';

interface CacheEntry {
  engine: string;
  createdAt: string;
  result: EngineResult;
}

/** Wraps an engine: identical prompts are answered from `<dir>/<sha256(prompt)>.json` at zero cost. */
export class CachedEngine implements Engine {
  readonly name: Engine['name'];
  constructor(
    private readonly inner: Engine,
    private readonly dir: string,
  ) {
    this.name = inner.name;
  }

  async analyze(prompt: string, opts?: AnalyzeOptions): Promise<EngineResult> {
    const path = join(this.dir, `${sha256(prompt)}.json`);
    const hit = await this.read(path);
    if (hit) return { ...hit.result, costBobcoins: 0, cached: true };
    const result = await this.inner.analyze(prompt, opts);
    const entry: CacheEntry = { engine: this.name, createdAt: new Date().toISOString(), result };
    await mkdir(this.dir, { recursive: true });
    await writeFile(path, JSON.stringify(entry, null, 2));
    return result;
  }

  private async read(path: string): Promise<CacheEntry | undefined> {
    try {
      const entry = JSON.parse(await readFile(path, 'utf8')) as CacheEntry;
      return entry.engine === this.name && typeof entry.result?.text === 'string'
        ? entry
        : undefined;
    } catch {
      return undefined; // missing or corrupt: treat as a miss
    }
  }
}
