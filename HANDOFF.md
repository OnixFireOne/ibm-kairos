# Handoff

Updated: 2026-09-26 ~14:30 Astana, after T4. Deadline: Sun Sep 27 15:00 UTC (submit by 17:00 Astana).

## State
- Done: T0 scaffold, T1 config + `kairos init`, T2 diff collector (Bob), T3 context selection (Bob) + prompt renderer, T4 report schema + reply parser. 65 tests green, lint clean, all pushed to `main` on github.com/OnixFireOne/ibm-kairos.
- Bobcoins spent: 3.61 / 40 (details: `bob_sessions/README.md`).

## In progress
Nothing. Working tree clean.

## Next step
T5 Engines (Claude Code does it, no Bob): `packages/cli/src/engine/{types,mock,bob,cache}.ts` + tests.
- `Engine.analyze(prompt, opts) → { text, costBobcoins?, taskId?, raw }`.
- BobEngine: `bob run --mode kairos --format json --max-cost N --max-turns N`, prompt via stdin (execa). Parse JSON lines (see SPEC §6.3 "Verified Bob Shell 2.0.5 facts"): an `error` line = failure (e.g. cost cap); take `last_message` + `stats.session_costs`. Save raw to `.kairos/runs/<ts>-check.json`. Clear errors for ENOENT (bob not installed) and missing `BOB_API_KEY`. Timeout.
- MockEngine: fixture by sha256(prompt) in `fixtures/`, fallback fixture.
- Cache `.kairos/cache/<sha256>.json`.
- Also wire the repair callback of `parseWithRepair` to the engine.
Then T6 `check` + Markdown reporter, T7 demo repo.

## Gotchas
- Never run real `bob` unless asked. Run Bob tasks with `zsh -ic 'scripts/bob-task.sh <taskNN-name> <prompt-file> [mode] [maxCost] [maxTurns]'` (the key lives in `~/.zshrc`; plain shells don't see it). Never print/commit the key.
- Bob works tests-first: Claude writes contract + fixtures + red tests, Bob implements. Double-check every expected value against fixtures first (task 03 burnt 2.08 on a wrong expectation). Tell Bob to run only the target test file while iterating.
- After each Bob task: the user drops the Bob IDE task-summary screenshot into `../shots/`; move it to `bob_sessions/kairos_taskNN_<desc>.png`, link it in `bob_sessions/README.md`, commit. Don't press "Continue Task" on capped tasks.
- Everything in the repo is English (judges). Chat with the user in Russian.
- Bob CLI flag is `--mode`, not `--chat-mode`.
- `pnpm test` must stay green at every commit, so tests + implementation land together.

## Read first
`CLAUDE.md`, this file, `PLAN.md` (statuses), `SPEC.md` §6 (architecture, verified Bob facts), `bob_sessions/README.md`.

## Last check
No `kairos check` run yet (T6).
