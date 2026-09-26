import { execa } from 'execa';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { initProject } from '../src/commands/init.js';
import { readSession, runSession, SESSION_PATH } from '../src/commands/session.js';
import { loadConfig } from '../src/config/load.js';
import { buildPrompt } from '../src/context/prompt.js';
import { freshnessCandidates, PLAN_PATH } from '../src/docs/freshness.js';
import {
  buildHandoffPrompt,
  collectHandoffInput,
  draftHandoff,
  extractHandoff,
  firstMessage,
  HANDOFF_PATH,
  parsePlan,
  runHandoff,
  taskTitle,
} from '../src/docs/handoff.js';
import type { Exec } from '../src/engine/bob.js';
import { BOB_MODES_TEMPLATE } from '../src/templates/bob-modes.js';
import { PROGRESS_PATH } from '../src/templates/living-docs.js';

const NOW = () => new Date('2026-09-26T12:00:00.000Z');
const PLAN = `# Plan

- [x] **T1 Scaffold.** [→ task file](tasks/T01.md) pnpm workspace.
- [~] **T2 Collector.** getDiff.
- [ ] **T3 Context builder.** Globs.
- [ ] **T4 Schema.** zod.
`;

async function git(cwd: string, ...args: string[]) {
  return (await execa('git', args, { cwd })).stdout;
}

/** Repo after `kairos init` (no hook) with PLAN above, committed and tagged `base`. */
async function repo() {
  const cwd = await mkdtemp(join(tmpdir(), 'kairos-living-'));
  await git(cwd, 'init', '-q', '-b', 'main');
  await git(cwd, 'config', 'user.email', 't@example.com');
  await git(cwd, 'config', 'user.name', 'Test');
  await initProject(cwd);
  await execa('rm', ['-f', '.git/hooks/post-commit'], { cwd });
  await writeFile(join(cwd, PLAN_PATH), PLAN);
  await writeFile(join(cwd, '.kairos/config.yaml'), 'engine: bob\nbase: base\n');
  await git(cwd, 'add', '.');
  await git(cwd, 'commit', '-qm', 'init');
  await git(cwd, 'tag', 'base');
  return cwd;
}

async function commitCode(cwd: string, subject: string, file = 'src.ts') {
  await writeFile(join(cwd, file), `// ${subject}\n`);
  await git(cwd, 'add', '.');
  await git(cwd, 'commit', '-qm', subject);
  return (await git(cwd, 'rev-parse', '--short', 'HEAD')).trim();
}

const files = (...paths: string[]) => paths.map((path) => ({ path }));

describe('kairos-dev mode rules', () => {
  const dev = parse(BOB_MODES_TEMPLATE).customModes.find(
    (m: { slug: string }) => m.slug === 'kairos-dev',
  ).customInstructions as string;

  it('lets Bob run init on request and check after a task', () => {
    expect(dev).toContain('if asked, run `kairos init`');
    expect(dev).toMatch(/After each completed task, and before a handoff, run `kairos check` once/);
  });

  it('has Bob resolve findings itself, log DECISIONS.md, re-check, and not call kairos fix', () => {
    expect(dev).toContain('docs/kairos/DECISIONS.md');
    expect(dev).toContain('Do not call `kairos fix` from chat.');
  });
});

describe('freshnessCandidates', () => {
  it('flags code changes with no PROGRESS entry and PLAN tasks still todo', async () => {
    const cwd = await repo();
    const hash = await commitCode(cwd, 'T3: context builder');
    const c = await freshnessCandidates(cwd, { base: 'base', files: files('src.ts') });
    expect(c).toEqual([
      `Code changed (src.ts) but ${PROGRESS_PATH} has no entry for the commits since base.`,
      `Commit ${hash} "T3: context builder" works on T3, but ${PLAN_PATH}:5 still lists it as [ ] todo.`,
    ]);
  });

  it('is quiet when the hook logged the commit and PLAN is current', async () => {
    const cwd = await repo();
    await writeFile(join(cwd, PLAN_PATH), PLAN.replace('[ ] **T3', '[x] **T3'));
    const hash = await commitCode(cwd, 'T3: context builder');
    await writeFile(join(cwd, PROGRESS_PATH), `# Progress\n\n## 2026-09-26 · ${hash} · T3\n`);
    expect(await freshnessCandidates(cwd, { base: 'base', files: files('src.ts') })).toEqual([]);
  });

  it('ignores doc-only changes and T-numbers not in PLAN or done', async () => {
    const cwd = await repo();
    await commitCode(cwd, 'T2 and T9: notes', 'docs/notes.md');
    expect(await freshnessCandidates(cwd, { base: 'base', files: files('docs/notes.md') })).toEqual(
      [],
    );
  });

  it('returns nothing without living docs (the prompt stays as before)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kairos-nodocs-'));
    expect(await freshnessCandidates(cwd, { base: 'base', files: files('src.ts') })).toEqual([]);
  });
});

