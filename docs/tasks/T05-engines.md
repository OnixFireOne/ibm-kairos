# T05 Engines
Status: [ ] · Owner: Claude Code · Commits: —

## Goal
Run the prompt through IBM Bob (real) or fixtures (mock), with cache and cost limits.

## Spec
`packages/cli/src/engine/{types,mock,bob,cache}.ts` + tests (mock `execa`/fixtures; never call real `bob` in tests).
- `Engine.analyze(prompt, opts) → { text, costBobcoins?, taskId?, raw }`.
- BobEngine: `bob run --mode kairos --format json --max-cost N --max-turns N` (budget from config), prompt via stdin, timeout. Save raw output to `.kairos/runs/<ts>-check.json`. Clear errors: `bob` not installed (ENOENT), missing `BOB_API_KEY`, error line in output.
- MockEngine: fixture by sha256(prompt) from `fixtures/`, fallback fixture.
- Cache: `.kairos/cache/<sha256(prompt)>.json`; a cached rerun costs 0.
- Pass the engine as the repair callback of `parseWithRepair` (T04).

## Verified Bob Shell 2.0.5 behaviour
- Headless `bob run` needs `BOB_API_KEY` (Inference scope); the SSO login is not used.
- `--format json` prints one JSON object per line: optional `{"type":"error","severity","message"}` lines (e.g. cost limit), then `{"type":"result","status","stats":{task_id,session_costs,max_cost,tool_calls,duration_ms,...},"last_message"}`.
- Hitting `--max-cost` still ends with `status: "success"` plus an error line → treat an error line as a failed run; `last_message` is then an unfinished intermediate message.
- Tasks run by Bob Shell appear in Bob IDE → Tasks on the same machine (screenshots come from there). Trivial ask ≈ 0.01 Bobcoins.

## Decisions

## Problems

## Result
