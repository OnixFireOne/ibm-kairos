import { execa } from 'execa';
import type { ChangedSymbol, DiffResult, FileDiff, Hunk, SymbolKind } from './types.js';

// ─── Error ────────────────────────────────────────────────────────────────────

export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiffError';
  }
}

// ─── parseDiff ────────────────────────────────────────────────────────────────

/** Parse a unified git diff into structured FileDiff objects. */
export function parseDiff(raw: string): FileDiff[] {
  if (!raw.trim()) return [];

  const files: FileDiff[] = [];
  const lines = raw.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Each file section starts with "diff --git a/X b/Y"
    if (!line.startsWith('diff --git ')) {
      i++;
      continue;
    }

    // Extract path from the b/ side of the header by default
    const diffHeader = line;
    const bMatch = diffHeader.match(/^diff --git a\/.+ b\/(.+)$/);
    const defaultPath = bMatch ? bMatch[1]! : '';

    i++;

    let status: FileDiff['status'] = 'modified';
    let path = defaultPath;
    let oldPath: string | null = null;
    let binary = false;

    // Read file-level header lines until we hit @@ or the next diff --git or EOF
    while (i < lines.length) {
      const h = lines[i]!;

      if (h.startsWith('diff --git ')) break;
      if (h.startsWith('@@ ')) break;

      if (h.startsWith('new file mode')) {
        status = 'added';
      } else if (h.startsWith('deleted file mode')) {
        status = 'deleted';
        // For deleted files, use the a/ path
        const aMatch = diffHeader.match(/^diff --git a\/(.+) b\/.+$/);
        if (aMatch) path = aMatch[1]!;
      } else if (h.startsWith('rename from ')) {
        const from = h.slice('rename from '.length);
        oldPath = from;
        status = 'renamed';
      } else if (h.startsWith('rename to ')) {
        path = h.slice('rename to '.length);
      } else if (h.startsWith('Binary files')) {
        binary = true;
      }

      i++;
    }

    // Parse hunks
    const hunks: Hunk[] = [];

    while (i < lines.length) {
      const h = lines[i]!;

      if (h.startsWith('diff --git ')) break;

      if (h.startsWith('@@ ')) {
        // Parse @@ -oldStart[,oldLines] +newStart[,newLines] @@ header
        const m = h.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
        if (!m) {
          i++;
          continue;
        }

        const oldStart = parseInt(m[1]!, 10);
        const oldLines = m[2] !== undefined ? parseInt(m[2], 10) : 1;
        const newStart = parseInt(m[3]!, 10);
        const newLines = m[4] !== undefined ? parseInt(m[4], 10) : 1;
        const header = m[5] ? m[5].replace(/^ /, '') : '';

        i++;

        const hunkLines: string[] = [];
        const added: number[] = [];
        const removed: number[] = [];
        let oldLine = oldStart;
        let newLine = newStart;

        while (i < lines.length) {
          const l = lines[i]!;

          if (l.startsWith('diff --git ') || l.startsWith('@@ ')) break;

          // Skip "\ No newline at end of file" markers
          if (l.startsWith('\\')) {
            i++;
            continue;
          }

          if (l.startsWith('+')) {
            added.push(newLine++);
            hunkLines.push(l);
          } else if (l.startsWith('-')) {
            removed.push(oldLine++);
            hunkLines.push(l);
          } else if (l.startsWith(' ')) {
            // Context line (space prefix)
            oldLine++;
            newLine++;
            hunkLines.push(l);
          }
          // Empty strings (trailing newline artefact) are silently ignored

          i++;
        }

        hunks.push({
          oldStart,
          oldLines,
          newStart,
          newLines,
          header,
          lines: hunkLines,
          added,
          removed,
        });
        continue;
      }

      i++;
    }

    files.push({ path, oldPath, status, binary, hunks });
  }

  return files;
}

// ─── Symbol extraction helpers ────────────────────────────────────────────────

/**
 * Extract all declarations from a single line of code (content without diff prefix).
 * Returns an array of [kind, name] pairs found on the line.
 */
