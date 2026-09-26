import { execa } from 'execa';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { HISTORY_DIR } from '../src/commands/check.js';
import {
  buildFixPrompt,
  FIX_CODE_MODE,
  FIX_MODE,
  FixError,
  latestReport,
  needsCodeChange,
  runFix,
} from '../src/commands/fix.js';
import type { Exec } from '../src/engine/bob.js';
import { FIXTURES_DIR, RUNS_DIR } from '../src/engine/index.js';
import type { DriftReport, Finding } from '../src/report/schema.js';

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'KRS-001',
  type: 'STALE_DOC',
  severity: 'high',
  title: 'SPEC still says 10%',
  code: { file: 'src/pricing.ts', lines: [3, 3], excerpt: 'return total * 0.85;' },
  intent: { file: 'docs/SPEC.md', lines: [5, 5], excerpt: 'Orders above $100 get 10% off.' },
  explanation: 'The code applies 15%, the SPEC says 10%.',
  truth: 'code',
  proposal: { action: 'update_doc', summary: 'Change 10% to 15% in docs/SPEC.md.' },
  confidence: 0.9,
  ...over,
});

const SPEC_OLD = '# Spec\n\n## Pricing\n\nOrders above $100 get 10% off.\n';
const SPEC_NEW = SPEC_OLD.replace('10%', '15%');
const NOW = () => new Date('2026-09-26T12:00:00.000Z');

async function git(cwd: string, ...args: string[]) {
  return (await execa('git', args, { cwd })).stdout;
}

/** A committed drift (15% in code, 10% in SPEC) plus a stored check run with `findings`. */
async function repo(findings: Finding[], config = 'engine: bob\nbase: base\n') {
  const cwd = await mkdtemp(join(tmpdir(), 'kairos-fix-'));
  await git(cwd, 'init', '-q', '-b', 'main');
  await git(cwd, 'config', 'user.email', 't@example.com');
  await git(cwd, 'config', 'user.name', 'Test');
  await mkdir(join(cwd, 'docs'));
  await mkdir(join(cwd, 'src'));
  await mkdir(join(cwd, '.kairos'));
  await writeFile(join(cwd, '.gitignore'), '.kairos/runs/\n.kairos/cache/\n');
  await writeFile(join(cwd, 'docs/SPEC.md'), SPEC_OLD);
  await writeFile(join(cwd, 'src/pricing.ts'), 'export const price = (t: number) => t * 0.9;\n');
  await writeFile(join(cwd, '.kairos/config.yaml'), config);
  await git(cwd, 'add', '.');
  await git(cwd, 'commit', '-q', '-m', 'base');
  await git(cwd, 'tag', 'base');
  await writeFile(join(cwd, 'src/pricing.ts'), 'export const price = (t: number) => t * 0.85;\n');
  await git(cwd, 'commit', '-qam', 'drift');
  await writeHistory(cwd, '20260926T100000Z-aaaaaaa', findings);
  return cwd;
}

async function writeHistory(cwd: string, runId: string, findings: Finding[]) {
  const report: DriftReport = {
    runId,
    base: 'base',
    head: 'aaaaaaa',
    createdAt: '2026-09-26T10:00:00.000Z',
    summary: 'Drift.',
    findings,
  };
  await mkdir(join(cwd, HISTORY_DIR), { recursive: true });
  await writeFile(join(cwd, HISTORY_DIR, `${runId}.json`), JSON.stringify(report));
}

const resultLine = (message: string, cost = 0.05) =>
  JSON.stringify({
    type: 'result',
    status: 'success',
    stats: { task_id: 't-fix', session_costs: cost },
    last_message: message,
  });

/**
 * Fake `bob`: the fix run (mode kairos-fix*) edits files via `edit`, the re-check run
 * (mode kairos) replies with `recheck`.
 */
