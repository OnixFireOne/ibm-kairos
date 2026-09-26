# T01 Config + init
Status: [x] · Owner: Claude Code · Commits: 8a8add0

## Goal
Load `.kairos/config.yaml` with defaults; `kairos init` writes config + Bob modes.

## Spec
`config/schema.ts` (zod, SPEC §7 defaults), `config/load.ts` (`parseConfig`, `loadConfig`, `ConfigError` with field paths), `commands/init.ts` (`initProject(cwd, {force})`, never overwrites without `--force`), `templates/{config,bob-modes}.ts`.

## Decisions
- Added `minConfidence: 0.6` (the risk table already assumed a threshold).
- Nested `budget` uses `.prefault({})` (zod 4) so partial budgets get defaults.
- The Bob modes template is tested to equal `.bob/custom_modes.yaml` byte for byte.

## Result
Tests in `test/config.test.ts`, `test/init.test.ts`. T13 extends `init` with `docs/kairos/`.
