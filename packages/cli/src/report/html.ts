import { SEVERITIES, type Severity } from '../config/schema.js';
import { LOGO_DATA_URI } from '../templates/logo.js';
import { blocking, location, sortFindings } from './markdown.js';
import type { Finding } from './schema.js';
import type { Timeline, TimelineRun } from './timeline.js';

export const TIMELINE_FILE = 'kairos-timeline.html';

/** IBM Carbon status colours. */
const COLOR: Record<Severity, string> = { high: '#fa4d56', medium: '#ff832b', low: '#f1c21b' };
const RESOLVED = '#42be65';

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** `2026-09-26T16:31:38.000Z` → `2026-09-26 16:31 UTC`. */
const when = (iso: string): string => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

/** Stacked bars: findings per run by severity, with opened/resolved marks under each bar. */
function chart(runs: TimelineRun[]): string {
  const bar = 28;
  const gap = 20;
  const top = 16;
  const plot = 140;
  const width = Math.max(320, runs.length * (bar + gap) + gap);
  const max = Math.max(1, ...runs.map((r) => r.report.findings.length));
  const unit = plot / max;
  const parts: string[] = [];
  runs.forEach((r, i) => {
    const x = gap + i * (bar + gap);
    let y = top + plot;
    for (const s of SEVERITIES) {
      const h = r.counts[s] * unit;
      if (h === 0) continue;
      y -= h;
      parts.push(
        `<rect x="${x}" y="${y.toFixed(1)}" width="${bar}" height="${h.toFixed(1)}" fill="${COLOR[s]}" rx="3"><title>${r.counts[s]} ${s}</title></rect>`,
      );
    }
    if (r.report.findings.length === 0) {
      parts.push(
        `<circle cx="${x + bar / 2}" cy="${top + plot - 6}" r="5" fill="${RESOLVED}"><title>clean</title></circle>`,
      );
    }
    const label = `${i + 1}`;
    parts.push(
      `<a href="#run-${i + 1}"><text x="${x + bar / 2}" y="${top + plot + 18}" class="n">${label}</text></a>`,
    );
    const marks = [
      r.opened.length > 0 ? `<tspan fill="${COLOR.high}">+${r.opened.length}</tspan>` : '',
      r.resolved.length > 0 ? `<tspan fill="${RESOLVED}">−${r.resolved.length}</tspan>` : '',
    ].join(' ');
    if (marks.trim())
      parts.push(`<text x="${x + bar / 2}" y="${top + plot + 34}" class="m">${marks}</text>`);
  });
  const height = top + plot + 44;
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Findings per run">
<line x1="0" y1="${top + plot}" x2="${width}" y2="${top + plot}" stroke="#2b3a6b"/>
${parts.join('\n')}
</svg>`;
}

const badge = (s: Severity): string =>
  `<span class="sev" style="background:${COLOR[s]}">${s}</span>`;

function findingRow(f: Finding, isNew: boolean): string {
  return `<tr><td>${badge(f.severity)}</td><td><code>${esc(f.id)}</code>${isNew ? ' <span class="new">new</span>' : ''}</td><td>${esc(f.type)}</td><td>${esc(f.title)}</td><td><code>${esc(location(f.code))}</code></td></tr>`;
}

function runCard(r: TimelineRun, i: number, failOn: Severity): string {
  const { report } = r;
  const findings = sortFindings(report.findings);
  const failing = blocking(findings, failOn).length > 0;
  const status =
    findings.length === 0
      ? `<span class="ok">clean</span>`
      : `<span class="${failing ? 'fail' : 'warn'}">${findings.length} finding(s)</span>`;
  const cost = report.cost?.bobcoins;
  const meta = [
    when(report.createdAt),
    `<code>${esc(report.base)}...${esc(report.head.slice(0, 7))}</code>`,
    ...(cost === undefined ? [] : [`${cost} Bobcoins`]),
  ].join(' · ');
  const opened = new Set(r.opened);
  const out = [
    `<section class="run" id="run-${i + 1}">`,
    `<div class="dot" style="background:${findings.length === 0 ? RESOLVED : COLOR[findings[0]!.severity]}"></div>`,
    `<h2>#${i + 1} ${status}</h2>`,
    `<p class="meta">${meta} · <code>${esc(report.runId)}</code></p>`,
    `<p>${esc(report.summary)}</p>`,
  ];
  if (findings.length > 0) {
    out.push(
      '<table><thead><tr><th>Severity</th><th>ID</th><th>Type</th><th>Title</th><th>Code</th></tr></thead><tbody>',
      ...findings.map((f) => findingRow(f, i > 0 && opened.has(f))),
      '</tbody></table>',
    );
  }
  if (r.resolved.length > 0) {
    out.push(
      `<p class="resolved">Resolved since #${i}:</p><ul class="resolved">`,
      ...r.resolved.map(
        (f) => `<li><s>${esc(f.title)}</s> <code>${esc(location(f.code))}</code></li>`,
      ),
      '</ul>',
    );
  }
  out.push('</section>');
  return out.join('\n');
}

