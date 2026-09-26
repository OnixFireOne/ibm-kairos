import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, parseConfig } from '../src/config/load.js';

const tmp = () => mkdtemp(join(tmpdir(), 'kairos-config-'));

describe('parseConfig', () => {
  it('fills SPEC §7 defaults for an empty file', () => {
    const c = parseConfig('');
    expect(c.base).toBe('origin/main');
    expect(c.intent).toContain('README.md');
    expect(c.failOn).toBe('medium');
    expect(c.engine).toBe('bob');
    expect(c.budget).toEqual({ maxCost: 2, maxTurns: 8, maxContextChars: 60_000 });
  });

  it('keeps user values and defaults the rest, including nested budget', () => {
    const c = parseConfig(
      'base: HEAD~1\nengine: mock\nbudget: { maxCost: 1 }\nmap: { "src/**": ["docs/SPEC.md#Pricing"] }',
    );
    expect(c.base).toBe('HEAD~1');
    expect(c.engine).toBe('mock');
    expect(c.budget).toEqual({ maxCost: 1, maxTurns: 8, maxContextChars: 60_000 });
    expect(c.map).toEqual({ 'src/**': ['docs/SPEC.md#Pricing'] });
  });

  it('reports every invalid field with its path', () => {
    expect(() => parseConfig('failOn: critical\nbudget: { maxTurns: -1 }')).toThrowError(
      /failOn[\s\S]*budget\.maxTurns/,
    );
  });

  it('rejects malformed YAML with a ConfigError', () => {
    expect(() => parseConfig('base: [unclosed')).toThrow(ConfigError);
  });
});

describe('loadConfig', () => {
  it('returns defaults when .kairos/config.yaml is missing', async () => {
    expect((await loadConfig(await tmp())).failOn).toBe('medium');
  });

  it('reads .kairos/config.yaml from the given directory', async () => {
    const dir = await tmp();
    await mkdir(join(dir, '.kairos'));
    await writeFile(join(dir, '.kairos/config.yaml'), 'failOn: high\n');
    expect((await loadConfig(dir)).failOn).toBe('high');
  });
});
