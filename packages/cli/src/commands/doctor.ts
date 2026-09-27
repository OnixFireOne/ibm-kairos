import { execa } from 'execa';

export interface EnvCheck {
  ok: boolean;
  label: string;
  /** What to do when not ok. */
  hint?: string;
}

/** Returns the `bob --version` output, or undefined when Bob Shell cannot be run. */
export type BobVersion = (bin: string) => Promise<string | undefined>;

const defaultBobVersion: BobVersion = async (bin) => {
  const res = await execa(bin, ['--version'], { reject: false, timeout: 15_000 });
  if (res.failed) return undefined;
  return String(res.stdout).split('\n')[0]?.trim() || 'unknown version';
};

/**
 * Checks what live `kairos check` needs: IBM Bob Shell on PATH and BOB_API_KEY in the environment.
 * The key is never read from or written to files: `.kairos/config.yaml` is committed.
 */
export async function checkEnvironment(
  o: { env?: NodeJS.ProcessEnv; bin?: string; bobVersion?: BobVersion } = {},
): Promise<EnvCheck[]> {
  const env = o.env ?? process.env;
  const bin = o.bin ?? 'bob';
  const version = await (o.bobVersion ?? defaultBobVersion)(bin);
  return [
    version
      ? { ok: true, label: `IBM Bob Shell found (\`${bin}\` ${version})` }
      : {
          ok: false,
          label: 'IBM Bob Shell not found',
          hint: `install IBM Bob Shell (https://bob.ibm.com/docs/shell/getting-started/install-and-setup) and make sure \`${bin}\` is on PATH`,
        },
    env.BOB_API_KEY
      ? { ok: true, label: 'BOB_API_KEY is set' }
      : {
          ok: false,
          label: 'BOB_API_KEY is not set',
          hint: 'create an IBM Bob API key with the Inference scope and `export BOB_API_KEY=...` in your shell profile (never in .kairos/config.yaml; in CI use a repository secret)',
        },
  ];
}

/** Human-readable report; ends with the offline fallback when something is missing. */
export function formatEnvChecks(checks: EnvCheck[]): string {
  const lines = checks.map((c) => (c.ok ? `✓ ${c.label}` : `✗ ${c.label}: ${c.hint}`));
  lines.push(
    checks.every((c) => c.ok)
      ? 'Ready: run `kairos check`.'
      : 'Until then Kairos runs offline: `kairos check --engine mock` replays recorded replies.',
  );
  return lines.join('\n');
}
