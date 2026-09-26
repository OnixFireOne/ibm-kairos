import type { ChangedSymbol, FileDiff } from '../collector/types.js';
import { matchesGlob } from './glob.js';
import { splitMarkdown } from './sections.js';
import type { ContextSelection, Excerpt, IntentFile, Section } from './types.js';

// ─── isSearchable ─────────────────────────────────────────────────────────────

/**
 * Decide whether a symbol is worth searching for in intent files.
 *
 * - env and route: always searchable.
 * - function and class: searchable when the name has at least 3 characters.
 * - const: searchable when the name has at least 4 characters AND is either
 *   UPPER_CASE (letters, digits, underscores, at least one letter) or
 *   camelCase (a lowercase letter directly followed by an uppercase letter).
 */
export function isSearchable(symbol: ChangedSymbol): boolean {
  const { kind, name } = symbol;

  if (kind === 'env' || kind === 'route') return true;

  if (kind === 'function' || kind === 'class') {
    return name.length >= 3;
  }

  if (kind === 'const') {
    if (name.length < 4) return false;
    // UPPER_CASE: only letters, digits, underscores, at least one letter
    const isUpperCase = /^[A-Z0-9_]+$/.test(name) && /[A-Za-z]/.test(name);
    // camelCase: a lowercase letter directly followed by an uppercase letter somewhere
    const isCamelCase = /[a-z][A-Z]/.test(name);
    return isUpperCase || isCamelCase;
  }

  return false;
}

// ─── selectContext ─────────────────────────────────────────────────────────────

export function selectContext(
  diff: { files: FileDiff[]; symbols: ChangedSymbol[] },
  intent: IntentFile[],
  opts: { map: Record<string, string[]>; maxChars: number },
): ContextSelection {
  const rawExcerpts: RawExcerpt[] = [];

  // Build a lookup: path → IntentFile
  const intentByPath = new Map<string, IntentFile>();
  for (const f of intent) intentByPath.set(f.path, f);

  // Build a lookup: path → parsed sections (for markdown files only, on demand)
  const sectionsCache = new Map<string, Section[]>();
  function getSections(path: string): Section[] {
    if (sectionsCache.has(path)) return sectionsCache.get(path)!;
    const f = intentByPath.get(path);
    const secs = f ? splitMarkdown(path, f.text) : [];
    sectionsCache.set(path, secs);
    return secs;
  }

  // ── Map excerpts ─────────────────────────────────────────────────────────

  for (const [glob, targets] of Object.entries(opts.map)) {
    // Check whether at least one changed file matches this glob key.
    const anyMatch = diff.files.some((fd) => matchesGlob(fd.path, glob));
    if (!anyMatch) continue;

    const reason = `map:${glob}`;

    for (const target of targets) {
      const hashIdx = target.indexOf('#');
      if (hashIdx !== -1) {
        // `path#Heading` — select the section whose heading equals Heading (case-insensitive).
        const filePath = target.slice(0, hashIdx);
        const headingQuery = target.slice(hashIdx + 1);
        const intentFile = intentByPath.get(filePath);
        if (!intentFile) continue;

        const sections = getSections(filePath);
        const section = sections.find(
          (s) => s.heading.toLowerCase() === headingQuery.toLowerCase(),
        );
        if (!section) continue;

        rawExcerpts.push({
          file: filePath,
          heading: section.heading,
          startLine: section.startLine,
          endLine: section.blockEnd,
          text: extractLines(intentFile.text, section.startLine, section.blockEnd),
          reasons: [reason],
        });
      } else {
        // Bare path — select the whole file (line 1 to last line).
        const intentFile = intentByPath.get(target);
        if (!intentFile) continue;

        const lastLine = countLines(intentFile.text);
        if (lastLine === 0) continue;

        rawExcerpts.push({
          file: target,
          heading: null,
          startLine: 1,
          endLine: lastLine,
          text: extractLines(intentFile.text, 1, lastLine),
          reasons: [reason],
        });
      }
    }
  }

  // ── Symbol excerpts ───────────────────────────────────────────────────────

  for (const symbol of diff.symbols) {
    if (!isSearchable(symbol)) continue;

    const { name, kind } = symbol;
    const reason = `symbol:${name}`;
    const pattern = buildSymbolPattern(kind, name);

    for (const intentFile of intent) {
      const lines = splitLines(intentFile.text);
      const lastLine = lines.length;

      if (intentFile.kind === 'markdown') {
        // For markdown: find sections (flat startLine..endLine) containing a match.
        const sections = getSections(intentFile.path);
        for (const section of sections) {
          let found = false;
          for (let ln = section.startLine; ln <= section.endLine; ln++) {
            if (pattern.test(lines[ln - 1]!)) {
              found = true;
              break;
            }
          }
          if (found) {
            rawExcerpts.push({
              file: intentFile.path,
              heading: section.heading,
              startLine: section.startLine,
              endLine: section.endLine,
              text: extractLines(intentFile.text, section.startLine, section.endLine),
              reasons: [reason],
            });
          }
        }
      } else {
        // For non-markdown files: every matching line gives a ±10-line window.
        for (let ln = 1; ln <= lastLine; ln++) {
          if (pattern.test(lines[ln - 1]!)) {
            const winStart = Math.max(1, ln - 10);
            const winEnd = Math.min(lastLine, ln + 10);
            rawExcerpts.push({
              file: intentFile.path,
              heading: null,
              startLine: winStart,
              endLine: winEnd,
              text: extractLines(intentFile.text, winStart, winEnd),
              reasons: [reason],
            });
          }
        }
      }
    }
  }

  // ── Merge overlapping excerpts within the same file ───────────────────────

  const merged = mergeExcerpts(rawExcerpts, intentByPath);

  // ── Budget: walk in priority order, include or omit ───────────────────────

  const sorted = prioritySort(merged);

  const excerpts: Excerpt[] = [];
  const omitted: Excerpt[] = [];
  let chars = 0;

  for (const ex of sorted) {
    if (chars + ex.text.length <= opts.maxChars) {
      chars += ex.text.length;
      excerpts.push(ex);
    } else {
      omitted.push(ex);
    }
  }

  // Final sort: excerpts by file then startLine.
  excerpts.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.startLine - b.startLine));

  return { excerpts, omitted, chars };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RawExcerpt {
  file: string;
  heading: string | null;
  startLine: number;
  endLine: number;
  text: string;
  reasons: string[];
}

