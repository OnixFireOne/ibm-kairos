# T07 Demo repo
Status: [x] · Owner: Claude Code · Commits: see `git log --grep T7`

## Goal
A small, realistic repo with intent docs and repeatable drift commits A/B/C + a control commit (SPEC §4), for prompt tuning (T8), the video and tests.

## Spec
- `demo/orders-api/`: baseline source. Express 5 + TS, `POST /orders`, `GET /orders/:id`, pricing (10% off above $100), in-memory store, `process.env.DB_URL`/`PORT`. Intent: `docs/SPEC.md` (Pricing, Orders, Config), `openapi.yaml`, `README.md` (env table). 5 vitest tests (HTTP via `fetch`, no supertest). `.kairos/config.yaml` (base `main`, `map` per module, engine bob), own `pnpm-workspace.yaml` + `pnpm-lock.yaml`.
- `demo/scripts/`: `reset.sh [--install]` copies the baseline into a fresh git repo (`demo/.work/orders-api` or `$KAIROS_DEMO_DIR`), copies `.bob/custom_modes.yaml` from the Kairos root, commits on `main`, checks out `feature/orders-update`. `drift-a/b/c.sh`, `control.sh` each make one commit via literal replacements (`_lib.sh` `replace` fails loudly if the baseline changed).
- `packages/cli/test/demo.test.ts`: runs the scripts into a temp dir; checks changed files, symbols (`DISCOUNT_RATE`, `DELETE /orders/:id`, `DATABASE_URL` added / `DB_URL` removed) and selected intent (SPEC Pricing/Orders/Config, openapi, README); control touches only the SPEC and passes `check` on mock.

## Decisions
- The demo repo is generated, not nested: a clean standalone git repo per run (no submodule, repeatable, the video shows a normal repo).
- Drift A updates the tests too: tests stay green but the SPEC is violated, which is the point (tests can't catch intent drift).
- B is framed as undocumented, not forbidden: the SPEC rule it breaks is "every endpoint is in openapi.yaml and covered by a test", so the fix is docs + test (SPEC §4 step 4). No "orders are immutable" rule, which would make it a SPEC_VIOLATION instead.
- The demo reads `process.env.X` directly, so the collector's env regex sees the rename.
- The lockfile is part of the baseline and install uses `--frozen-lockfile`: otherwise it lands in the first drift commit (a 1.6k-line diff).
- Base is `main` in the demo config (PR-style branch), not `origin/main`.

## Problems
- pnpm 12 blocks esbuild's build script by default (`ERR_PNPM_IGNORED_BUILDS`) → `allowBuilds` in the demo's `pnpm-workspace.yaml`.
- Found while wiring: prettier was not run for T6 (only `tsc`); formatted T5/T6 files in this commit. Root `pnpm lint` runs prettier too.
- Kairos does not skip lockfiles/generated files in the diff; worth a default exclude later if time allows.

## Result
Scenario verified end to end: reset + A/B/C → 6 files, +18/−6; demo tests 5/5 green and `tsc` clean after all drifts; prompt 10.8k chars, nothing omitted. 88 Kairos tests green, lint + prettier clean. No Bobcoins spent. Next: T8 runs real Bob on it.
