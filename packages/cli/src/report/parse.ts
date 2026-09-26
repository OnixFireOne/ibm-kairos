import { BobReply, bobReplyJsonSchema } from './schema.js';

export class ReplyParseError extends Error {
  override name = 'ReplyParseError';
}

type ParseResult = { ok: true; reply: BobReply } | { ok: false; error: string };

/** Candidate JSON texts in order of preference: fenced blocks (last first), whole text, outermost braces. */
function candidates(text: string): string[] {
  const fenced = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/g)].map((m) => m[1]!);
  const out = [...fenced.reverse(), text.trim()];
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) out.push(text.slice(first, last + 1));
  return out;
}

/** Finds the first candidate that parses as JSON. */
export function extractJson(text: string): unknown {
  for (const candidate of candidates(text)) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new ReplyParseError('no JSON object found in the reply');
}

/** Tolerates common near-misses: a single line number instead of a range, a missing intent. */
function normalize(value: unknown): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray((value as { findings?: unknown }).findings)
  ) {
    return value;
  }
  const reply = value as { findings: Record<string, unknown>[] };
  for (const f of reply.findings) {
    if (!f || typeof f !== 'object') continue;
    if (f.intent === undefined) f.intent = null;
    for (const side of [f.code, f.intent] as Record<string, unknown>[]) {
      if (side && typeof side.lines === 'number') side.lines = [side.lines, side.lines];
    }
  }
  return value;
}

export function parseReply(text: string): ParseResult {
  let json: unknown;
  try {
    json = extractJson(text);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const result = BobReply.safeParse(normalize(json));
  if (result.success) return { ok: true, reply: result.data };
  const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  return { ok: false, error: issues.slice(0, 20).join('\n') };
}

export function repairPrompt(previous: string, error: string): string {
  return [
    'Your previous reply could not be used: it is not a single JSON object matching the schema.',
    `Problems:\n${error}`,
    `Previous reply:\n${previous.slice(0, 20_000)}`,
    'Return ONLY the corrected JSON object, no prose, matching this JSON Schema:',
    bobReplyJsonSchema(),
  ].join('\n\n');
}

/** Parses Bob's reply; on failure asks once for a corrected reply via `repair`. */
export async function parseWithRepair(
  text: string,
  repair: (prompt: string) => Promise<string>,
): Promise<BobReply> {
  const first = parseReply(text);
  if (first.ok) return first.reply;
  const second = parseReply(await repair(repairPrompt(text, first.error)));
  if (second.ok) return second.reply;
  throw new ReplyParseError(
    `Bob's reply is not a valid drift report, even after one repair attempt.\n` +
      `First attempt:\n${first.error}\nRepair attempt:\n${second.error}`,
  );
}
