# T11 HTML timeline
Status: [x] done · Owner: Claude Code · Commits: see `git log --grep T11`

## Goal
Show the "Kairos moments" over time: when drift appeared and when it was resolved, as one page that opens offline (SPEC §5, §6).

## Spec
- **`kairos report [--html] [--out <file>]`** (`src/commands/report.ts`): reads `.kairos/history/*.json`, prints one line per run (time, head, findings, `+N opened` / `-N resolved`) and totals. `--html` (or `--out`) also writes `kairos-timeline.html` (path absolute or relative to cwd).
- **`src/report/timeline.ts`**: `loadHistory(dir)` validates every file with `DriftReport` (invalid files are listed as skipped, not fatal; a missing dir is an empty history). `buildTimeline(reports)` sorts by `createdAt`, counts findings by severity, and diffs each run against the previous one: `opened`, `resolved`. Totals: runs, open now (last run), drift moments (sum of opened), resolved, Bobcoins.
- **`src/report/html.ts`**: `renderTimelineHtml(timeline, { failOn, generatedAt })` → a single self-contained page: no scripts, no external assets. Logo as a data URI (`src/templates/logo.ts`, generated from `brand/kairos_logo.svg` with the C2PA metadata stripped, ~14 KB). Stat tiles, an inline SVG stacked bar chart (findings per run by severity, `+N`/`−N` marks, run numbers link to cards), then run cards newest first with a findings table (`new` tag on findings opened in that run) and a struck-through "Resolved since #N" list. IBM Carbon status colours; dark theme matching the logo. All report text is HTML-escaped.

## Decisions
- Finding IDs restart at `KRS-001` every run and Bob's titles vary between runs, so findings are matched across runs by `type + code.file` (plus an occurrence index for repeats within one run). Simple and stable on the demo; a renamed file counts as resolved + opened.
- No JS in the page: it stays readable anywhere (email attachments, CI artifacts, file://) and cannot run anything.
- Did it directly in Claude Code instead of delegating to Codex: three small modules, the prompt + review would cost about as much.

## Problems
- `--out /abs/path` was joined onto cwd (`join`); fixed with `resolve`, covered by a test.
- The built-in browser can't screenshot `file://` pages; served `/tmp` over `python3 -m http.server` to check the layout.

## Result
- 11 tests in `test/timeline.test.ts` (timeline diffing, repeats, empty history, HTML self-containment + escaping, text output, `--html`, absolute `--out`, no history). 161 tests green, lint clean.
- Checked visually on the demo history (`demo/.work/orders-api`, 4 mock runs A/B/C/control): chart, marks and cards render as intended.
- Follow-up for T12: a screenshot of the timeline for the README/video; after the fix flow in the demo the last run should be clean (green dot).
