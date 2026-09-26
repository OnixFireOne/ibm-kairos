import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import type { FileDiff } from '../collector/types.js';
import { KAIROS_DOCS_DIR, PROGRESS_PATH } from '../templates/living-docs.js';

export const PLAN_PATH = `${KAIROS_DOCS_DIR}/PLAN.md`;

const readOrUndefined = (path: string) => readFile(path, 'utf8').catch(() => undefined);

/** Source files, not docs or contracts: what should leave a trace in PROGRESS.md. */
const isCode = (path: string) =>
  !path.startsWith('docs/') && !/\.(md|ya?ml|json|lock)$/.test(path) && !path.startsWith('.');

/**
 * Deterministic docs-freshness pre-checks (SPEC §6.2.1), run before Bob in `kairos check`:
 * - code changed but PROGRESS.md has no entry for any commit since the base;
 * - a commit names a PLAN task (`T12: ...`) that PLAN.md still lists as `[ ]`.
 * Bob confirms each candidate as a STALE_DOC finding or dismisses it. Projects without
 * docs/kairos get none, so their prompt is unchanged.
 */
export async function freshnessCandidates(
  cwd: string,
  diff: { base: string; files: Pick<FileDiff, 'path'>[] },
): Promise<string[]> {
  const [progress, plan] = await Promise.all([
    readOrUndefined(join(cwd, PROGRESS_PATH)),
    readOrUndefined(join(cwd, PLAN_PATH)),
  ]);
  if (progress === undefined && plan === undefined) return [];

  const { stdout } = await execa('git', ['log', '--format=%h %s', `${diff.base}..HEAD`], { cwd });
  const commits = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      hash: line.slice(0, line.indexOf(' ')),
      subject: line.slice(line.indexOf(' ') + 1),
    }));
  const out: string[] = [];

  const code = diff.files.map((f) => f.path).filter(isCode);
  const progressTouched = diff.files.some((f) => f.path === PROGRESS_PATH);
  const logged = commits.some((c) => progress?.includes(c.hash));
  if (progress !== undefined && code.length && !progressTouched && !logged) {
    out.push(
      `Code changed (${code.slice(0, 5).join(', ')}${code.length > 5 ? ', …' : ''}) but ${PROGRESS_PATH} ` +
        `has no entry for the commits since ${diff.base}.`,
    );
  }

  if (plan !== undefined) {
    const planLines = plan.split('\n');
    const seen = new Set<string>();
    for (const c of commits) {
      for (const [, n] of c.subject.matchAll(/\bT(\d+)\b/g)) {
        const task = `T${Number(n)}`;
        if (seen.has(task)) continue;
        seen.add(task);
        const re = new RegExp(`^\\s*[-*] \\[ \\] \\**T0*${Number(n)}\\b`);
        const line = planLines.findIndex((l) => re.test(l));
        if (line !== -1) {
          out.push(
            `Commit ${c.hash} "${c.subject}" works on ${task}, but ${PLAN_PATH}:${line + 1} still lists it as [ ] todo.`,
          );
        }
      }
    }
  }
  return out;
}
