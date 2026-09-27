# T10 Integrations
Status: [x] done · Owner: Claude Code · Commits: see `git log --grep T10`

## Goal
Run `kairos check` where drift should be caught without anyone remembering to: before `git push` and on every pull request (report as a PR comment).

## Spec
- **`kairos hook install [--engine bob|mock] [--force]` / `kairos hook uninstall`** (`src/commands/hook.ts`): writes `pre-push` at `git rev-parse --git-path hooks/pre-push` (worktrees, `core.hooksPath`). The hook runs `node <dist/index.js> check [--engine]` (falls back to `kairos` on PATH). Exit 1 (drift at or above `failOn`) blocks the push; any other non-zero (no kairos, no Bob, bad config) only warns and lets the push through. Skip once with `git push --no-verify`. A hook without the `# kairos:pre-push` marker is never replaced (unless `--force`) or removed.
- **`action.yml`** (composite, repo root): setup-node 24 → `npm i -g pnpm@12.6.0` → install + build Kairos from `github.action_path` (the package is not on npm) → `kairos check --engine <engine>` in `working-directory`, base = input, else `origin/$GITHUB_BASE_REF` on PRs (fetched), else config `base` → report appended to the job summary → on PRs one comment (marker `<!-- kairos-report -->`) created or updated via `gh api` → fail on exit 1 if `fail-on-drift`, always on exit 2. Inputs: `engine` (default `mock`), `base`, `working-directory`, `comment`, `fail-on-drift`, `github-token`, `bob-api-key`. Outputs: `exit-code`, `report`.
- **Workflows**: `.github/workflows/ci.yml` in this repo (lint + tests; `action-demo` job runs `uses: ./` on the demo with drifts A/B/C and the mock engine, expects exit code 1). `demo/orders-api/.github/workflows/kairos.yml`: the example a user copies (`uses: OnixFireOne/ibm-kairos@main`, `fetch-depth: 0`, `pull-requests: write`).

## Decisions
- **Tool failure never blocks a push**: only real drift (exit 1) does. A missing `bob` or key must not lock the user out.
- **Engine baked into the hook** (`--engine mock` for demos) instead of an env var: visible in the hook file.
- **The Action builds Kairos from its own checkout** instead of `pnpm dlx kairos`: the package is not published, and `kairos` on npm is someone else's name.
- **Action defaults to `engine: mock`** (SPEC §9: headless Bob in CI needs `BOB_API_KEY` and Bob Shell installed). Real Bob: install Bob Shell in an earlier step, `engine: bob`, `bob-api-key: ${{ secrets.BOB_API_KEY }}`.
- **`fetch-depth: 0` required**: the collector diffs `base...HEAD` (merge base).
- **Demo workflow lives in `demo/orders-api/.github/`** (the demo repo root), not `demo/.github/`: `reset.sh` copies it into the demo repo baseline. The demo fixtures still match (the workflow is neither in the diff nor in the intent globs).

## Problems
- First real PR (`OnixFireOne/kairos-demo-orders-api`, T12): the comment was posted, but the mock found no fixture. The prompt contained the base ref, `main` locally vs `origin/main` on a PR, so its hash differed. The prompt now drops the `origin/` prefix (test in `prompt.test.ts`); fixtures and the Bob cache match in both places. Also: Actions were disabled on that new repo until enabled in its Actions tab.
- YAML plain scalars with `: ` inside backticks (`engine: bob`) are parse errors; quoted the descriptions.

## Result
- `test/hook.test.ts` (8 tests): hook content, install/idempotent/update, foreign hook kept, uninstall, no git repo, and the installed hook run with `sh` against a fake kairos (exit 0 → push, 1 → blocked, 2 → warn + push). 150 tests green, lint clean.
- Smoke on the demo (built CLI, mock): `hook install --engine mock`, drifts A/B/C, `git push` to a local bare remote → 4 findings, "push blocked", exit 1; `hook uninstall` removes it.
- GitHub CI run 36256696762 on `8e6f421`: `test` and `action-demo` green (the Action built Kairos, found drift on the demo, exit-code 1). PR comment verified on a real PR (T12): https://github.com/OnixFireOne/kairos-demo-orders-api/pull/2, run 36307903183 and the re-run after the base fix: one comment created, then updated in place with 4 findings; check red (drift blocks the merge).
