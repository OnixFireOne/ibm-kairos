# Handoff

Updated: 2026-09-26 ~15:05 Astana, after T8. Deadline: Sun Sep 27 15:00 UTC (submit by 17:00 Astana).

## State
- Done: T0 scaffold, T1 config + `kairos init`, T2 diff collector (Bob), T3 context selection (Bob) + prompt renderer, T4 report schema + reply parser, T5 engines (Bob/mock/cache), T6 `kairos check` + Markdown report, T7 demo repo + drift scripts, T8 real Bob on the demo (A/B/C found, control clean, fixtures recorded). 89 tests green, lint clean, all pushed to `main` on github.com/OnixFireOne/ibm-kairos.
- Bobcoins spent: 3.73 / 40 (details: `bob_sessions/README.md`).

## In progress
Nothing. Working tree clean.

## Next step
1. User: screenshots for Bob tasks 04 (`f3babde5…`, check A/B/C) and 05 (`99bc687f…`, control) → `bob_sessions/kairos_task04_check_demo_abc.png`, `kairos_task05_check_demo_control.png`, fill the README rows.
2. T9 fix flow: `kairos fix --id <ID> [--truth intent|code] [--allow-code] [--yes]` → `bob run --mode kairos-fix` (mode in `.bob/custom_modes.yaml`), show git diff, confirm, re-run check. Findings to fix live in `.kairos/history/<runId>.json` (latest run). Test against a fake `bob` exec; real runs on the demo (B, C) only when asked.

## Gotchas
- Delegate sizable implementation to Codex only when cheaper than doing it in Claude (see `CLAUDE.md` rules): Claude Code writes contract + red tests, Codex makes them green, Claude reviews and commits. Run it directly: `zsh -ic 'codex exec -s workspace-write "<prompt>"'` (no bridge needed; Codex 0.155 verified).
- When suggesting a new chat, give a first message naming the next task (e.g. «Продолжай T6: команда check + отчёт») so the chat title is meaningful.
- Never run real `bob` unless asked. Run Bob tasks with `zsh -ic 'scripts/bob-task.sh <taskNN-name> <prompt-file> [mode] [maxCost] [maxTurns]'` (the key lives in `~/.zshrc`; plain shells don't see it). Never print/commit the key.
- Bob works tests-first: Claude writes contract + fixtures + red tests, Bob implements. Double-check every expected value against fixtures first (task 03 burnt 2.08 on a wrong expectation). Tell Bob to run only the target test file while iterating.
- Screenshots (required evidence, only for tasks Bob ran): after each Bob run, remind the user in chat with the task number, prompt title and `task_id` (Bob IDE → Tasks → All → open the task → click its header). The user drops the PNG into `../shots/`; view it, check task id and that no secrets are visible, move it to `bob_sessions/kairos_taskNN_<desc>.png` (glob the filename: macOS uses a special space), add/link its row in `bob_sessions/README.md`, commit. Next Bob task number: 06. Tell the user not to press "Continue Task" on capped tasks.
- Everything in the repo is English (judges). Chat with the user in Russian.
- Bob CLI flag is `--mode`, not `--chat-mode`.
- `pnpm test` must stay green at every commit, so tests + implementation land together. Before committing run root `pnpm lint` (tsc + prettier), not only `tsc`.

## Read first
`CLAUDE.md`, this file, the current task file in `docs/tasks/`, `PLAN.md` (statuses). `SPEC.md` only the sections the task needs (§6 architecture). Past task files only when touching that module.
- Every task: create/update its `docs/tasks/TNN-*.md` (spec, decisions, problems, result); keep `SPEC.md` for the stable product picture.

## Last check
Real `kairos check` on the demo (Bob task 04): 4 findings for A/B/C, exit 1, 0.091 Bobcoins; control (task 05) clean. Sample: `demo/sample-report.md`.
