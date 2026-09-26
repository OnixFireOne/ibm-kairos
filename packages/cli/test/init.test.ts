import { execa } from 'execa';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { BOB_MODES_PATH, initProject, POST_COMMIT_PATH } from '../src/commands/init.js';
import { CONFIG_PATH, loadConfig } from '../src/config/load.js';
import { KairosConfig } from '../src/config/schema.js';
import { BOB_MODES_TEMPLATE } from '../src/templates/bob-modes.js';
import {
  LIVING_DOCS,
  POINTER_BLOCK,
  POINTER_END,
  POINTER_START,
  upsertPointer,
} from '../src/templates/living-docs.js';

const tmp = () => mkdtemp(join(tmpdir(), 'kairos-init-'));

describe('initProject', () => {
  it('creates the config, Bob modes, living docs and agent pointers in a bare directory', async () => {
    const dir = await tmp();
    const res = await initProject(dir);
    expect(res.created).toEqual([
      CONFIG_PATH,
      BOB_MODES_PATH,
      'docs/kairos/SPEC.md',
      'docs/kairos/PLAN.md',
      'docs/kairos/PROGRESS.md',
      'docs/kairos/DECISIONS.md',
      'docs/kairos/HANDOFF.md',
      'docs/kairos/tasks/README.md',
      'CLAUDE.md',
      'AGENTS.md',
    ]);
    expect(await readFile(join(dir, 'AGENTS.md'), 'utf8')).toBe(`${POINTER_BLOCK}\n`);
    expect(await readFile(join(dir, BOB_MODES_PATH), 'utf8')).toBe(BOB_MODES_TEMPLATE);
  });

  it('writes a config that loads to exactly the defaults', async () => {
    const dir = await tmp();
    await initProject(dir);
    expect(await loadConfig(dir)).toEqual(KairosConfig.parse({}));
  });

  it('never overwrites existing files unless forced', async () => {
    const dir = await tmp();
    await initProject(dir);
    await writeFile(join(dir, CONFIG_PATH), 'failOn: high\n');
    const again = await initProject(dir);
    expect(again.skipped).toEqual([CONFIG_PATH, BOB_MODES_PATH, ...LIVING_DOCS.map(([p]) => p)]);
    expect(again.created).toEqual([]);
    expect(again.updated).toEqual([]);
    expect((await loadConfig(dir)).failOn).toBe('high');
    expect((await initProject(dir, { force: true })).created).toHaveLength(2 + LIVING_DOCS.length);
    expect((await loadConfig(dir)).failOn).toBe('medium');
  });
});

describe('agent pointers', () => {
  it('appends the block to an existing CLAUDE.md and replaces it on the next run', async () => {
    const dir = await tmp();
    await writeFile(join(dir, 'CLAUDE.md'), '# My rules\n\nBe nice.\n');
    const res = await initProject(dir);
    expect(res.updated).toEqual(['CLAUDE.md']);
    expect(await readFile(join(dir, 'CLAUDE.md'), 'utf8')).toBe(
      `# My rules\n\nBe nice.\n\n${POINTER_BLOCK}\n`,
    );
    await writeFile(
      join(dir, 'CLAUDE.md'),
      `# My rules\n\n${POINTER_START}\nold pointer\n${POINTER_END}\n\nMore.\n`,
    );
    expect((await initProject(dir)).updated).toEqual(['CLAUDE.md']);
    expect(await readFile(join(dir, 'CLAUDE.md'), 'utf8')).toBe(
      `# My rules\n\n${POINTER_BLOCK}\n\nMore.\n`,
    );
  });

  it('is a no-op when the block is current', () => {
    const text = `# Rules\n\n${POINTER_BLOCK}\n`;
    expect(upsertPointer(text)).toBe(text);
    expect(upsertPointer(undefined)).toBe(`${POINTER_BLOCK}\n`);
  });

  it('points agents at the living docs', () => {
    expect(POINTER_BLOCK).toContain('docs/kairos/HANDOFF.md');
    expect(POINTER_BLOCK).toContain('docs/kairos/tasks/');
  });
});

describe('post-commit hook', () => {
  const gitRepo = async () => {
    const dir = await tmp();
    await execa('git', ['init', '-q'], { cwd: dir });
    return dir;
  };

  it('is installed (executable) only in a git repo', async () => {
    const plain = await tmp();
    expect((await initProject(plain)).created).not.toContain(POST_COMMIT_PATH);

    const dir = await gitRepo();
    const res = await initProject(dir, { kairosBin: '/opt/kairos/dist/index.js' });
    expect(res.created).toContain(POST_COMMIT_PATH);
    const hook = await readFile(join(dir, POST_COMMIT_PATH), 'utf8');
    expect(hook).toMatch(/^#!\/bin\/sh\n# kairos:post-commit/);
    expect(hook).toContain('node "/opt/kairos/dist/index.js" progress || kairos progress');
    expect((await stat(join(dir, POST_COMMIT_PATH))).mode & 0o111).toBeTruthy();
    expect((await initProject(dir, { kairosBin: '/opt/kairos/dist/index.js' })).updated).toEqual(
      [],
    );
  });

  it('never replaces a hook it did not write', async () => {
    const dir = await gitRepo();
    await mkdir(join(dir, '.git/hooks'), { recursive: true });
    await writeFile(join(dir, POST_COMMIT_PATH), '#!/bin/sh\necho mine\n');
    expect((await initProject(dir)).skipped).toContain(POST_COMMIT_PATH);
    expect(await readFile(join(dir, POST_COMMIT_PATH), 'utf8')).toBe('#!/bin/sh\necho mine\n');
  });
});

describe('Bob modes template', () => {
  it('matches the repo .bob/custom_modes.yaml verified by Bob', async () => {
    const repoFile = await readFile(join(__dirname, '../../..', BOB_MODES_PATH), 'utf8');
    expect(BOB_MODES_TEMPLATE).toBe(repoFile);
  });

  it('defines kairos, kairos-dev, kairos-fix and kairos-fix-code', () => {
    const slugs = parse(BOB_MODES_TEMPLATE).customModes.map((m: { slug: string }) => m.slug);
    expect(slugs).toEqual(['kairos', 'kairos-dev', 'kairos-fix', 'kairos-fix-code']);
  });
});
