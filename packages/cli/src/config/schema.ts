import { z } from 'zod';

export const SEVERITIES = ['low', 'medium', 'high'] as const;
export const Severity = z.enum(SEVERITIES);
export type Severity = z.infer<typeof Severity>;

export const Budget = z.object({
  maxCost: z.number().positive().default(2),
  maxTurns: z.number().int().positive().default(8),
  maxContextChars: z.number().int().positive().default(60_000),
});

/** `kairos session`: per-run caps for Bob and the session budget that triggers a handoff. */
export const Session = z.object({
  maxCostPerRun: z.number().positive().default(3),
  maxTurnsPerRun: z.number().int().positive().default(40),
  toolCallBudget: z.number().int().positive().default(40),
  bobcoinBudget: z.number().positive().default(5),
});

export const KairosConfig = z.object({
  base: z.string().min(1).default('origin/main'),
  intent: z
    .array(z.string().min(1))
    .default(['docs/**/*.md', 'adr/**/*.md', 'openapi.yaml', 'README.md']),
  tests: z.array(z.string().min(1)).default(['**/*.test.ts']),
  map: z.record(z.string(), z.array(z.string().min(1))).default({}),
  failOn: Severity.default('medium'),
  minConfidence: z.number().min(0).max(1).default(0.6),
  budget: Budget.prefault({}),
  session: Session.prefault({}),
  engine: z.enum(['bob', 'mock']).default('bob'),
});

export type KairosConfig = z.infer<typeof KairosConfig>;
