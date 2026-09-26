import type { Section } from './types.js';

/**
 * Split a markdown file's text into sections delimited by ATX headings.
 *
 * Rules:
 * - ATX headings: `#` through `######` followed by exactly one space.
 * - Lines inside ``` or ~~~ fences are never treated as headings.
 * - Text before the first heading forms a level-0 preamble section with heading ''.
 *   Its startLine is its first non-blank line; if all blank, no preamble is emitted.
 * - Lines are 1-based. A trailing newline does not create an extra line.
 * - endLine: last non-blank line before the next heading of any level.
 * - blockEnd: last non-blank line before the next heading of the same or higher level
 *   (smaller or equal heading number), or end of file.
 */
export function splitMarkdown(file: string, text: string): Section[] {
  if (!text) return [];

  // Split into lines, removing a synthetic empty string from a trailing newline.
  const rawLines = text.split('\n');
  const lines =
    rawLines.length > 0 && rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines;

  if (lines.length === 0) return [];

  // Collect heading positions, skipping lines inside fenced code blocks.
  interface HeadingInfo {
    lineNo: number; // 1-based
    level: number;
    heading: string;
  }

  const headings: HeadingInfo[] = [];
  let inFence = false;
  let fenceChar = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (!inFence) {
      // Detect opening fence: ``` or ~~~
      const fenceMatch = line.match(/^(```|~~~)/);
      if (fenceMatch) {
        inFence = true;
        fenceChar = fenceMatch[1]!.slice(0, 3);
        continue;
      }

      // ATX heading: one to six `#` characters followed by a space
      const headingMatch = line.match(/^(#{1,6}) (.+)$/);
      if (headingMatch) {
        headings.push({
          lineNo: i + 1,
          level: headingMatch[1]!.length,
          heading: headingMatch[2]!.trim(),
        });
      }
    } else {
      // Detect closing fence: the same character sequence at the start of the line
      if (line.startsWith(fenceChar)) {
        inFence = false;
      }
    }
  }

  const totalLines = lines.length;

  /**
   * Returns the last non-blank line in the range [from, to] (1-based),
   * or `from - 1` if there are no non-blank lines (signals "no content").
   */
  function lastNonBlank(from: number, to: number): number {
    for (let n = to; n >= from; n--) {
      if (lines[n - 1]!.trim() !== '') return n;
    }
    return from - 1;
  }

  const sections: Section[] = [];

  // Handle preamble (text before the first heading).
  const firstHeadingLine = headings.length > 0 ? headings[0]!.lineNo : totalLines + 1;

  if (firstHeadingLine > 1) {
    // There is text before the first heading.
    // Find the first non-blank line in [1, firstHeadingLine - 1].
    let preambleStart = -1;
    for (let n = 1; n < firstHeadingLine; n++) {
      if (lines[n - 1]!.trim() !== '') {
        preambleStart = n;
        break;
      }
    }

    if (preambleStart !== -1) {
      const preambleEnd = lastNonBlank(preambleStart, firstHeadingLine - 1);
      sections.push({
        file,
        heading: '',
        level: 0,
        startLine: preambleStart,
        endLine: preambleEnd,
        blockEnd: preambleEnd,
      });
    }
  }

  // Build sections for each heading.
  for (let hi = 0; hi < headings.length; hi++) {
    const h = headings[hi]!;
    const nextHeadingLine = hi + 1 < headings.length ? headings[hi + 1]!.lineNo : totalLines + 1;

    // endLine: last non-blank line before the next heading of any level.
    const endLine = lastNonBlank(h.lineNo + 1, nextHeadingLine - 1);
    // Clamp: if the heading itself is the only non-blank line, endLine = startLine.
    const effectiveEndLine = endLine < h.lineNo ? h.lineNo : endLine;

    // blockEnd: last non-blank line before the next heading of the same or higher level
    // (i.e. level <= h.level), or end of file.
    let blockEndBoundary = totalLines + 1;
    for (let ji = hi + 1; ji < headings.length; ji++) {
      if (headings[ji]!.level <= h.level) {
        blockEndBoundary = headings[ji]!.lineNo;
        break;
      }
    }
    const blockEnd = lastNonBlank(h.lineNo + 1, blockEndBoundary - 1);
    const effectiveBlockEnd = blockEnd < h.lineNo ? h.lineNo : blockEnd;

    sections.push({
      file,
      heading: h.heading,
      level: h.level,
      startLine: h.lineNo,
      endLine: effectiveEndLine,
      blockEnd: effectiveBlockEnd,
    });
  }

  return sections;
}