describe('buildPrompt with candidates', () => {
  const input = {
    diff: { base: 'base', head: 'h', raw: 'diff', files: [], symbols: [] },
    selection: { excerpts: [], omitted: [], chars: 0 },
    outputSchema: '{}',
  };

  it('adds a freshness section only when there are candidates', () => {
    expect(buildPrompt(input)).not.toContain('Docs freshness');
    expect(buildPrompt({ ...input, candidates: [] })).toBe(buildPrompt(input));
    const p = buildPrompt({ ...input, candidates: ['PLAN is stale.'] });
    expect(p).toContain('## Docs freshness candidates');
    expect(p).toContain('- PLAN is stale.');
    expect(p.indexOf('Docs freshness')).toBeLessThan(p.indexOf('## Output'));
  });
});

describe('handoff helpers', () => {
  it('parses PLAN statuses and titles', () => {
    expect(taskTitle('**T1 Scaffold.** [→ task file](x.md) more')).toBe('T1 Scaffold');
    expect(parsePlan(PLAN)).toEqual({
      done: ['T1 Scaffold'],
      inProgress: ['T2 Collector'],
      todo: ['T3 Context builder', 'T4 Schema'],
    });
  });

  it('names the next task in the first message of the new chat', () => {
    expect(firstMessage(parsePlan(PLAN))).toBe('Continue T2: Collector');
    expect(firstMessage(parsePlan(PLAN.replace('[~]', '[x]')))).toBe(
      'Continue T3: Context builder',
    );
    expect(firstMessage({ done: ['T1'], inProgress: [], todo: [] })).toBe('Continue');
  });

  it('extracts the handoff from a fenced reply and rejects anything else', () => {
    const md = '# Handoff\n\n## State\nok\n\n## Next step\n1. T3';
    expect(extractHandoff(`Here it is:\n\`\`\`markdown\n${md}\n\`\`\`\nDone.`)).toBe(`${md}\n`);
    expect(() => extractHandoff('I updated the file.')).toThrow(/did not return a HANDOFF/);
  });
});

describe('collectHandoffInput + draftHandoff', () => {
  it('uses commits since the last HANDOFF change, PLAN, dirty files and keeps gotchas', async () => {
    const cwd = await repo();
    await writeFile(
      join(cwd, HANDOFF_PATH),
      '# Handoff\n\n## Gotchas\n- Never run real bob in tests.\n\n## Read first\nx\n',
    );
    await git(cwd, 'commit', '-qam', 'handoff');
    const hash = await commitCode(cwd, 'T2: collector');
    await writeFile(join(cwd, 'wip.ts'), '');

    const input = await collectHandoffInput(cwd, {
      now: NOW,
      report: { runId: 'r1', summary: 'Clean.', findings: [] },
    });
    expect(input.commits).toEqual([`${hash} T2: collector`]);
    expect(input.dirty).toEqual(['?? wip.ts']);

    const md = draftHandoff(input);
    expect(md).toContain('Updated: 2026-09-26');
    expect(md).toContain('- Done: T1 Scaffold.');
    expect(md).toContain('## In progress\n- T2 Collector');
    expect(md).toContain('## Next step\n1. T2 Collector');
    expect(md).toContain('## Gotchas\n- Never run real bob in tests.\n');
    expect(md).toContain('- r1: 0 finding(s). Clean.');
    expect(md.length).toBeLessThan(3000);
    for (const h of ['State', 'In progress', 'Next step', 'Gotchas', 'Read first', 'Last check']) {
      expect(md).toContain(`## ${h}`);
    }

    const prompt = buildHandoffPrompt(input);
    expect(prompt).toContain('Do not modify any files');
    expect(prompt).toContain(`- ${hash} T2: collector`);
    expect(prompt).toContain('Never run real bob in tests.');
  });

  it('asks for kairos init when there are no living docs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kairos-nodocs-'));
    await git(cwd, 'init', '-q');
    await expect(collectHandoffInput(cwd)).rejects.toThrow(/kairos init/);
  });
});

