/** A markdown section starting at an ATX heading (or the text before the first heading). */
export interface Section {
  /** Repo-relative posix path. */
  file: string;
  /** Heading text without the leading #'s, trimmed; '' for the preamble. */
  heading: string;
  /** 1–6 for headings, 0 for the preamble. */
  level: number;
  /** 1-based line of the heading (or of the first preamble line). */
  startLine: number;
  /** Last non-blank line before the next heading of any level. */
  endLine: number;
  /** Last non-blank line before the next heading of the same or a higher level (includes subsections). */
  blockEnd: number;
}

export interface IntentFile {
  /** Repo-relative posix path. */
  path: string;
  /** 'test' if matched by the tests globs, else 'markdown' for .md files, else 'other'. */
  kind: 'markdown' | 'test' | 'other';
  text: string;
}

export interface Excerpt {
  file: string;
  /** Markdown section heading, or null for whole-file and line-window excerpts. */
  heading: string | null;
  startLine: number;
  endLine: number;
  /** Source lines startLine..endLine joined with '\n' (no line numbers, no trailing newline). */
  text: string;
  /** Why it was selected, sorted and unique: `map:<glob>` and/or `symbol:<symbol name>`. */
  reasons: string[];
}

export interface ContextSelection {
  /** Selected excerpts sorted by file (plain string order) then startLine. */
  excerpts: Excerpt[];
  /** Excerpts that did not fit the budget, in priority order. */
  omitted: Excerpt[];
  /** Total text length of the selected excerpts. */
  chars: number;
}
