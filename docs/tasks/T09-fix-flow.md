# T09 Fix flow
Status: [x] done (real Bob run on the demo; screenshots pending) · Owner: Claude Code

## Goal
`kairos fix --id <ID>`: IBM Bob resolves one finding from the last check, the user sees the diff and confirms, Kairos commits it and re-runs `check` to prove the drift is gone.

## Spec
- `kairos fix --id KRS-002 [--truth intent|code] [--allow-code] [--yes] [--engine bob|mock] [--no-check]` (`packages/cli/src/commands/fix.ts`).
- Finding source: the newest `.kairos/history/<runId>.json`. Ids are case-insensitive.
- Truth: `--truth` overrides the report's `truth`. `ask` without `--truth` is an error that explains both options.
- Code edits: resolving with truth `intent` changes source code (except `MISSING_TEST` / `add_test`), so it needs `--allow-code`. Checked before Bob runs.
- Bob: `bob run --mode kairos-fix` (edit restricted by `fileRegex` to `.md|.yaml|.yml|.json|.test.ts`), or `kairos-fix-code` (unrestricted edit) with `--allow-code`. Prompt: `buildFixPrompt()` = finding, both evidences, explanation, truth, proposal (or a note that the user overrode the truth), rules (smallest change, docs-only unless allowed, run tests, don't commit). Raw output saved to `.kairos/runs/<ts>-fix.json`, never cached.
- Mock engine: applies `.kairos/fixtures/fix-<ID>-<TYPE>.patch` (else `fix-<ID>.patch`) with `git apply`; no patch means no change.
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
- **Edit runs use the `session` caps** (3 Bobcoins, 40 turns), not the check caps (8 turns was too few to edit and run tests).
- **Bob failing midway reverts its partial edits** and says so in the error.
- **Patch fixtures carry the finding type**: re-checks renumber ids, so C and B were both KRS-002.
- Appending to `docs/kairos/DECISIONS.md` landed in T13 (inside the fix commit, only when the file exists).

## Problems
- Real run, first attempt at A: Bob made the right edits but hit `--max-turns 8` while running tests; the partial edits stayed in the tree. Fixed (session caps + revert on error), re-run succeeded.
- I ran `reset.sh` for the offline rehearsal before copying `.kairos/runs` of the real runs; recovered task ids and costs from Bob Shell's logs (`~/.bob/logs/shell/`), copied to `bob_sessions/cli/*.shell.log`.
- Mock re-check on the demo reports "resolved" only because there is no fixture for the post-fix prompt (empty reply). Fine for offline rehearsal, not evidence.

## Result
- 22 tests in `test/fix.test.ts` (fake `bob` exec that edits the temp repo; mock patch path; all refusals happen before any Bob call). 111 tests green, lint clean.
- Demo: `demo/orders-api/.kairos/fixtures/fix-KRS-002.patch` (hand-written, C: `DB_URL` → `DATABASE_URL` in README + SPEC). Smoke: reset, drift A/B/C, `check --engine mock`, `fix --id KRS-002 --engine mock --yes` → committed, resolved.
- Real run on the demo (Bob tasks 06–13, 1.12 Bobcoins incl. the failed attempt): check → 4 findings; `fix --id KRS-002` (C, docs) → resolved; `fix --id KRS-002 --truth code` (B: SPEC + openapi + 2 tests, which also closed MISSING_TEST) → resolved; `fix --id KRS-001 --truth intent --allow-code` (A: code + tests back to 10%) → resolved; final re-check clean.
- Recorded: `demo/orders-api/.kairos/fixtures/fix-KRS-002-STALE_DOC.patch`, `fix-KRS-002-UNDOCUMENTED_BEHAVIOR.patch`, `fix-KRS-001-SPEC_VIOLATION.patch` (replacing the hand-written patch) + the 3 re-check replies. Offline rehearsal with `--engine mock` replays the chain to a clean check.
- 142 tests green. Pending: screenshots of Bob tasks 06–13 (Bob IDE, workspace `orders-api`).
