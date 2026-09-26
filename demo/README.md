# Kairos demo: orders-api

`orders-api/` is the baseline of a small Express + TS service with its intent: `docs/SPEC.md`
(Pricing, Orders, Config), `openapi.yaml`, `README.md` (env vars) and vitest tests.
The scripts turn it into a throwaway git repo and add the drift commits from the story.

```bash
demo/scripts/reset.sh --install   # fresh repo: baseline on main, branch feature/orders-update
demo/scripts/drift-a.sh           # A SPEC_VIOLATION: discount 10% -> 15% (test updated, SPEC not)
demo/scripts/drift-b.sh           # B UNDOCUMENTED_BEHAVIOR: DELETE /orders/:id, no OpenAPI entry, no test
demo/scripts/drift-c.sh           # C STALE_DOC: DB_URL -> DATABASE_URL, README and SPEC still say DB_URL
demo/scripts/control.sh           # control: a doc typo fix, must report no drift
```

The repo is created at `demo/.work/orders-api` (gitignored); set `KAIROS_DEMO_DIR` to put it
elsewhere (e.g. a short path for the video). Run `reset.sh` before each scenario. Then, inside it:

```bash
node <kairos>/packages/cli/dist/index.js check            # real IBM Bob (spends Bobcoins)
node <kairos>/packages/cli/dist/index.js check --engine mock
```

Mock replies for the demo live in `orders-api/.kairos/fixtures/` (recorded from real Bob runs in T8).
Then fix a finding (Bob edits docs/tests, you confirm the diff, Kairos commits and re-checks):

```bash
node <kairos>/packages/cli/dist/index.js fix --id KRS-002                  # C: README + SPEC to DATABASE_URL
node <kairos>/packages/cli/dist/index.js fix --id KRS-003 --truth code     # B: document DELETE in SPEC + openapi
node <kairos>/packages/cli/dist/index.js fix --id KRS-002 --engine mock --yes   # offline: applies fixtures/fix-KRS-002.patch
```