function fakeBob(
  cwd: string,
  edit: () => Promise<void>,
  recheck: Finding[] = [],
): { exec: ReturnType<typeof vi.fn<Exec>>; opts: object } {
  const exec = vi.fn<Exec>(async (_bin, args) => {
    const mode = args[args.indexOf('--mode') + 1];
    if (mode === 'kairos') {
      const reply = JSON.stringify({ findings: recheck, summary: 'Re-check.' });
      return { stdout: resultLine(reply, 0.01), stderr: '', exitCode: 0 };
    }
    await edit();
    return { stdout: resultLine('Updated docs/SPEC.md to 15%.'), stderr: '', exitCode: 0 };
  });
  return { exec, opts: { bob: { exec, env: { BOB_API_KEY: 'test' } }, now: NOW } };
}

const updateSpec = (cwd: string) => () => writeFile(join(cwd, 'docs/SPEC.md'), SPEC_NEW);

describe('latestReport', () => {
  it('picks the newest run', async () => {
    const cwd = await repo([finding()]);
    await writeHistory(cwd, '20260926T110000Z-bbbbbbb', [finding({ id: 'KRS-009' })]);
    expect((await latestReport(cwd)).findings[0]!.id).toBe('KRS-009');
  });

  it('asks for a check first when there is no history', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kairos-fix-'));
    await expect(latestReport(cwd)).rejects.toThrow(/kairos check/);
  });
});

describe('needsCodeChange', () => {
  it('is true only when intent wins and the fix is not a test', () => {
    expect(needsCodeChange(finding({ type: 'SPEC_VIOLATION' }), 'intent')).toBe(true);
    expect(needsCodeChange(finding({ type: 'SPEC_VIOLATION' }), 'code')).toBe(false);
    expect(needsCodeChange(finding({ type: 'MISSING_TEST' }), 'intent')).toBe(false);
    expect(
      needsCodeChange(
        finding({ type: 'SPEC_VIOLATION', proposal: { action: 'add_test', summary: 'x' } }),
        'intent',
      ),
    ).toBe(false);
  });
});

describe('buildFixPrompt', () => {
  it('carries the finding, evidence, truth and the docs-only rule', () => {
    const p = buildFixPrompt(finding(), 'code', false);
    expect(p).toContain('KRS-001 · STALE_DOC · severity high');
    expect(p).toContain('`src/pricing.ts:3`');
    expect(p).toContain('Orders above $100 get 10% off.');
    expect(p).toContain('Source of truth: **code**');
    expect(p).toContain('Proposed fix (update_doc): Change 10% to 15%');
    expect(p).toContain('Do not edit source code');
    expect(p).toContain('Do not commit');
  });

  it('flags a user override of the truth and allows code with --allow-code', () => {
    const p = buildFixPrompt(finding(), 'intent', true);
    expect(p).toContain('The user decided otherwise');
    expect(p).toContain('You may edit source code');
    expect(buildFixPrompt(finding({ intent: null }), 'code', false)).toContain(
      'no intent source covers this yet',
    );
  });
});

