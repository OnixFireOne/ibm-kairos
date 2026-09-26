/**
 * Minimal glob matcher for posix paths.
 *
 * Supported syntax:
 *   `**\/`   zero or more directory segments (including none)
 *   trailing `**`  matches anything to end of path
 *   `*`      matches anything within a single path segment (no `/`)
 *   `?`      matches exactly one non-`/` character
 *   everything else  literal
 */
export function matchesGlob(path: string, glob: string): boolean {
  return match(path, glob);
}

/** Convert a glob to a RegExp and test it against path. */
function match(path: string, glob: string): boolean {
  const re = globToRegex(glob);
  return re.test(path);
}

function globToRegex(glob: string): RegExp {
  let pattern = '^';
  let i = 0;

  while (i < glob.length) {
    const ch = glob[i]!;

    if (ch === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        // `**/` — zero or more directory segments
        pattern += '(?:.+/)?';
        i += 3;
      } else {
        // trailing `**` — match anything to end
        pattern += '.*';
        i += 2;
      }
    } else if (ch === '*') {
      // `*` within one segment (no slash)
      pattern += '[^/]*';
      i += 1;
    } else if (ch === '?') {
      // `?` — one non-slash character
      pattern += '[^/]';
      i += 1;
    } else {
      // literal character — escape regex metacharacters
      pattern += escapeRegex(ch);
      i += 1;
    }
  }

  pattern += '$';
  return new RegExp(pattern);
}

/** Escape a single character that may be a regex metacharacter. */
function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