function declarationsOnLine(content: string): Array<[SymbolKind, string]> {
  const results: Array<[SymbolKind, string]> = [];

  // function (async function, function*, async function*, export variants)
  const funcMatch = content.match(
    /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
  );
  if (funcMatch) results.push(['function', funcMatch[1]!]);

  // class Name
  const classMatch = content.match(
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
  );
  if (classMatch) results.push(['class', classMatch[1]!]);

  // const name = or const name:
  const constMatch = content.match(/(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:]/);
  if (constMatch) results.push(['const', constMatch[1]!]);

  // Routes: <ident>.(get|post|put|patch|delete)( followed by a quoted path starting with /
  // Every route call on the line produces a symbol
  const routeRe =
    /[A-Za-z_$][A-Za-z0-9_$]*\.(get|post|put|patch|delete)\s*\(\s*(?:'(\/[^']*)'|"(\/[^"]*)"|`(\/[^`]*)`)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = routeRe.exec(content)) !== null) {
    const method = rm[1]!.toUpperCase();
    const routePath = rm[2] ?? rm[3] ?? rm[4] ?? '';
    results.push(['route', `${method} ${routePath}`]);
  }

  // env vars: process.env.NAME or process.env['NAME'] / process.env["NAME"]
  const envRe =
    /process\.env\.([A-Za-z_][A-Za-z0-9_]*)|process\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g;
  let em: RegExpExecArray | null;
  while ((em = envRe.exec(content)) !== null) {
    const envName = em[1] ?? em[2] ?? '';
    results.push(['env', envName]);
  }

  return results;
}

/** Return true if the content (without prefix) starts at column 0 with }, ), or ] */
function isTopLevelCloser(content: string): boolean {
  return content.length > 0 && (content[0] === '}' || content[0] === ')' || content[0] === ']');
}

/** Try to find an enclosing declaration by walking backwards through hunk lines. */
function findEnclosing(
  hunk: Hunk,
  lineIndex: number,
  side: '+' | '-',
): { kind: SymbolKind; name: string } | null {
  // Walk backwards from lineIndex - 1 over lines of the same side (context + side)
  for (let j = lineIndex - 1; j >= 0; j--) {
    const l = hunk.lines[j]!;
    const prefix = l[0];
    const content = l.slice(1);

    // Only consider context lines and lines of the matching side
    if (prefix !== ' ' && prefix !== side) continue;

    if (isTopLevelCloser(content)) return null;

    const decls = declarationsOnLine(content);
    // Priority: function > class > route > const
    const priority: SymbolKind[] = ['function', 'class', 'route', 'const'];
    for (const kind of priority) {
      const found = decls.find(([k]) => k === kind);
      if (found) return { kind: found[0], name: found[1] };
    }
  }

  // Hunk start reached — try the hunk header
  if (hunk.header) {
    const headerDecls = declarationsOnLine(hunk.header);
    const priority: SymbolKind[] = ['function', 'class', 'route', 'const'];
    for (const kind of priority) {
      const found = headerDecls.find(([k]) => k === kind);
      if (found) return { kind: found[0], name: found[1] };
    }
  }

  return null;
}

// ─── extractSymbols ──────────────────────────────────────────────────────────

