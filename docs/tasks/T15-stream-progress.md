# T15 Live Bob progress
Status: [x] done · Owner: Claude Code · Commits: see `git log --grep T15`

## Goal
While Bob works (20–60 s per check or fix) the terminal showed nothing, which looked frozen in the demo video. Show what Bob is doing, live.

## Spec
- `BobEngine` runs `bob run --format stream-json` and reads stdout line by line (`Exec` gets an `onLine` callback).
- `parseBobOutput` accepts both formats: `json` has `result.last_message`; `stream-json` has no `last_message`, so the reply is assembled from assistant `message` chunks after the last `tool_use`.
- `engine/progress.ts`: `describeTool` (`reading src/pricing.ts`, `running pnpm test`, `searching test/**/*.ts`) and `ttyProgress`, a one-line spinner on stderr: `⠹ IBM Bob · reading src/pricing.ts · 6 tool calls · 8s`, cleared when Bob finishes.
- Only on a TTY and only with the real exec: CI, hooks and tests stay silent. `progress: false` or a custom sink overrides it.

## Decisions
- Done in branch `feature/stream-progress` after the submission, merged before the deadline.
- Stream event format taken from a real probe (Bob task 16), not guessed.

## Result
- 167 tests green (new: stream parsing, progress sink, `describeTool`, `ttyProgress`).
- Live check in a pseudo-terminal (Bob task 17, 0.098 Bobcoins): 8 tool calls shown as they happened (README, SPEC, openapi.yaml, tests, config, routes, store), same report as before.