const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#060a1c;color:#dde5f7;font:15px/1.5 -apple-system,BlinkMacSystemFont,"IBM Plex Sans","Segoe UI",sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 20px 64px}
header{display:flex;align-items:center;gap:16px}
header img{width:64px;height:64px;border-radius:14px}
h1{margin:0;font-size:26px}
header p{margin:2px 0 0;color:#8ea0c8}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}
.stat{background:#0b1230;border:1px solid #1d2a55;border-radius:10px;padding:10px 16px;min-width:120px}
.stat b{display:block;font-size:24px}
.stat span{color:#8ea0c8;font-size:13px}
.panel{background:#0b1230;border:1px solid #1d2a55;border-radius:12px;padding:16px;overflow-x:auto}
.chart .n{fill:#8ea0c8;font-size:12px;text-anchor:middle}
.chart .m{font-size:12px;text-anchor:middle;font-weight:600}
.legend{display:flex;gap:16px;margin-top:8px;color:#8ea0c8;font-size:13px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}
.runs{position:relative;margin-top:28px;padding-left:28px;border-left:2px solid #1d2a55}
.run{position:relative;margin-bottom:24px;background:#0b1230;border:1px solid #1d2a55;border-radius:12px;padding:14px 18px}
.run .dot{position:absolute;left:-37px;top:20px;width:16px;height:16px;border-radius:50%;border:3px solid #060a1c}
.run h2{margin:0;font-size:18px}
.meta{color:#8ea0c8;font-size:13px;margin:4px 0}
.ok{color:${RESOLVED}}.warn{color:${COLOR.low}}.fail{color:${COLOR.high}}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th,td{text-align:left;padding:6px 8px;border-top:1px solid #1d2a55;vertical-align:top}
th{color:#8ea0c8;font-weight:500}
td:nth-child(-n+3){white-space:nowrap}
code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;color:#9be7ff}
.sev{color:#060a1c;font-weight:600;font-size:12px;padding:1px 8px;border-radius:10px}
.new{color:${COLOR.high};font-size:12px;font-weight:600}
p.resolved{color:${RESOLVED};margin:10px 0 2px;font-weight:600}
ul.resolved{margin:0;padding-left:20px;color:#8ea0c8}
footer{margin-top:40px;color:#8ea0c8;font-size:13px;text-align:center}
`;

/** A single self-contained HTML page: no scripts, no external assets, opens offline. */
export function renderTimelineHtml(
  timeline: Timeline,
  opts: { failOn: Severity; generatedAt: Date },
): string {
  const { runs, totals } = timeline;
  const stat = (value: string | number, label: string) =>
    `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
  const body =
    runs.length === 0
      ? '<p class="panel">No runs yet. Run <code>kairos check</code> to start the history.</p>'
      : [
          `<div class="panel">${chart(runs)}`,
          `<div class="legend">${SEVERITIES.slice()
            .reverse()
            .map((s) => `<span><i style="background:${COLOR[s]}"></i>${s}</span>`)
            .join(
              '',
            )}<span><i style="background:${RESOLVED}"></i>clean / resolved</span></div></div>`,
          '<div class="runs">',
          ...runs.map((r, i) => runCard(r, i, opts.failOn)).reverse(),
          '</div>',
        ].join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kairos timeline</title>
<link rel="icon" href="${LOGO_DATA_URI}">
<style>${CSS}</style>
</head>
<body>
<main>
<header><img src="${LOGO_DATA_URI}" alt="Kairos logo"><div><h1>Kairos timeline</h1><p>The moments code drifted from intent, and when it came back.</p></div></header>
<div class="stats">
${stat(totals.runs, 'runs')}
${stat(totals.open, 'open now')}
${stat(totals.opened, 'drift moments')}
${stat(totals.resolved, 'resolved')}
${stat(totals.bobcoins, 'Bobcoins')}
</div>
${body}
<footer>Generated ${esc(when(opts.generatedAt.toISOString()))} by Kairos, powered by IBM Bob.</footer>
</main>
</body>
</html>
`;
}