export function extractSymbols(files: FileDiff[]): ChangedSymbol[] {
  // Accumulate raw symbol candidates before merging
  interface RawSym {
    file: string;
    kind: SymbolKind;
    name: string;
    change: 'added' | 'removed' | 'modified';
    line: number;
    /** Whether this came from an enclosing lookup (lower priority) */
    isEnclosing: boolean;
  }

  const raws: RawSym[] = [];

  for (const file of files) {
    for (const hunk of file.hunks) {
      // Track per-line position in old/new numbering
      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;

      for (let li = 0; li < hunk.lines.length; li++) {
        const l = hunk.lines[li]!;
        const prefix = l[0] as ' ' | '+' | '-';
        const content = l.slice(1);

        if (prefix === ' ') {
          oldLine++;
          newLine++;
          continue;
        }

        const lineNum = prefix === '+' ? newLine : oldLine;
        const change: 'added' | 'removed' = prefix === '+' ? 'added' : 'removed';

        if (prefix === '+') newLine++;
        else oldLine++;

        // Skip blank changed lines for enclosing/own-decl purposes
        if (!content.trim()) continue;

        const ownDecls = declarationsOnLine(content);

        // Emit all own declarations (function/class/const/route/env)
        for (const [kind, name] of ownDecls) {
          raws.push({ file: file.path, kind, name, change, line: lineNum, isEnclosing: false });
        }

        // Enclosing lookup only when there is no function/class/const/route decl on this line
        const hasStructuralDecl = ownDecls.some(
          ([k]) => k === 'function' || k === 'class' || k === 'const' || k === 'route',
        );
        if (!hasStructuralDecl) {
          const enc = findEnclosing(hunk, li, prefix);
          if (enc) {
            raws.push({
              file: file.path,
              kind: enc.kind,
              name: enc.name,
              change: 'modified',
              line: lineNum,
              isEnclosing: true,
            });
          }
        }
      }
    }
  }

  // ── Merge rule 3 ────────────────────────────────────────────────────────────
  // Key: file + kind + name
  const key = (r: RawSym) => `${r.file}\0${r.kind}\0${r.name}`;

  const merged = new Map<string, ChangedSymbol>();

  for (const r of raws) {
    const k = key(r);
    const existing = merged.get(k);

    if (!existing) {
      // An enclosing 'modified' can seed a new entry (no existing entry to protect)
      merged.set(k, { kind: r.kind, name: r.name, file: r.file, line: r.line, change: r.change });
    } else {
      if (r.isEnclosing) {
        // Enclosing 'modified' never replaces an existing entry
        continue;
      }
      // Both non-enclosing: if one is 'added' and one is 'removed' => 'modified' at added line
      if (
        (existing.change === 'added' && r.change === 'removed') ||
        (existing.change === 'removed' && r.change === 'added')
      ) {
        const addedLine = existing.change === 'added' ? existing.line : r.line;
        merged.set(k, { ...existing, change: 'modified', line: addedLine });
      }
      // Otherwise first entry wins (do nothing)
    }
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  // Files in diff order; within a file by line ascending, then kind order, then name.
  const fileOrder = new Map<string, number>();
  files.forEach((f, i) => fileOrder.set(f.path, i));

  const kindOrder: SymbolKind[] = ['function', 'class', 'const', 'route', 'env'];

  return [...merged.values()].sort((a, b) => {
    const fi = (fileOrder.get(a.file) ?? 0) - (fileOrder.get(b.file) ?? 0);
    if (fi !== 0) return fi;
    if (a.line !== b.line) return a.line - b.line;
    const ki = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
    if (ki !== 0) return ki;
    return a.name.localeCompare(b.name);
  });
}

// ─── getDiff ─────────────────────────────────────────────────────────────────

export async function getDiff(base: string, opts?: { cwd?: string }): Promise<DiffResult> {
  const cwd = opts?.cwd ?? process.cwd();

  let raw: string;
  let head: string;

  try {
    const diffResult = await execa(
      'git',
      ['diff', '--unified=5', '--no-color', '--no-ext-diff', '-M', `${base}...HEAD`],
      { cwd },
    );
    raw = diffResult.stdout;
  } catch (err) {
    throw new DiffError(`git diff failed for base ref "${base}": ${String(err)}`);
  }

  try {
    const revResult = await execa('git', ['rev-parse', 'HEAD'], { cwd });
    head = revResult.stdout.trim();
  } catch (err) {
    throw new DiffError(`git rev-parse HEAD failed (base ref "${base}"): ${String(err)}`);
  }

  const filesDiff = parseDiff(raw);
  const symbols = extractSymbols(filesDiff);

  return { base, head, raw, files: filesDiff, symbols };
}
