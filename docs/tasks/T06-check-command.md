# T06 `check` command + Markdown reporter
Status: [x] · Owner: Claude Code · Commits: see `git log --grep T6`

## Goal
One command that turns a diff into a validated drift report, a Markdown PR comment and a history entry, and fails CI on drift.

## Spec
- `commands/check.ts`: `runCheck(cwd, { base?, engine?, noCache?, now?, bob? })` → `{ report, config, markdown, exitCode, historyPath, reportPath }`. Pipeline: `loadConfig` → `getDiff(base)` → `buildContext(…, bobReplyJsonSchema())` → `createEngine` → `analyze(kind: check)` → `parseWithRepair` (repair via the same engine) → drop findings below `minConfidence` → `DriftReport`.
- Writes `.kairos/history/<runId>.json` (committed, feeds the T11 timeline) and `kairos-report.md` in the repo root (T10 posts it as the PR comment).
- CLI: `kairos check [--base <ref>] [--engine bob|mock] [--json] [--no-cache]`. Exit 0 clean / below `failOn`, 1 on a finding ≥ `failOn`, 2 on config/git/engine/parse errors (message only, Bob `task_id` when known).
- `report/markdown.ts`: `renderMarkdown(report, { failOn })` (status line, meta, table sorted by severity, per-finding code/intent evidence, proposal, `kairos fix --id` hint), `renderSummary` (terminal table), helpers `blocking`, `sortFindings`, `location`.

## Decisions
- `runId` = `YYYYMMDDTHHMMSSZ-<head7>`: sortable by name, readable in the timeline.
- Empty diff → report with no findings and no engine call (no Bobcoins spent).
- Cost = check + repair Bobcoins, rounded to 4 decimals; omitted when the engine reported none (empty diff). Mock reports 0.
- `minConfidence` filtering happens in Kairos, not only in the prompt, so a noisy reply can't fail CI with low-confidence findings.
- Code fences in the Markdown use one more backtick than the longest run in the excerpt, so excerpts with ``` don't break the comment.

## Problems
None.

## Result
8 tests in `test/check.test.ts` (temp git repos, mock engine and a fake `bob` exec for the repair path); 86 total green, lint clean. CLI smoke-tested with `tsx` on a temp repo (exit 1 on drift, 2 on bad engine/base). No Bobcoins spent.
