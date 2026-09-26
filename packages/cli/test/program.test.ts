import { describe, expect, it } from 'vitest';
import { createProgram, VERSION } from '../src/program.js';

describe('createProgram', () => {
  it('is named kairos and reports its version', () => {
    const program = createProgram();
    expect(program.name()).toBe('kairos');
    expect(program.version()).toBe(VERSION);
  });
});
