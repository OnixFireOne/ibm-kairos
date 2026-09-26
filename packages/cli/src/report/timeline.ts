import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Severity } from '../config/schema.js';
import { DriftReport, type Finding } from './schema.js';

/** One check run with what changed since the previous run. */
export interface TimelineRun {
  report: DriftReport;
  counts: Record<Severity, number>;
  /** Findings not present in the previous run: the moment drift appeared. */
  opened: Finding[];
  /** Findings of the previous run that are gone: the moment drift was resolved. */
  resolved: Finding[];
}

export interface Timeline {
  runs: TimelineRun[];
  totals: { runs: number; opened: number; resolved: number; open: number; bobcoins: number };
  /** History files that could not be read or validated. */
  skipped: string[];
}

/**
 * Finding IDs restart at KRS-001 every run, so a finding is matched across runs by what it is
 * about: its type and code file. Repeats of the same key get an occurrence suffix.
 */
function keyed(findings: Finding[]): Map<string, Finding> {
  const out = new Map<string, Finding>();
  const seen = new Map<string, number>();
  for (const f of findings) {
    const base = `${f.type}|${f.code.file}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.set(`${base}#${n}`, f);
  }
  return out;
}

export function buildTimeline(reports: DriftReport[], skipped: string[] = []): Timeline {
  const sorted = [...reports].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.runId.localeCompare(b.runId),
  );
  let prev = new Map<string, Finding>();
  const runs = sorted.map((report): TimelineRun => {
    const cur = keyed(report.findings);
    const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
    for (const f of report.findings) counts[f.severity] += 1;
    const opened = [...cur].filter(([k]) => !prev.has(k)).map(([, f]) => f);
    const resolved = [...prev].filter(([k]) => !cur.has(k)).map(([, f]) => f);
    prev = cur;
    return { report, counts, opened, resolved };
  });
  const sum = (pick: (r: TimelineRun) => number) => runs.reduce((s, r) => s + pick(r), 0);
  return {
    runs,
    totals: {
      runs: runs.length,
      opened: sum((r) => r.opened.length),
      resolved: sum((r) => r.resolved.length),
      open: runs.at(-1)?.report.findings.length ?? 0,
      bobcoins: Math.round(sum((r) => r.report.cost?.bobcoins ?? 0) * 1e4) / 1e4,
    },
    skipped,
  };
}

/** Reads and validates every `<dir>/*.json`; invalid files are reported, not fatal. */
export async function loadHistory(
  dir: string,
): Promise<{ reports: DriftReport[]; skipped: string[] }> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { reports: [], skipped: [] };
    throw err;
  }
  const reports: DriftReport[] = [];
  const skipped: string[] = [];
  for (const name of names) {
    try {
      const parsed = DriftReport.safeParse(JSON.parse(await readFile(join(dir, name), 'utf8')));
      if (parsed.success) reports.push(parsed.data);
      else skipped.push(name);
    } catch {
      skipped.push(name);
    }
  }
  return { reports, skipped };
}
