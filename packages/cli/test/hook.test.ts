import { execa } from 'execa';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HookError,
  installPrePush,
  PRE_PUSH_MARKER,
  prePushHook,
  uninstallPrePush,
} from '../src/commands/hook.js';

const HOOK = '.git/hooks/pre-push';

async function gitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kairos-hook-'));
  await execa('git', ['init', '-q'], { cwd: dir });
  return dir;
}

describe('prePushHook', () => {
  it('runs check with the baked-in engine and falls back to kairos on PATH', () => {
    const hook = prePushHook({ kairosBin: '/opt/kairos/dist/index.js', engine: 'mock' });
    expect(hook).toMatch(/^#!\/bin\/sh\n# kairos:pre-push/);
    expect(hook).toContain(
      'if [ -f "/opt/kairos/dist/index.js" ]; then set -- node "/opt/kairos/dist/index.js"; else set -- kairos; fi',
    );
    expect(hook).toContain('"$@" check --engine mock\n');
    expect(prePushHook()).toContain('set -- kairos\n"$@" check\n');
  });
});

describe('installPrePush / uninstallPrePush', () => {
  it('installs an executable hook, then is idempotent and updatable', async () => {
    const dir = await gitRepo();
    expect(await installPrePush(dir)).toBe('created');
    expect((await stat(join(dir, HOOK))).mode & 0o111).not.toBe(0);
    expect(await installPrePush(dir)).toBe('unchanged');
    expect(await installPrePush(dir, { engine: 'mock' })).toBe('updated');
    expect(await readFile(join(dir, HOOK), 'utf8')).toContain('check --engine mock');
  });

  it('leaves a foreign hook alone unless forced, and never removes it', async () => {
    const dir = await gitRepo();
    await writeFile(join(dir, HOOK), '#!/bin/sh\necho mine\n');
    expect(await installPrePush(dir)).toBe('foreign');
    expect(await uninstallPrePush(dir)).toBe('foreign');
    expect(await readFile(join(dir, HOOK), 'utf8')).toBe('#!/bin/sh\necho mine\n');
    expect(await installPrePush(dir, { force: true })).toBe('updated');
    expect(await readFile(join(dir, HOOK), 'utf8')).toContain(PRE_PUSH_MARKER);
  });

  it('uninstalls its own hook', async () => {
    const dir = await gitRepo();
    expect(await uninstallPrePush(dir)).toBe('absent');
    await installPrePush(dir);
    expect(await uninstallPrePush(dir)).toBe('removed');
    await expect(stat(join(dir, HOOK))).rejects.toThrow();
  });

  it('fails clearly outside a git repo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kairos-nogit-'));
    await expect(installPrePush(dir)).rejects.toThrow(HookError);
  });
});

describe('the installed hook', () => {
  /** Runs the hook with a fake kairos that records its args and exits with `code`. */
  async function push(code: number) {
    const dir = await gitRepo();
    const bin = join(dir, 'fake-kairos.mjs');
    await writeFile(
      bin,
      `import { writeFileSync } from 'node:fs';
writeFileSync('args.txt', process.argv.slice(2).join(' '));
process.exit(${code});
`,
    );
    await installPrePush(dir, { kairosBin: bin, engine: 'mock' });
    const res = await execa('sh', [HOOK, 'origin', 'url'], { cwd: dir, reject: false });
    return { ...res, args: await readFile(join(dir, 'args.txt'), 'utf8') };
  }

  it('lets a clean check through', async () => {
    const res = await push(0);
    expect(res.exitCode).toBe(0);
    expect(res.args).toBe('check --engine mock');
  });

  it('blocks the push on drift', async () => {
    const res = await push(1);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toMatch(/push blocked.*kairos-report\.md/);
  });

  it('only warns when the check cannot run', async () => {
    const res = await push(2);
    expect(res.exitCode).toBe(0);
    expect(res.stderr).toMatch(/could not run \(exit 2\); pushing anyway/);
  });
});
