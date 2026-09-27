import { describe, expect, it } from 'vitest';
import { checkEnvironment, formatEnvChecks } from '../src/commands/doctor.js';

describe('checkEnvironment', () => {
  it('passes when Bob Shell runs and the key is set', async () => {
    const checks = await checkEnvironment({
      env: { BOB_API_KEY: 'k' },
      bobVersion: async () => '2.0.5',
    });
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(formatEnvChecks(checks)).toBe(
      '✓ IBM Bob Shell found (`bob` 2.0.5)\n✓ BOB_API_KEY is set\nReady: run `kairos check`.',
    );
  });

  it('explains what is missing and offers the offline mode', async () => {
    const checks = await checkEnvironment({ env: {}, bobVersion: async () => undefined });
    const text = formatEnvChecks(checks);
    expect(checks.map((c) => c.ok)).toEqual([false, false]);
    expect(text).toContain(
      '✗ IBM Bob Shell not found: install IBM Bob Shell (https://bob.ibm.com/docs/shell/getting-started/install-and-setup)',
    );
    expect(text).toContain('✗ BOB_API_KEY is not set: create an IBM Bob API key');
    expect(text).toContain('never in .kairos/config.yaml');
    expect(text).toContain('kairos check --engine mock');
  });

  it('never prints the key itself', async () => {
    const checks = await checkEnvironment({
      env: { BOB_API_KEY: 'secret-value' },
      bobVersion: async () => '2.0.5',
    });
    expect(formatEnvChecks(checks)).not.toContain('secret-value');
  });
});
