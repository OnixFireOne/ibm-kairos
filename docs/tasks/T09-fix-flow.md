# T09 Fix flow
Status: [~] code done (mock + fake bob), real Bob fix runs pending · Owner: Claude Code

## Goal
`kairos fix --id <ID>`: IBM Bob resolves one finding from the last check, the user sees the diff and confirms, Kairos commits it and re-runs `check` to prove the drift is gone.

## Spec
- `kairos fix --id KRS-002 [--truth intent|code] [--allow-code] [--yes] [--engine bob|mock] [--no-check]` (`packages/cli/src/commands/fix.ts`).
- Finding source: the newest `.kairos/history/<runId>.json`. Ids are case-insensitive.
- Truth: `--truth` overrides the report's `truth`. `ask` without `--truth` is an error that explains both options.
- Code edits: resolving with truth `intent` changes source code (except `MISSING_TEST` / `add_test`), so it needs `--allow-code`. Checked before Bob runs.
- Bob: `bob run --mode kairos-fix` (edit restricted by `fileRegex` to `.md|.yaml|.yml|.json|.test.ts`), or `kairos-fix-code` (unrestricted edit) with `--allow-code`. Prompt: `buildFixPrompt()` = finding, both evidences, explanation, truth, proposal (or a note that the user overrode the truth), rules (smallest change, docs-only unless allowed, run tests, don't commit). Raw output saved to `.kairos/runs/<ts>-fix.json`, never cached.
- Mock engine: applies `.kairos/fixtures/fix-<ID>.patch` with `git apply`; no patch means no change.
- After Bob: changed files = `git diff --name-only` + new untracked files (ignoring `.kairos/` and `kairos-report.md`). New files are added with `--intent-to-add` so they show in the diff.
- Guard: without `--allow-code`, any changed file outside the docs/tests regex reverts everything and fails.
- Confirm: interactive `[y/N]`; `--yes` skips it; non-TTY without `--yes` fails before Bob runs. "No" reverts tracked and new files.
- Accept: commit only the changed files, `kairos fix <ID>: <title>` + body (truth, type, location, Bob's summary). Then `runCheck`; the finding counts as open if the new report has one with the same `type` and `code.file` (ids renumber per run).
- Exit codes: 0 resolved / committed / rejected, 1 still open / no change, 2 errors.

## Decisions
- **Commit on accept.** `check` diffs `base...HEAD`, so an uncommitted fix is invisible to the re-check. The commit also puts the decision in git history (the timeline later reads it). `--no-check` skips the re-check but still commits.
- **Clean tree required** (tracked files only; untracked `.kairos/history` and `kairos-report.md` from `check` are fine), so the diff and a revert touch only Bob's edits.
- **Belt and braces for docs-only**: the mode's `fileRegex` stops Bob, and Kairos checks the changed files itself (a mode edited by the user or an older Bob must not slip code changes through).
- **New mode `kairos-fix-code`** instead of rewriting `.bob/custom_modes.yaml` on the fly for `--allow-code`.
- Appending to `docs/kairos/DECISIONS.md` landed in T13 (inside the fix commit, only when the file exists).

## Problems
- Mock re-check on the demo reports "resolved" only because there is no fixture for the post-fix prompt (empty reply). Fine for offline rehearsal, not evidence.

## Result
- 22 tests in `test/fix.test.ts` (fake `bob` exec that edits the temp repo; mock patch path; all refusals happen before any Bob call). 111 tests green, lint clean.
- Demo: `demo/orders-api/.kairos/fixtures/fix-KRS-002.patch` (hand-written, C: `DB_URL` → `DATABASE_URL` in README + SPEC). Smoke: reset, drift A/B/C, `check --engine mock`, `fix --id KRS-002 --engine mock --yes` → committed, resolved.
- Pending (only when the user asks, spends Bobcoins): real `kairos fix` on the demo for C (`--id KRS-002`) and B (`--id KRS-003 --truth code`, `--id KRS-004`), then record Bob's diffs as `fix-<ID>.patch` fixtures and screenshot the tasks.
