# Handoff

Updated: 2026-09-26 ~22:00 Astana, T10 done (hook, Action, CI green on GitHub). Deadline: Sun Sep 27 15:00 UTC (submit by 17:00 Astana).

## State
- Done: T0–T10, T13, T14 (details: `PLAN.md` and `docs/tasks/`). Last: T10 integrations (`kairos hook install`, `action.yml`, CI runs the Action on the demo; see `docs/tasks/T10-integrations.md`).
- 150 tests green, lint clean, CI green on GitHub, pushed to `main` on github.com/OnixFireOne/ibm-kairos.
- Bobcoins spent: 4.85 / 40 (details: `bob_sessions/README.md`).

## In progress
Nothing. Screenshots of Bob tasks 06–13 are pending from the user (ids in `bob_sessions/README.md`, rows marked `pending`).

## Next step
1. When the user drops the screenshots for tasks 06–13 into `../shots/`: rename, link in `bob_sessions/README.md`, commit.
2. T11 HTML timeline (`kairos report --html`), then T12 assets. For the video: a real PR on a pushed copy of the demo to show the Action's PR comment (not exercised yet).

## Gotchas
- Delegate sizable implementation to Codex only when cheaper than doing it in Claude (see `CLAUDE.md` rules): Claude Code writes contract + red tests, Codex makes them green, Claude reviews and commits. Run it directly: `zsh -ic 'codex exec -s workspace-write "<prompt>"'` (no bridge needed; Codex 0.155 verified).
- When suggesting a new chat, give a first message naming the next task (e.g. «Продолжай T6: команда check + отчёт») so the chat title is meaningful.
- Never run real `bob` unless asked. Run Bob tasks with `zsh -ic 'scripts/bob-task.sh <taskNN-name> <prompt-file> [mode] [maxCost] [maxTurns]'` (the key lives in `~/.zshrc`; plain shells don't see it). Never print/commit the key.
- Bob works tests-first: Claude writes contract + fixtures + red tests, Bob implements. Double-check every expected value against fixtures first (task 03 burnt 2.08 on a wrong expectation). Tell Bob to run only the target test file while iterating.
- Screenshots (required evidence, only for tasks Bob ran): after each Bob run, remind the user in chat with the task number, prompt title and `task_id` (Bob IDE → Tasks → All → open the task → click its header). The user drops the PNG into `../shots/`; view it, check task id and that no secrets are visible, move it to `bob_sessions/kairos_taskNN_<desc>.png` (glob the filename: macOS uses a special space), add/link its row in `bob_sessions/README.md`, commit. Next Bob task number: 14. Tell the user not to press "Continue Task" on capped tasks. Runs made by `kairos check`/`fix` on the demo appear in Bob IDE under the `orders-api` workspace, not `ibm-kairos`.
- Everything in the repo is English (judges). Chat with the user in Russian.
- Bob CLI flag is `--mode`, not `--chat-mode`.
- Never run `demo/scripts/reset.sh` before copying `demo/.work/orders-api/.kairos/runs/` of real runs into `bob_sessions/cli/` (reset deletes them; Bob Shell's own logs in `~/.bob/logs/shell/` are the backup).
- `gh` is not installed locally; check CI via `curl https://api.github.com/repos/OnixFireOne/ibm-kairos/actions/runs?per_page=1`.
- Run prettier from the repo root only (from `packages/cli` it misses `.prettierignore` and rewrites `.md` snapshots).
- `pnpm test` must stay green at every commit, so tests + implementation land together. Before committing run root `pnpm lint` (tsc + prettier), not only `tsc`.

## Read first
`CLAUDE.md`, this file, the current task file in `docs/tasks/`, `PLAN.md` (statuses). `SPEC.md` only the sections the task needs (§6 architecture). Past task files only when touching that module.
- Every task: create/update its `docs/tasks/TNN-*.md` (spec, decisions, problems, result); keep `SPEC.md` for the stable product picture.

## Last check
Real `kairos check` on the demo (Bob task 04): 4 findings for A/B/C, exit 1, 0.091 Bobcoins; control (task 05) clean. Sample: `demo/sample-report.md`.
