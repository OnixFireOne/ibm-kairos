import { Command } from 'commander';
import { registerCheck } from './commands/check.js';
import { registerFix } from './commands/fix.js';
import { registerHandoff } from './commands/handoff.js';
import { registerHook } from './commands/hook.js';
import { registerInit } from './commands/init.js';
import { registerProgress } from './commands/progress.js';
import { registerSession } from './commands/session.js';

export const VERSION = '0.1.0';

export function createProgram(): Command {
  const program = new Command()
    .name('kairos')
    .description('Catch the moment code drifts from intent. Powered by IBM Bob.')
    .version(VERSION);
  registerInit(program);
  registerCheck(program);
  registerFix(program);
  registerProgress(program);
  registerSession(program);
  registerHandoff(program);
  registerHook(program);
  return program;
}
