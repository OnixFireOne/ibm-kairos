import { describe, expect, it } from 'vitest';
import { describeTool, ttyProgress } from '../src/engine/progress.js';

describe('describeTool', () => {
  it('names the action and shows paths relative to the repo', () => {
    expect(
      describeTool({ tool_name: 'read_file', parameters: { path: '/r/src/pricing.ts' } }, '/r'),
    ).toBe('reading src/pricing.ts');
    expect(
      describeTool({ tool_name: 'execute_command', parameters: { command: 'pnpm test' } }, '/r'),
    ).toBe('running pnpm test');
    expect(describeTool({ tool_name: 'glob', parameters: { pattern: 'test/**/*.ts' } }, '/r')).toBe(
      'searching test/**/*.ts',
    );
    expect(describeTool({ tool_name: 'mystery' }, '/r')).toBe('mystery');
  });

  it('truncates long labels', () => {
    const label = describeTool(
      { tool_name: 'execute_command', parameters: { command: 'x'.repeat(100) } },
      '/r',
    );
    expect(label).toHaveLength(60);
    expect(label.endsWith('…')).toBe(true);
  });
});

describe('ttyProgress', () => {
  it('renders the current tool and the tool call count, and clears the line on stop', () => {
    let written = '';
    const out = { write: (s: string) => ((written += s), true) } as unknown as NodeJS.WriteStream;
    let t = 0;
    const p = ttyProgress('/r', out, () => t);
    p.sink({ type: 'tool_use', tool_name: 'read_file', parameters: { path: '/r/docs/SPEC.md' } });
    t = 3000;
    p.sink({ type: 'tool_use', tool_name: 'read_file', parameters: { path: '/r/src/pricing.ts' } });
    p.stop();
    expect(written).toContain('IBM Bob · thinking');
    expect(written).toContain('IBM Bob · reading src/pricing.ts · 2 tool calls · 3s');
    expect(written.endsWith('\r\x1b[2K')).toBe(true);
  });
});
