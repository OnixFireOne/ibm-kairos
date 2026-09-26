import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import { DECISIONS_PATH, PROGRESS_PATH } from '../templates/living-docs.js';

const exists = async (path: string) =>
  readFile(path).then(
    () => true,
    () => false,
  );

/** Appends `entry` to a living doc; only if the doc exists (the project ran `kairos init`). */
async function append(cwd: string, rel: string, entry: string): Promise<boolean> {
  const path = join(cwd, rel);
  if (!(await exists(path))) return false;
  const text = await readFile(path, 'utf8');
  await appendFile(path, `${text.endsWith('\n') ? '' : '\n'}\n${entry}`);
  return true;
}

export interface CommitEntry {
  hash: string;
  date: string;
  subject: string;
  files: string[];
}

export async function readCommit(cwd: string, rev = 'HEAD'): Promise<CommitEntry> {
  const { stdout } = await execa(
    'git',
    ['show', '--no-color', '--name-only', '--format=%h%n%cs%n%s', rev],
    { cwd },
  );
  const [hash = '', date = '', subject = '', ...files] = stdout.split('\n');
  return { hash, date, subject, files: files.filter(Boolean) };
}

export const formatCommit = (c: CommitEntry): string =>
  `## ${c.date} · ${c.hash} · ${c.subject}\n${c.files.map((f) => `- ${f}`).join('\n')}\n`;

export type ProgressResult = 'logged' | 'no-docs' | 'skipped';

/**
 * Logs one commit in PROGRESS.md (used by the post-commit hook). Commits that touch only
 * PROGRESS.md are skipped, so committing the log itself does not log again.
 */
export async function logCommit(cwd: string, rev = 'HEAD'): Promise<ProgressResult> {
  const c = await readCommit(cwd, rev);
  if (c.files.every((f) => f === PROGRESS_PATH)) return 'skipped';
  return (await append(cwd, PROGRESS_PATH, formatCommit(c))) ? 'logged' : 'no-docs';
}

export interface DecisionEntry {
  date: string;
  id: string;
  type: string;
  title: string;
  truth: string;
  location: string;
  files: string[];
  summary: string;
}

export const formatDecision = (d: DecisionEntry): string =>
  [
    `## ${d.date} · kairos fix ${d.id} (${d.type})`,
    `- Finding: ${d.title} (\`${d.location}\`)`,
    `- Source of truth: ${d.truth}`,
    `- Changed: ${d.files.map((f) => `\`${f}\``).join(', ')}`,
    `- Resolution: ${d.summary.replace(/\s+/g, ' ').trim()}`,
    '',
  ].join('\n');

/** Appends a drift resolution to DECISIONS.md; false when the project has no living docs. */
export const logDecision = (cwd: string, d: DecisionEntry): Promise<boolean> =>
  append(cwd, DECISIONS_PATH, formatDecision(d));