/** Count lines in text (trailing newline does not add a line). */
function countLines(text: string): number {
  if (!text) return 0;
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') return lines.length - 1;
  return lines.length;
}

/** Split text into lines (trailing newline does not add a line). */
function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') return lines.slice(0, -1);
  return lines;
}

/** Extract lines startLine..endLine from text (1-based, inclusive), joined with '\n'. */
function extractLines(text: string, startLine: number, endLine: number): string {
  const lines = splitLines(text);
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Build a search pattern for a symbol.
 *
 * - Routes: use the path part after the method; `:param` also matches `{param}`;
 *   match must not be followed by a word char, `/`, `{`, or `-`.
 * - Non-routes: whole-word match `\bNAME\b`.
 */
function buildSymbolPattern(kind: ChangedSymbol['kind'], name: string): RegExp {
  if (kind === 'route') {
    // name is `METHOD /path` — use only the path part.
    const spaceIdx = name.indexOf(' ');
    const pathPart = spaceIdx >= 0 ? name.slice(spaceIdx + 1) : name;

    // Build regex for the path: each `:param` segment also matches `{param}`.
    const pathRegex = pathPart
      .split('/')
      .map((segment) => {
        if (segment.startsWith(':')) {
          const paramName = segment.slice(1);
          // Escape paramName (should be identifier chars, but be safe).
          const escaped = escapeRegex(paramName);
          return `(?::${escaped}|\\{${escaped}\\})`;
        }
        return escapeRegex(segment);
      })
      .join('\\/');

    // Must not be followed by a word char, `/`, `{`, or `-`.
    return new RegExp(pathRegex + '(?![\\w/{\\-])');
  }

  // Non-route: whole-word match.
  return new RegExp(`\\b${escapeRegex(name)}\\b`);
}

/** Escape regex metacharacters in a literal string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Merge overlapping excerpts of the same file, repeating until stable.
 * Reasons are unioned, unique, sorted.
 * Heading: the heading of the excerpt with the smallest startLine (on a tie, the longer one);
 * null if that one has no heading.
 */
function mergeExcerpts(
  rawExcerpts: RawExcerpt[],
  intentByPath: Map<string, IntentFile>,
): Excerpt[] {
  // Group by file.
  const byFile = new Map<string, RawExcerpt[]>();
  for (const ex of rawExcerpts) {
    const arr = byFile.get(ex.file) ?? [];
    arr.push(ex);
    byFile.set(ex.file, arr);
  }

  const result: Excerpt[] = [];

  for (const [file, exs] of byFile) {
    const merged = mergeFileExcerpts(exs);

    // Recompute text for each merged excerpt.
    const intentFile = intentByPath.get(file);
    for (const ex of merged) {
      const text = intentFile ? extractLines(intentFile.text, ex.startLine, ex.endLine) : ex.text;
      result.push({ ...ex, text });
    }
  }

  return result;
}

/** Merge overlapping ranges within a single file, repeating until stable. */
function mergeFileExcerpts(exs: RawExcerpt[]): RawExcerpt[] {
  if (exs.length === 0) return [];

  // Sort by startLine.
  let list = [...exs].sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);

  let changed = true;
  while (changed) {
    changed = false;
    const next: RawExcerpt[] = [];

    let i = 0;
    while (i < list.length) {
      let cur = list[i]!;
      let j = i + 1;

      while (j < list.length) {
        const other = list[j]!;
        // Overlap (not merely adjacent): cur.endLine >= other.startLine
        // (i.e. they share at least one line)
        if (other.startLine <= cur.endLine) {
          // Merge cur and other.
          cur = mergeTwo(cur, other);
          j++;
          changed = true;
        } else {
          break;
        }
      }

      next.push(cur);
      i = j;
    }

    list = next;
  }

  return list;
}

