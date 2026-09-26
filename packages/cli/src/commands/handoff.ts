import type { Command } from 'commander';
import { ConfigError, loadConfig } from '../config/load.js';
import type { KairosConfig } from '../config/schema.js';
import { HandoffError, runHandoff } from '../docs/handoff.js';
import { EngineError } from '../engine/index.js';
import { lastReportOrUndefined, newChatMessage } from './session.js';

const KNOWN_ERRORS = [ConfigError, EngineError, HandoffError];

export function registerHandoff(program: Command): void {
  program
    .command('handoff')
    .description(
      'Refresh docs/kairos/HANDOFF.md from git, PLAN.md and the last check (drafted by IBM Bob)',
    )
    .option('--engine <engine>', 'bob | mock (mock: a draft without LLM)')
    .action(async (o: { engine?: string }) => {
      if (o.engine !== undefined && o.engine !== 'bob' && o.engine !== 'mock') {
        console.error(`kairos: unknown engine "${o.engine}" (use bob or mock)`);
        process.exitCode = 2;
        return;
      }
      try {
        const cwd = process.cwd();
        const res = await runHandoff(cwd, await loadConfig(cwd), {
          engine: o.engine as KairosConfig['engine'] | undefined,
          report: await lastReportOrUndefined(cwd),
        });
        console.log(`Wrote ${res.path} (${res.text.length} chars).`);
        if (res.costBobcoins !== undefined) console.log(`Cost: ${res.costBobcoins} Bobcoins`);
        console.log(newChatMessage(res));
      } catch (err) {
        if (!KNOWN_ERRORS.some((E) => err instanceof E)) throw err;
        const taskId = err instanceof EngineError && err.taskId ? ` (Bob task ${err.taskId})` : '';
        console.error(`kairos: ${(err as Error).message}${taskId}`);
        process.exitCode = 2;
      }
    });
}
