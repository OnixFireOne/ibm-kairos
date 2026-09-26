import type { DiffResult } from '../collector/types.js';
import type { ContextSelection, Excerpt } from './types.js';

export interface PromptInput {
  diff: Pick<DiffResult, 'base' | 'head' | 'raw' | 'files' | 'symbols'>;
  selection: ContextSelection;
  /** JSON Schema of the expected reply (from the report schema, T4). */
  outputSchema: string;
}

const TASK = `# Kairos drift check

You are reviewing one code change against the project's documented intent: specs, ADRs, API contracts, README and tests.
Find every place where the change and the intent diverge. Never assume the code is right.

Rules:
- Report only real divergences backed by evidence: file and line range on the code side, and on the intent side when an intent source exists.
- Types: SPEC_VIOLATION (the code contradicts a documented rule), UNDOCUMENTED_BEHAVIOR (new behaviour with no spec or contract), STALE_DOC (a doc still describes something the change removed or renamed), MISSING_TEST (changed behaviour has no test), ADR_CONFLICT (the change contradicts a recorded decision).
- For each finding decide which side is the source of truth ("intent", "code" or "ask") and propose the fix on the other side.
- The excerpts below are a starting point. Open other repository files if you need to confirm or rule out a finding.
- Do not modify any files.
- If nothing diverges, return an empty findings list.`;

/** Wraps content in a code fence longer than any backtick run inside it. */
export function fence(content: string, lang = ''): string {
  const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}${lang}\n${content}\n${ticks}`;
}

function numbered(excerpt: Excerpt): string {
  const width = String(excerpt.endLine).length;
  return excerpt.text
    .split('\n')
    .map((line, i) => `${String(excerpt.startLine + i).padStart(width)}| ${line}`.trimEnd())
    .join('\n');
}

function renderExcerpt(e: Excerpt): string {
  const title = [e.file, e.heading, `lines ${e.startLine}-${e.endLine}`]
    .filter(Boolean)
    .join(' · ');
  return `### ${title}\nSelected because: ${e.reasons.join(', ')}\n${fence(numbered(e))}`;
}

/** Builds the full prompt sent to Bob in the `kairos` mode. */
export function buildPrompt({ diff, selection, outputSchema }: PromptInput): string {
  const files = diff.files.map((f) =>
    f.oldPath
      ? `- ${f.path} (renamed from ${f.oldPath})`
      : `- ${f.path} (${f.status}${f.binary ? ', binary' : ''})`,
  );
  const symbols = diff.symbols.map(
    (s) => `- ${s.change} ${s.kind} \`${s.name}\` (${s.file}:${s.line})`,
  );
  const excerpts = selection.excerpts.map(renderExcerpt);
  if (selection.omitted.length > 0) {
    excerpts.push(
      `(${selection.omitted.length} more excerpt(s) omitted to stay within the context budget: ` +
        `${selection.omitted.map((e) => `${e.file}:${e.startLine}-${e.endLine}`).join(', ')}.)`,
    );
  }

  return (
    [
      TASK,
      '## Change under review',
      // No head sha: the prompt depends only on the change, so cache and fixtures survive rebases.
      `Base: \`${diff.base}\``,
      `Changed files:\n${files.join('\n') || '- (none)'}`,
      `Changed symbols:\n${symbols.join('\n') || '- (none detected)'}`,
      fence(diff.raw.trimEnd(), 'diff'),
      '## Intent excerpts',
      excerpts.join('\n\n') ||
        'No intent excerpts matched this change. Search the repository yourself.',
      '## Output',
      'Reply with a single JSON object and nothing else. It must match this JSON Schema:',
      fence(outputSchema, 'json'),
    ].join('\n\n') + '\n'
  );
}
