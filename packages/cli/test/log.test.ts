import { execa } from 'execa';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initProject } from '../src/commands/init.js';
import { formatDecision, logCommit, logDecision, readCommit } from '../src/docs/log.js';
import { DECISIONS_PATH, PROGRESS_PATH } from '../src/templates/living-docs.js';

async function git(cwd: string, ...args: string[]) {
  return (await execa('git', args, { cwd })).stdout;
}

async function repo(withDocs = true) {
  const cwd = await mkdtemp(join(tmpdir(), 'kairos-log-'));
  await git(cwd, 'init', '-q', '-b', 'main');
  await git(cwd, 'config', 'user.email', 't@example.com');
  await git(cwd, 'config', 'user.name', 'Test');
  if (withDocs) await initProject(cwd);
  await writeFile(join(cwd, 'app.ts'), 'export {};\n');
  await git(cwd, 'add', '.');
  await git(cwd, 'commit', '-qm', 'T1: scaffold');
  return cwd;
}

describe('logCommit', () => {
  it('appends hash, date, message and files of HEAD to PROGRESS.md', async () => {
    const cwd = await repo();
    await writeFile(join(cwd, 'app.ts'), 'export const a = 1;\n');
    await writeFile(join(cwd, 'b.ts'), 'export {};\n');
    await git(cwd, 'add', '.');
    await git(cwd, 'commit', '-qm', 'T2: add a');
    const c = await readCommit(cwd);
    expect(c.subject).toBe('T2: add a');
    expect(c.files).toEqual(['app.ts', 'b.ts']);

    expect(await logCommit(cwd)).toBe('logged');
    const text = await readFile(join(cwd, PROGRESS_PATH), 'utf8');
    expect(text.endsWith(`\n\n## ${c.date} · ${c.hash} · T2: add a\n- app.ts\n- b.ts\n`)).toBe(
      true,
    );
  });

  it('skips commits that only touch PROGRESS.md', async () => {
    const cwd = await repo();
    await logCommit(cwd);
    await git(cwd, 'commit', '-qam', 'progress');
    const before = await readFile(join(cwd, PROGRESS_PATH), 'utf8');
    expect(await logCommit(cwd)).toBe('skipped');
    expect(await readFile(join(cwd, PROGRESS_PATH), 'utf8')).toBe(before);
  });

  it('does nothing without living docs', async () => {
    const cwd = await repo(false);
    expect(await logCommit(cwd)).toBe('no-docs');
  });

  it('runs from the installed post-commit hook', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kairos-hook-'));
    await git(cwd, 'init', '-q', '-b', 'main');
    await git(cwd, 'config', 'user.email', 't@example.com');
    await git(cwd, 'config', 'user.name', 'Test');
    // a stand-in entry script: records that the hook called it with `progress`
    const bin = join(cwd, 'fake-kairos.mjs');
    await writeFile(
      bin,
      `import { appendFileSync } from 'node:fs';\nappendFileSync('hook.log', process.argv.slice(2).join(' ') + '\\n');\n`,
    );
    await initProject(cwd, { kairosBin: bin });
    await writeFile(join(cwd, '.gitignore'), 'hook.log\nfake-kairos.mjs\n');
    await git(cwd, 'add', '.');
    await git(cwd, 'commit', '-qm', 'init');
    expect(await readFile(join(cwd, 'hook.log'), 'utf8')).toBe('progress\n');
  });
});

describe('logDecision', () => {
  const d = {
    date: '2026-09-26',
    id: 'KRS-002',
    type: 'STALE_DOC',
    title: 'README says DB_URL',
    truth: 'code',
    location: 'src/config.ts:4',
    files: ['README.md', 'docs/SPEC.md'],
    summary: 'Renamed DB_URL\nto DATABASE_URL.',
  };

  it('formats one entry', () => {
    expect(formatDecision(d)).toBe(
      [
        '## 2026-09-26 · kairos fix KRS-002 (STALE_DOC)',
        '- Finding: README says DB_URL (`src/config.ts:4`)',
        '- Source of truth: code',
        '- Changed: `README.md`, `docs/SPEC.md`',
        '- Resolution: Renamed DB_URL to DATABASE_URL.',
        '',
      ].join('\n'),
    );
  });

  it('appends only when DECISIONS.md exists', async () => {
    const cwd = await repo();
    expect(await logDecision(cwd, d)).toBe(true);
    expect(await readFile(join(cwd, DECISIONS_PATH), 'utf8')).toContain(formatDecision(d));
    expect(await logDecision(await repo(false), d)).toBe(false);
  });
});
