import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { BOB_MODES_PATH, initProject } from '../src/commands/init.js';
import { CONFIG_PATH, loadConfig } from '../src/config/load.js';
import { KairosConfig } from '../src/config/schema.js';
import { BOB_MODES_TEMPLATE } from '../src/templates/bob-modes.js';

const tmp = () => mkdtemp(join(tmpdir(), 'kairos-init-'));

describe('initProject', () => {
  it('creates the config and Bob modes in a bare directory', async () => {
    const dir = await tmp();
    const res = await initProject(dir);
    expect(res.created).toEqual([CONFIG_PATH, BOB_MODES_PATH]);
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
    expect((await initProject(dir)).skipped).toEqual([CONFIG_PATH, BOB_MODES_PATH]);
    expect((await loadConfig(dir)).failOn).toBe('high');
    expect((await initProject(dir, { force: true })).created).toHaveLength(2);
    expect((await loadConfig(dir)).failOn).toBe('medium');
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
