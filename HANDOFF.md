# Handoff

Updated: 2026-09-26 ~14:35 Astana, after T5. Deadline: Sun Sep 27 15:00 UTC (submit by 17:00 Astana).

## State
- Done: T0 scaffold, T1 config + `kairos init`, T2 diff collector (Bob), T3 context selection (Bob) + prompt renderer, T4 report schema + reply parser, T5 engines (Bob/mock/cache). 78 tests green, lint clean, all pushed to `main` on github.com/OnixFireOne/ibm-kairos.
- Bobcoins spent: 3.61 / 40 (details: `bob_sessions/README.md`).

## In progress
Nothing. Working tree clean.

## Next step
T6 `check` command + Markdown reporter (Claude Code, no Bob): wire `getDiff` → context builder → `createEngine(config, …)` → `parseWithRepair(text, repairWith(engine))` → `DriftReport`; see PLAN T6 and the T05 decisions for the engine API. Then T7 demo repo.

## Gotchas
- Never run real `bob` unless asked. Run Bob tasks with `zsh -ic 'scripts/bob-task.sh <taskNN-name> <prompt-file> [mode] [maxCost] [maxTurns]'` (the key lives in `~/.zshrc`; plain shells don't see it). Never print/commit the key.
- Bob works tests-first: Claude writes contract + fixtures + red tests, Bob implements. Double-check every expected value against fixtures first (task 03 burnt 2.08 on a wrong expectation). Tell Bob to run only the target test file while iterating.
- Screenshots (required evidence, only for tasks Bob ran): after each Bob run, remind the user in chat with the task number, prompt title and `task_id` (Bob IDE → Tasks → All → open the task → click its header). The user drops the PNG into `../shots/`; view it, check task id and that no secrets are visible, move it to `bob_sessions/kairos_taskNN_<desc>.png` (glob the filename: macOS uses a special space), add/link its row in `bob_sessions/README.md`, commit. Next Bob task number: 04. Tell the user not to press "Continue Task" on capped tasks.
- Everything in the repo is English (judges). Chat with the user in Russian.
- Bob CLI flag is `--mode`, not `--chat-mode`.
- `pnpm test` must stay green at every commit, so tests + implementation land together.

## Read first
`CLAUDE.md`, this file, the current task file in `docs/tasks/`, `PLAN.md` (statuses). `SPEC.md` only the sections the task needs (§6 architecture). Past task files only when touching that module.
- Every task: create/update its `docs/tasks/TNN-*.md` (spec, decisions, problems, result); keep `SPEC.md` for the stable product picture.

## Last check
No `kairos check` run yet (T6).
