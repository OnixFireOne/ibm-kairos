# T05 Engines
Status: [x] · Owner: Claude Code · Commits: see `git log --grep T5`

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
- `Engine.analyze(prompt, { kind })` returns `{ text, costBobcoins?, taskId?, raw, cached? }`; `kind` (`check`/`repair`/`fix`) only names the saved run file.
- `bob` is spawned through an injectable `exec` (default: execa with `reject: false`), so tests never touch the real binary. Args mirror `scripts/bob-task.sh`: `run --trust --mode kairos --format json --max-cost N --max-turns N`, prompt on stdin, default timeout 10 min.
- `BOB_API_KEY` is checked before spawning (no Bobcoins, clear message). ENOENT → "Bob Shell not installed, or use `--engine mock`".
- Raw stdout is saved to `.kairos/runs/<ts>-<kind>.json` before any error is raised, so failed/capped runs keep their evidence and `task_id`.
- Any `{"type":"error"}` line fails the run (`EngineError` carries `taskId`), even with `status: "success"`.
- Only Bob is cached (`CachedEngine`, `.kairos/cache/<sha256(prompt)>.json`, entry tagged with the engine name, corrupt entry = miss, failures not cached). A hit returns `costBobcoins: 0, cached: true`. The mock is free and never cached.
- MockEngine reads `.kairos/fixtures/<sha256(prompt)>.txt`, then `.kairos/fixtures/fallback.txt`, then a built-in empty reply. `.kairos/fixtures/` is committed (T8 records demo replies there via `fixtureName(prompt)`).
- `createEngine(config, { cwd, engine?, noCache?, bob? })` is the factory for T6; `repairWith(engine)` plugs into `parseWithRepair`.

## Problems
None. Real execa ENOENT mapping verified once with a fake binary name (no `bob` run).

## Result
`packages/cli/src/engine/{types,mock,cache,bob,index}.ts`, 13 tests in `test/engine.test.ts`; 78 total green, lint clean. No Bobcoins spent.