const resultLine = (message: string, cost: number, toolCalls: number) =>
  JSON.stringify({
    type: 'result',
    status: 'success',
    stats: { task_id: 't-dev', session_costs: cost, tool_calls: toolCalls },
    last_message: message,
  });

/** Fake bob: kairos-dev runs; a handoff prompt gets a handoff reply. */
function fakeBob(cost = 1, toolCalls = 15) {
  const exec = vi.fn<Exec>(async (_bin, _args, { input }) => {
    const reply = input.startsWith('# Kairos handoff')
      ? '# Handoff\n\n## State\nBob wrote this.\n\n## Next step\n1. T3\n'
      : 'Implemented T2.';
    return { stdout: resultLine(reply, cost, toolCalls), stderr: '', exitCode: 0 };
  });
  return { exec, bob: { exec, env: { BOB_API_KEY: 'test' } } };
}

describe('runHandoff', () => {
  it('writes the deterministic draft with the mock engine', async () => {
    const cwd = await repo();
    const res = await runHandoff(cwd, await loadConfig(cwd), { engine: 'mock', now: NOW });
    expect(res.firstMessage).toBe('Continue T2: Collector');
    expect(await readFile(join(cwd, HANDOFF_PATH), 'utf8')).toBe(res.text);
    expect(res.text).toContain('## Next step\n1. T2 Collector');
  });

  it('lets Bob draft it in kairos-dev mode', async () => {
    const cwd = await repo();
    const { exec, bob } = fakeBob(0.2, 3);
    const res = await runHandoff(cwd, await loadConfig(cwd), { bob, now: NOW });
    const args = exec.mock.calls[0]![1];
    expect(args[args.indexOf('--mode') + 1]).toBe('kairos-dev');
    expect(res.text).toBe('# Handoff\n\n## State\nBob wrote this.\n\n## Next step\n1. T3\n');
    expect(res.costBobcoins).toBe(0.2);
  });
});

describe('runSession', () => {
  it('runs kairos-dev with the session caps and sums the budget', async () => {
    const cwd = await repo();
    const { exec, bob } = fakeBob(1, 15);
    const first = await runSession(cwd, 'continue', { bob, now: NOW });
    expect(first.reply).toBe('Implemented T2.');
    expect(first.overBudget).toBe(false);
    const args = exec.mock.calls[0]![1];
    expect(args[args.indexOf('--mode') + 1]).toBe('kairos-dev');
    expect(args[args.indexOf('--max-cost') + 1]).toBe('3');
    expect(args[args.indexOf('--max-turns') + 1]).toBe('40');
    expect(exec.mock.calls[0]![2].input).toBe('continue');

    await runSession(cwd, 'next', { bob, now: NOW });
    const state = await readSession(cwd);
    expect(state).toMatchObject({ toolCalls: 30, bobcoins: 2 });
    expect(state!.runs.map((r) => r.task)).toEqual(['continue', 'next']);
    expect(state!.runs[0]).toMatchObject({ taskId: 't-dev', toolCalls: 15, bobcoins: 1 });
  });

  it('over budget: writes HANDOFF.md, names the next task and starts over', async () => {
    const cwd = await repo();
    const { exec, bob } = fakeBob(1, 15);
    await runSession(cwd, 'a', { bob, now: NOW });
    await runSession(cwd, 'b', { bob, now: NOW });
    const third = await runSession(cwd, 'c', { bob, now: NOW }); // 45 tool calls >= 40
    expect(third.overBudget).toBe(true);
    expect(third.handoff!.firstMessage).toBe('Continue T2: Collector');
    expect(exec).toHaveBeenCalledTimes(4); // 3 dev runs + the handoff
    expect(await readFile(join(cwd, HANDOFF_PATH), 'utf8')).toContain('Bob wrote this.');
    expect(await readSession(cwd)).toBeUndefined();
  });

  it('--new resets the totals; the mock engine costs nothing', async () => {
    const cwd = await repo();
    const { bob } = fakeBob(1, 15);
    await runSession(cwd, 'a', { bob, now: NOW });
    const res = await runSession(cwd, 'b', { engine: 'mock', fresh: true, now: NOW });
    expect(res.reply).toBe('MockEngine: no fixture for this task.');
    expect(res.state).toMatchObject({ toolCalls: 0, bobcoins: 0 });
    expect(res.state.runs).toHaveLength(1);
    expect(JSON.parse(await readFile(join(cwd, SESSION_PATH), 'utf8')).runs).toHaveLength(1);
  });
});