describe('runFix', () => {
  it('runs kairos-fix, commits the diff and re-checks to resolved', async () => {
    const cwd = await repo([finding()]);
    const { exec, opts } = fakeBob(cwd, updateSpec(cwd));
    const res = await runFix(cwd, { id: 'krs-001', yes: true, ...opts });

    expect(res.status).toBe('resolved');
    expect(res.changedFiles).toEqual(['docs/SPEC.md']);
    expect(res.diff).toContain('+Orders above $100 get 15% off.');
    expect(res.summary).toBe('Updated docs/SPEC.md to 15%.');
    expect(res.costBobcoins).toBe(0.05);
    expect(res.taskId).toBe('t-fix');

    const fixArgs = exec.mock.calls[0]![1];
    expect(fixArgs[fixArgs.indexOf('--mode') + 1]).toBe(FIX_MODE);
    expect(exec.mock.calls[0]![2].input).toContain('Source of truth: **code**');

    expect(await git(cwd, 'log', '-1', '--format=%s')).toBe(
      'kairos fix KRS-001: SPEC still says 10%',
    );
    expect(await git(cwd, 'status', '--porcelain')).not.toMatch(/SPEC/);
    // the re-check saw the committed fix and wrote a new run
    expect(res.recheck!.report.findings).toEqual([]);
    expect(await readdir(join(cwd, HISTORY_DIR))).toHaveLength(2);
    expect((await readdir(join(cwd, RUNS_DIR))).some((n) => n.endsWith('-fix.json'))).toBe(true);
  });

  it('reports still-open when the re-check finds the same drift', async () => {
    const cwd = await repo([finding()]);
    const { opts } = fakeBob(cwd, updateSpec(cwd), [finding({ id: 'KRS-002' })]);
    const res = await runFix(cwd, { id: 'KRS-001', yes: true, ...opts });
    expect(res.status).toBe('still-open');
  });

  it('skips the re-check with check: false', async () => {
    const cwd = await repo([finding()]);
    const { exec, opts } = fakeBob(cwd, updateSpec(cwd));
    const res = await runFix(cwd, { id: 'KRS-001', yes: true, check: false, ...opts });
    expect(res.status).toBe('committed');
    expect(res.commit).toMatch(/^[0-9a-f]{7,}$/);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('includes new files (a new test) in the diff and the commit', async () => {
    const cwd = await repo([finding({ type: 'MISSING_TEST', truth: 'intent' })]);
    const addTest = async () => {
      await mkdir(join(cwd, 'test'));
      await writeFile(join(cwd, 'test/pricing.test.ts'), 'it("prices", () => {});\n');
    };
    const { opts } = fakeBob(cwd, addTest);
    const res = await runFix(cwd, { id: 'KRS-001', yes: true, check: false, ...opts });
    expect(res.changedFiles).toEqual(['test/pricing.test.ts']);
    expect(res.diff).toContain('+it("prices"');
    expect(await git(cwd, 'show', '--name-only', '--format=', 'HEAD')).toBe('test/pricing.test.ts');
  });

  it('reverts tracked and new files when the user says no', async () => {
    const cwd = await repo([finding()]);
    const edit = async () => {
      await updateSpec(cwd)();
      await writeFile(join(cwd, 'docs/NOTES.md'), 'new\n');
    };
    const { opts } = fakeBob(cwd, edit);
    const confirm = vi.fn(async () => false);
    const head = await git(cwd, 'rev-parse', 'HEAD');
    const res = await runFix(cwd, { id: 'KRS-001', confirm, ...opts });

    expect(res.status).toBe('rejected');
    expect(confirm).toHaveBeenCalledWith(res.diff);
    expect(res.diff).toContain('docs/NOTES.md');
    expect(await readFile(join(cwd, 'docs/SPEC.md'), 'utf8')).toBe(SPEC_OLD);
    expect(await readdir(join(cwd, 'docs'))).toEqual(['SPEC.md']);
    expect(await git(cwd, 'rev-parse', 'HEAD')).toBe(head);
    expect(await git(cwd, 'status', '--porcelain', '--untracked-files=no')).toBe('');
  });

  it('commits when the user confirms', async () => {
    const cwd = await repo([finding()]);
    const { opts } = fakeBob(cwd, updateSpec(cwd));
    const res = await runFix(cwd, { id: 'KRS-001', confirm: async () => true, ...opts });
    expect(res.status).toBe('resolved');
  });

  it('returns no-change when Bob edits nothing', async () => {
    const cwd = await repo([finding()]);
    const { opts } = fakeBob(cwd, async () => {});
    const res = await runFix(cwd, { id: 'KRS-001', yes: true, ...opts });
    expect(res.status).toBe('no-change');
    expect(res.diff).toBe('');
  });

  it('reverts and fails when source code was touched without --allow-code', async () => {
    const cwd = await repo([finding()]);
    const edit = async () => {
      await updateSpec(cwd)();
      await writeFile(join(cwd, 'src/pricing.ts'), 'export const price = (t: number) => t;\n');
    };
    const { opts } = fakeBob(cwd, edit);
    await expect(runFix(cwd, { id: 'KRS-001', yes: true, ...opts })).rejects.toThrow(
      /src\/pricing\.ts.*reverted/,
    );
    expect(await git(cwd, 'status', '--porcelain', '--untracked-files=no')).toBe('');
  });

  it('uses kairos-fix-code and lets code change with --allow-code', async () => {
    const cwd = await repo([finding({ type: 'SPEC_VIOLATION', truth: 'intent' })]);
    const revertCode = () =>
      writeFile(join(cwd, 'src/pricing.ts'), 'export const price = (t: number) => t * 0.9;\n');
    const { exec, opts } = fakeBob(cwd, revertCode);
    const res = await runFix(cwd, { id: 'KRS-001', yes: true, allowCode: true, ...opts });
    expect(res.status).toBe('resolved');
    expect(res.changedFiles).toEqual(['src/pricing.ts']);
    const args = exec.mock.calls[0]![1];
    expect(args[args.indexOf('--mode') + 1]).toBe(FIX_CODE_MODE);
  });

  it('logs the decision in DECISIONS.md within the fix commit, ignoring hook PROGRESS entries', async () => {
    const cwd = await repo([finding()]);
    await mkdir(join(cwd, 'docs/kairos'));
    await writeFile(join(cwd, 'docs/kairos/DECISIONS.md'), '# Decisions\n');
    await writeFile(join(cwd, 'docs/kairos/PROGRESS.md'), '# Progress\n');
    await git(cwd, 'add', '.');
    await git(cwd, 'commit', '-qm', 'living docs');
    // the post-commit hook leaves the log dirty
    await writeFile(join(cwd, 'docs/kairos/PROGRESS.md'), '# Progress\n\n## entry\n');

    const { opts } = fakeBob(cwd, updateSpec(cwd));
    const res = await runFix(cwd, { id: 'KRS-001', yes: true, check: false, ...opts });

    expect(res.status).toBe('committed');
    expect(res.changedFiles).toEqual(['docs/SPEC.md']);
    expect((await git(cwd, 'show', '--name-only', '--format=', 'HEAD')).split('\n')).toEqual([
      'docs/SPEC.md',
      'docs/kairos/DECISIONS.md',
    ]);
    const decisions = await readFile(join(cwd, 'docs/kairos/DECISIONS.md'), 'utf8');
    expect(decisions).toBe(
      [
        '# Decisions',
        '',
        '## 2026-09-26 · kairos fix KRS-001 (STALE_DOC)',
        '- Finding: SPEC still says 10% (`src/pricing.ts:3`)',
        '- Source of truth: code',
        '- Changed: `docs/SPEC.md`',
        '- Resolution: Updated docs/SPEC.md to 15%.',
        '',
      ].join('\n'),
    );
    expect(await git(cwd, 'status', '--porcelain', '--untracked-files=no')).toBe(
      ' M docs/kairos/PROGRESS.md',
    );
  });

  it('uses the session caps and reverts partial edits when Bob stops at a cap', async () => {
    const cwd = await repo([finding()]);
    const exec = vi.fn<Exec>(async () => {
      await writeFile(join(cwd, 'docs/SPEC.md'), SPEC_NEW);
      await writeFile(join(cwd, 'docs/new.md'), 'half\n');
      const error = JSON.stringify({
        type: 'error',
        message: 'The task reached the maximum of 40 turns.',
      });
      return { stdout: `${error}\n${resultLine('partial')}`, stderr: '', exitCode: 0 };
    });
    await expect(
      runFix(cwd, {
        id: 'KRS-001',
        yes: true,
        bob: { exec, env: { BOB_API_KEY: 'test' } },
        now: NOW,
      }),
    ).rejects.toThrow(/maximum of 40 turns.*docs\/SPEC\.md, docs\/new\.md\) were reverted/);
    const args = exec.mock.calls[0]![1];
    expect(args[args.indexOf('--max-turns') + 1]).toBe('40');
    expect(args[args.indexOf('--max-cost') + 1]).toBe('3');
    expect(await git(cwd, 'status', '--porcelain', '--untracked-files=all', 'docs')).toBe('');
  });

  describe('refuses before spending Bobcoins', () => {
    const cases: Array<[string, Finding, Parameters<typeof runFix>[1], RegExp]> = [
      ['unknown id', finding(), { id: 'KRS-404', yes: true }, /No finding KRS-404.*KRS-001/],
      ['truth ask', finding({ truth: 'ask' }), { id: 'KRS-001', yes: true }, /--truth intent/],
      [
        'code change without --allow-code',
        finding({ type: 'SPEC_VIOLATION', truth: 'intent' }),
        { id: 'KRS-001', yes: true },
        /--allow-code/,
      ],
      ['no --yes and no terminal', finding(), { id: 'KRS-001' }, /--yes/],
    ];
    it.each(cases)('%s', async (_name, f, o, message) => {
      const cwd = await repo([f]);
      const { exec, opts } = fakeBob(cwd, updateSpec(cwd));
      const err = await runFix(cwd, { ...o, ...opts }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(FixError);
      expect((err as Error).message).toMatch(message);
      expect(exec).not.toHaveBeenCalled();
    });

    it('a dirty working tree', async () => {
      const cwd = await repo([finding()]);
      await writeFile(join(cwd, 'docs/SPEC.md'), 'wip\n');
      const { exec, opts } = fakeBob(cwd, updateSpec(cwd));
      await expect(runFix(cwd, { id: 'KRS-001', yes: true, ...opts })).rejects.toThrow(
        /uncommitted/,
      );
      expect(exec).not.toHaveBeenCalled();
    });
  });

  it('--truth overrides the report', async () => {
    const cwd = await repo([finding({ truth: 'ask', type: 'UNDOCUMENTED_BEHAVIOR' })]);
    const { exec, opts } = fakeBob(cwd, updateSpec(cwd));
    const res = await runFix(cwd, { id: 'KRS-001', truth: 'code', yes: true, ...opts });
    expect(res.truth).toBe('code');
    expect(exec.mock.calls[0]![2].input).toContain('The user decided otherwise');
  });

  describe('mock engine', () => {
    it('applies .kairos/fixtures/fix-<ID>.patch', async () => {
      const cwd = await repo([finding()], 'engine: mock\nbase: base\n');
      await writeFile(join(cwd, 'docs/SPEC.md'), SPEC_NEW);
      const patch = await git(cwd, 'diff');
      await git(cwd, 'checkout', '--', 'docs/SPEC.md');
      await mkdir(join(cwd, FIXTURES_DIR), { recursive: true });
      await writeFile(join(cwd, FIXTURES_DIR, 'fix-KRS-001.patch'), `${patch}\n`);
      await git(cwd, 'add', '.');
      await git(cwd, 'commit', '-qm', 'fixtures');

      const res = await runFix(cwd, { id: 'KRS-001', yes: true, now: NOW });
      expect(res.status).toBe('resolved');
      expect(res.costBobcoins).toBe(0);
      expect(await readFile(join(cwd, 'docs/SPEC.md'), 'utf8')).toBe(SPEC_NEW);
    });

    it('prefers fix-<ID>-<TYPE>.patch (ids renumber between runs)', async () => {
      const cwd = await repo([finding()], 'engine: mock\nbase: base\n');
      await writeFile(join(cwd, 'docs/SPEC.md'), SPEC_NEW);
      const patch = await git(cwd, 'diff');
      await git(cwd, 'checkout', '--', 'docs/SPEC.md');
      await mkdir(join(cwd, FIXTURES_DIR), { recursive: true });
      await writeFile(join(cwd, FIXTURES_DIR, 'fix-KRS-001-STALE_DOC.patch'), `${patch}\n`);
      await writeFile(join(cwd, FIXTURES_DIR, 'fix-KRS-001.patch'), 'not a patch\n');
      await git(cwd, 'add', '.');
      await git(cwd, 'commit', '-qm', 'fixtures');

      const res = await runFix(cwd, { id: 'KRS-001', yes: true, check: false, now: NOW });
      expect(res.summary).toBe('MockEngine: applied fix-KRS-001-STALE_DOC.patch.');
      expect(res.status).toBe('committed');
    });

    it('changes nothing without a patch fixture', async () => {
      const cwd = await repo([finding()], 'engine: mock\nbase: base\n');
      const res = await runFix(cwd, { id: 'KRS-001', yes: true, now: NOW });
      expect(res.status).toBe('no-change');
    });
  });
});
