# T14 Handoff + freshness
Status: [x] done · Owner: Claude Code · Commits: see `git log --grep T14`

## Goal
Close the continuity loop: `kairos check` notices stale living docs, `kairos handoff` rewrites `HANDOFF.md` for sessions that ended abruptly, `kairos session` runs Bob in `kairos-dev` and says "start a new chat" at the right moment. Bob in chat runs the Kairos commands itself where it makes sense.

## Spec
- **Mode rules** (`kairos-dev` in `.bob/custom_modes.yaml` = `src/templates/bob-modes.ts`): run `kairos init` when asked; run `kairos check` once after each task and before a handoff; resolve findings in chat itself (ask on truth "ask" or before touching source code), append to `docs/kairos/DECISIONS.md`, re-check; never call `kairos fix` from chat. The CLAUDE/AGENTS pointer got the same findings rule.
- **Freshness** (`src/docs/freshness.ts`, called from `buildContext`): only when `docs/kairos/PROGRESS.md` or `PLAN.md` exists. (a) Source files changed, `PROGRESS.md` not in the diff and no short hash of `base..HEAD` in it → candidate. (b) A commit subject names `T<n>` that `PLAN.md` still lists as `- [ ] **T<n>` → candidate with the PLAN line. Candidates go to a `## Docs freshness candidates` prompt section (before Output); Bob confirms them as `STALE_DOC` or dismisses them. No candidates → the prompt is byte-identical to before.
- **`kairos handoff [--engine]`** (`src/docs/handoff.ts`, `src/commands/handoff.ts`): input = commits since the last commit touching `docs/kairos/HANDOFF.md` (else the last 30), PLAN statuses, `git status --short` (without Kairos runtime files), the newest report, the current HANDOFF. Bob (`kairos-dev`, `budget.maxCost/maxTurns`, not cached, raw run `-handoff.json`) replies with the Markdown; `extractHandoff` requires `# Handoff` and `## Next step`, cuts a code fence. Mock engine = deterministic draft (`draftHandoff`, keeps the old Gotchas). Prints the first message for the new chat (`Continue T2: Collector` from the first `[~]`, else `[ ]` task).
- **`kairos session "<task>" [--new] [--engine]`** (`src/commands/session.ts`): `bob run --mode kairos-dev` with `session.maxCostPerRun`/`maxTurnsPerRun`, 30 min timeout; adds `stats.tool_calls` and `session_costs` to `.kairos/session.json`. At `toolCallBudget` or `bobcoinBudget` it runs `handoff`, prints "Good moment to start a new chat… First message: …" and deletes the session file. `--new` resets totals.
- Config: new `session` block (defaults 3 / 40 / 40 / 5), in the `init` template and SPEC §7. `EngineResult.toolCalls` from Bob's `stats.tool_calls`.

## Decisions
- **Bob fixes findings in chat, `kairos fix` stays for terminal/CI.** Calling `kairos fix` from Bob's terminal nests a second Bob (double Bobcoins, needs the key there, and `--yes` skips the human confirm).
- **`kairos check` from chat once per task**, not per edit: it spends Bobcoins.
- **Tool calls as the turn measure**: Bob's result line has `tool_calls`, no turn count.
- **Session budget → handoff automatically**, the area-switch rule stays in the mode instructions (Kairos cannot see "area" deterministically).
- **Freshness counts hook entries as logged**: with the post-commit hook, a commit is in the working-tree `PROGRESS.md` even before it is committed.

## Problems
- Running `prettier --write test` from `packages/cli` ignored the root `.prettierignore` and reformatted a `.md` snapshot; restored. Run prettier from the repo root.

## Result
- `test/living.test.ts` (17 tests): mode rules, freshness (both rules, quiet cases, no docs), prompt section, PLAN parsing and first message, handoff input/draft/prompt/extract, `runHandoff` mock + fake Bob, `runSession` budget sums, over-budget handoff + reset, `--new`. 140 tests green, lint clean.
- Smoke with the built CLI (mock): `init`, commit `T1: first task`, `check`, `session "continue"`, `handoff --engine mock` → HANDOFF with "Continue T1: First task".
- Not run on real Bob yet (costs Bobcoins): `kairos session` and `kairos handoff --engine bob` are candidates for the demo/video.
