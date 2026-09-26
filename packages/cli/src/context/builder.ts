import type { DiffResult } from '../collector/types.js';
import type { KairosConfig } from '../config/schema.js';
import { freshnessCandidates } from '../docs/freshness.js';
import { loadIntentFiles } from './intent.js';
import { buildPrompt } from './prompt.js';
import { selectContext } from './select.js';
import type { ContextSelection } from './types.js';

export interface BuiltContext {
  prompt: string;
  selection: ContextSelection;
  candidates: string[];
}

/** Diff + config → intent excerpts within budget → Bob prompt. No LLM involved. */
export async function buildContext(
  cwd: string,
  diff: DiffResult,
  config: Pick<KairosConfig, 'intent' | 'tests' | 'map' | 'budget'>,
  outputSchema: string,
): Promise<BuiltContext> {
  const intent = await loadIntentFiles(cwd, { intent: config.intent, tests: config.tests });
  // The diff always goes in whole; excerpts share what is left of the budget.
  const maxChars = Math.max(0, config.budget.maxContextChars - diff.raw.length);
  const selection = selectContext(diff, intent, { map: config.map, maxChars });
  const candidates = await freshnessCandidates(cwd, diff);
  return {
    prompt: buildPrompt({ diff, selection, outputSchema, candidates }),
    selection,
    candidates,
  };
}
