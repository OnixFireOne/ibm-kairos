import { Command } from 'commander';
import { registerInit } from './commands/init.js';

export const VERSION = '0.1.0';

export function createProgram(): Command {
  const program = new Command()
    .name('kairos')
    .description('Catch the moment code drifts from intent. Powered by IBM Bob.')
    .version(VERSION);
  registerInit(program);
  return program;
}