/** Merge two overlapping RawExcerpts into one. */
function mergeTwo(a: RawExcerpt, b: RawExcerpt): RawExcerpt {
  const startLine = Math.min(a.startLine, b.startLine);
  const endLine = Math.max(a.endLine, b.endLine);

  // Reasons: union, unique, sorted.
  const reasons = [...new Set([...a.reasons, ...b.reasons])].sort();

  // Heading: the excerpt with the smallest startLine; on a tie, the longer heading; null if none.
  let heading: string | null;
  if (a.startLine < b.startLine) {
    heading = a.heading;
  } else if (b.startLine < a.startLine) {
    heading = b.heading;
  } else {
    // Tie: choose the longer heading string; null < any string.
    const ha = a.heading ?? '';
    const hb = b.heading ?? '';
    if (ha.length >= hb.length) {
      heading = a.heading;
    } else {
      heading = b.heading;
    }
  }

  return { file: a.file, heading, startLine, endLine, text: '', reasons };
}

/**
 * Sort excerpts in priority order for budget allocation:
 * 1. Excerpts with any `map:` reason first (fewer map reasons is fine, having ANY is the criterion).
 * 2. Then more distinct `symbol:` reasons first.
 * 3. Then file (plain string order).
 * 4. Then startLine.
 */
function prioritySort(excerpts: Excerpt[]): Excerpt[] {
  return [...excerpts].sort((a, b) => {
    const aHasMap = a.reasons.some((r) => r.startsWith('map:')) ? 1 : 0;
    const bHasMap = b.reasons.some((r) => r.startsWith('map:')) ? 1 : 0;
    if (bHasMap !== aHasMap) return bHasMap - aHasMap; // map: first (higher = 1 wins)

    const aSymCount = a.reasons.filter((r) => r.startsWith('symbol:')).length;
    const bSymCount = b.reasons.filter((r) => r.startsWith('symbol:')).length;
    if (bSymCount !== aSymCount) return bSymCount - aSymCount; // more symbols first

    if (a.file !== b.file) return a.file < b.file ? -1 : 1;

    return a.startLine - b.startLine;
  });
}
