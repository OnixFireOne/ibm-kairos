import { createHash } from 'node:crypto';

/** What the prompt is for; used to name saved raw runs. */
export type RunKind = 'check' | 'repair' | 'fix';

export interface AnalyzeOptions {
  kind?: RunKind;
}

export interface EngineResult {
  /** The engine's final message (Bob's `last_message`). */
  text: string;
  costBobcoins?: number;
  taskId?: string;
  /** Raw engine output, kept for evidence and debugging. */
  raw: string;
  /** True when served from `.kairos/cache` (costs nothing). */
  cached?: boolean;
}

export interface Engine {
  readonly name: 'bob' | 'mock';
  analyze(prompt: string, opts?: AnalyzeOptions): Promise<EngineResult>;
}

export class EngineError extends Error {
  override name = 'EngineError';
  constructor(
    message: string,
    readonly taskId?: string,
  ) {
    super(message);
  }
}

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
