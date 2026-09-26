import { Command } from 'commander';

export const VERSION = '0.1.0';

export function createProgram(): Command {
  return new Command()
    .name('kairos')
    .description('Catch the moment code drifts from intent. Powered by IBM Bob.')
    .version(VERSION);
}
