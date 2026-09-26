import { join } from 'node:path';
import type { KairosConfig } from '../config/schema.js';
import { BobEngine, type BobEngineOptions } from './bob.js';
import { CACHE_DIR, CachedEngine } from './cache.js';
import { FIXTURES_DIR, MockEngine } from './mock.js';
import type { Engine } from './types.js';

export * from './types.js';
export { BobEngine, parseBobOutput, RUNS_DIR } from './bob.js';
export { CachedEngine, CACHE_DIR } from './cache.js';
export { MockEngine, FIXTURES_DIR, fixtureName } from './mock.js';

export interface CreateEngineOptions {
  cwd: string;
  engine?: KairosConfig['engine'];
  noCache?: boolean;
  bob?: Partial<BobEngineOptions>;
}

/** Builds the configured engine. Bob is cached unless `noCache`; the mock is free and never cached. */
export function createEngine(config: KairosConfig, o: CreateEngineOptions): Engine {
  const kind = o.engine ?? config.engine;
  if (kind === 'mock') return new MockEngine(join(o.cwd, FIXTURES_DIR));
  const bob = new BobEngine({
    cwd: o.cwd,
    maxCost: config.budget.maxCost,
    maxTurns: config.budget.maxTurns,
    ...o.bob,
  });
  return o.noCache ? bob : new CachedEngine(bob, join(o.cwd, CACHE_DIR));
}

/** Adapts an engine to the repair callback of `parseWithRepair`. */
export const repairWith =
  (engine: Engine) =>
  async (prompt: string): Promise<string> =>
    (await engine.analyze(prompt, { kind: 'repair' })).text;
