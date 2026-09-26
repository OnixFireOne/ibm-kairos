import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { KairosConfig } from './schema.js';

export const CONFIG_PATH = '.kairos/config.yaml';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Parses and validates config YAML text; missing fields get SPEC §7 defaults. */
export function parseConfig(text: string, source = CONFIG_PATH): KairosConfig {
  let raw: unknown;
  try {
    raw = parse(text) ?? {};
  } catch (err) {
    throw new ConfigError(`${source}: invalid YAML: ${(err as Error).message}`);
  }
  const result = KairosConfig.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new ConfigError(`${source}: invalid config\n${issues}`);
  }
  return result.data;
}

/** Loads `.kairos/config.yaml` from `cwd`, or returns defaults when the file is missing. */
export async function loadConfig(cwd: string): Promise<KairosConfig> {
  const path = join(cwd, CONFIG_PATH);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return KairosConfig.parse({});
    throw err;
  }
  return parseConfig(text, CONFIG_PATH);
}
