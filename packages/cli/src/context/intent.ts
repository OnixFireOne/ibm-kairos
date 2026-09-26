import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import type { IntentFile } from './types.js';

/**
 * Glob for intent and test files relative to `cwd`.
 *
 * - Ignores node_modules, .git, and .kairos directories.
 * - Returns the union of both pattern lists, deduplicated and sorted by path (plain string order).
 * - kind: 'test' if matched by a tests pattern, else 'markdown' for .md files, else 'other'.
 */
export async function loadIntentFiles(
  cwd: string,
  patterns: { intent: string[]; tests: string[] },
): Promise<IntentFile[]> {
  const IGNORE = ['**/node_modules/**', '**/.git/**', '**/.kairos/**'];

  // Collect all matching paths from both pattern groups.
  const allPatterns = [...patterns.intent, ...patterns.tests];

  const paths = await fg(allPatterns, {
    cwd,
    ignore: IGNORE,
    dot: true,
    unique: true,
  });

  // Determine which paths are matched by test patterns (build a Set for O(1) lookup).
  const testPaths = new Set(
    await fg(patterns.tests, { cwd, ignore: IGNORE, dot: true, unique: true }),
  );

  // Sort by plain string order.
  paths.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // Read each file and assign its kind.
  const files: IntentFile[] = await Promise.all(
    paths.map(async (path) => {
      const text = await readFile(join(cwd, path), 'utf8');
      const kind: IntentFile['kind'] = testPaths.has(path)
        ? 'test'
        : path.endsWith('.md')
          ? 'markdown'
          : 'other';
      return { path, kind, text };
    }),
  );

  return files;
}
