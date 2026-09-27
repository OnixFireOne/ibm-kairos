import { relative } from 'node:path';

/** One `bob run --format stream-json` event, as far as progress reporting cares. */
export interface BobEvent {
  type?: string;
  role?: string;
  tool_name?: string;
  parameters?: Record<string, unknown>;
}

export type ProgressSink = (event: BobEvent) => void;

const ACTIONS: Record<string, string> = {
  read_file: 'reading',
  list_files: 'listing',
  search_files: 'searching',
  glob: 'searching',
  grep: 'searching',
  write_to_file: 'writing',
  apply_diff: 'editing',
  insert_content: 'editing',
  execute_command: 'running',
};

/** Short human label for a tool call: `reading src/pricing.ts`, `running pnpm test`. */
export function describeTool(e: BobEvent, cwd: string): string {
  const name = e.tool_name ?? 'tool';
  const p = e.parameters ?? {};
  const target = [p.path, p.command, p.pattern, p.regex].find((v) => typeof v === 'string') ?? '';
  const shown = target.startsWith('/') ? relative(cwd, target) || '.' : target;
  const label = `${ACTIONS[name] ?? name}${shown ? ` ${shown}` : ''}`;
  return label.length > 60 ? `${label.slice(0, 59)}…` : label;
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** Live one-line status on a TTY stream while Bob works; `stop()` clears it. */
export function ttyProgress(
  cwd: string,
  out: NodeJS.WriteStream = process.stderr,
  now: () => number = Date.now,
): { sink: ProgressSink; stop: () => void } {
  const start = now();
  let frame = 0;
  let status = 'thinking';
  let tools = 0;
  const render = () => {
    const secs = Math.round((now() - start) / 1000);
    const calls = tools ? ` · ${tools} tool call${tools === 1 ? '' : 's'}` : '';
    out.write(`\r\x1b[2K${FRAMES[frame++ % FRAMES.length]} IBM Bob · ${status}${calls} · ${secs}s`);
  };
  const timer = setInterval(render, 120);
  render();
  return {
    sink: (e) => {
      if (e.type === 'tool_use') {
        tools++;
        status = describeTool(e, cwd);
        render();
      } else if (e.type === 'message' && e.role === 'assistant') {
        status = 'analysing';
      }
    },
    stop: () => {
      clearInterval(timer);
      out.write('\r\x1b[2K');
    },
  };
}
