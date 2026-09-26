/** One `@@ -a,b +c,d @@ header` block of a unified diff. */
export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Text after the closing `@@` (git's enclosing-function hint), trimmed; '' if none. */
  header: string;
  /** Hunk body lines with their ' ', '+' or '-' prefix; `\ No newline at end of file` markers excluded. */
  lines: string[];
  /** New-file line numbers of '+' lines. */
  added: number[];
  /** Old-file line numbers of '-' lines. */
  removed: number[];
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface FileDiff {
  /** Path after the change (for deleted files: the path before). */
  path: string;
  /** Previous path for renamed files, otherwise null. */
  oldPath: string | null;
  status: FileStatus;
  binary: boolean;
  hunks: Hunk[];
}

export type SymbolKind = 'function' | 'class' | 'const' | 'route' | 'env';

export interface ChangedSymbol {
  kind: SymbolKind;
  /** Identifier; routes are `METHOD /path` (e.g. `DELETE /orders/:id`); env vars are the bare name. */
  name: string;
  file: string;
  /** Line of the changed line that produced the symbol (new-file line for '+', old-file line for '-'). */
  line: number;
  change: 'added' | 'removed' | 'modified';
}

export interface DiffResult {
  /** The base ref as given. */
  base: string;
  /** Full sha of HEAD. */
  head: string;
  /** Raw unified diff text. */
  raw: string;
  files: FileDiff[];
  symbols: ChangedSymbol[];
}
