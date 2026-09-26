import type { Command } from 'commander';
import { logCommit } from '../docs/log.js';

export function registerProgress(program: Command): void {
  program
    .command('progress')
    .description('Log a commit in docs/kairos/PROGRESS.md (run by the post-commit hook)')
    .option('--rev <rev>', 'commit to log', 'HEAD')
    .action(async (o: { rev: string }) => {
      const res = await logCommit(process.cwd(), o.rev);
      const MESSAGES = {
        logged: `Logged ${o.rev} in docs/kairos/PROGRESS.md.`,
        'no-docs': 'No docs/kairos/PROGRESS.md here; run `kairos init` first.',
        skipped: 'Commit only touches PROGRESS.md; not logged.',
      };
      console.log(MESSAGES[res]);
    });
}
