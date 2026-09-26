import { z } from 'zod';
import { Severity } from '../config/schema.js';

export const FINDING_TYPES = [
  'SPEC_VIOLATION',
  'UNDOCUMENTED_BEHAVIOR',
  'STALE_DOC',
  'MISSING_TEST',
  'ADR_CONFLICT',
] as const;
export const FindingType = z.enum(FINDING_TYPES);
export type FindingType = z.infer<typeof FindingType>;

const Line = z.number().int().min(1).max(1_000_000);

export const Evidence = z.object({
  file: z.string().min(1),
  lines: z.tuple([Line, Line]).describe('[first, last] 1-based line range'),
  excerpt: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Finding = z.object({
  id: z.string().min(1).describe('KRS-001, KRS-002, ... in reply order'),
  type: FindingType,
  severity: Severity,
  title: z.string().min(1),
  code: Evidence,
  intent: Evidence.nullable().describe(
    'null when no intent source exists (e.g. undocumented behaviour)',
  ),
  explanation: z.string().min(1).describe('why this is drift'),
  truth: z.enum(['intent', 'code', 'ask']).describe('which side is the source of truth'),
  proposal: z.object({
    action: z.enum(['update_code', 'update_spec', 'update_doc', 'add_test']),
    summary: z.string().min(1),
  }),
  confidence: z.number().min(0).max(1),
});
export type Finding = z.infer<typeof Finding>;

/** What Bob must reply with in the `kairos` mode. */
export const BobReply = z.object({
  findings: z.array(Finding),
  summary: z.string().describe('one or two sentences for humans'),
});
export type BobReply = z.infer<typeof BobReply>;

/** A stored check result (`.kairos/history/<runId>.json`). */
export const DriftReport = BobReply.extend({
  runId: z.string().min(1),
  base: z.string().min(1),
  head: z.string().min(1),
  createdAt: z.iso.datetime(),
  cost: z.object({ bobcoins: z.number().nonnegative().optional() }).optional(),
});
export type DriftReport = z.infer<typeof DriftReport>;

/** JSON Schema of BobReply, embedded in the prompt. */
export function bobReplyJsonSchema(): string {
  return JSON.stringify(z.toJSONSchema(BobReply, { reused: 'ref' }));
}
