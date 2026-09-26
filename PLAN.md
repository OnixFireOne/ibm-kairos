# Kairos — 48h Plan

Start: **Fri Sep 25, 20:00 Astana** (15:00 UTC) · Deadline: **Sun Sep 27, 20:00 Astana** (15:00 UTC).
Internal target: **submit by Sun 17:00** (3h buffer).

Roles: **Claude Code / Codex** write the bulk of the code. **IBM Bob** is the product's runtime engine, and it's also used for selected dev tasks (with sessions exported). **Me**: decisions, Bob runs, demo, video.

## Timeline

| When (Astana) | Block | Output |
|---|---|---|
| Fri 20:00–22:00 | **Setup + spike** | Invite email "ibm-hackathon-xxxx" accepted (check spam), Enterprise membership confirmed, Bob IDE signed in with instance **"ibm-coding-challenge-uat (us-east)"** (otherwise personal Bobcoins get spent!), Bob Shell installed (same login), `bob run "hello"` works, `--format json` output inspected, Bobcoin cost per run noted, `kairos` mode loads (`/kairos`). Repo created (public), skeleton pushed. Guidelines/tracks re-read. |
| Fri 22:00–Sat 03:00 | **Core CLI (T1–T6)** | collector, context builder, engines (mock + bob), schema, markdown report, `check` command, unit tests on mock. |
| Sat 03:00–10:00 | Sleep | — |
| Sat 10:00–14:00 | **Demo repo + real Bob tuning (T7–T8)** | `demo/orders-api` + drift scripts A/B/C + control commit. Prompt/mode tuned until A/B/C are found with no false positives. Fixtures recorded. |
| Sat 14:00–17:00 | **Fix flow (T9)** | `kairos fix`, `kairos-fix` mode, decisions logged. |
| Sat 17:00–21:00 | **Living docs + handoff (T13–T14)** | `docs/kairos/` scaffold + pointers, `kairos-dev` mode, post-commit progress hook, `kairos handoff`, docs-freshness checks, `kairos session` budget → "start a new chat". The "new chat says continue" test. |
| Sat 21:00–24:00 | **Integrations + polish (T10–T11)** | pre-push hook, GitHub Action (mock/dry + local real), HTML timeline, README. |
| Sun 09:00–13:00 | **E2E rehearsal + assets (T12)** | Clean run of the full scenario, screenshots, video recorded (3–5 min), slides, cover image. |
| Sun 13:00–17:00 | **Submission** | `bob_sessions/` screenshots complete, repo checked for secrets, lablab form filled, submitted. |
| Sun 17:00–20:00 | Buffer | Fixes only. No new features. |

## Bobcoin budget (40 confirmed, no top-ups)
| Use | Est. |
|---|---|
| Spike / learning the CLI | 3 |
| Prompt/mode tuning on the demo (≈8 runs) | 12 |
| Fix flow tuning (≈4 runs) | 6 |
| kairos-dev + handoff runs (≈3) | 4 |
| Dev tasks in Bob IDE (docs, tests, review; exported) | 8 |
| Final demo recording runs | 6 |
| Reserve | 1 |
Rule: **always develop against `MockEngine`**. Real Bob only when intentionally testing the prompt. Use cache.

## Habit during the whole hackathon
After each Bob task, screenshot its consumption summary into `bob_sessions/` right away, using the naming above. Keep a list of the tasks in `bob_sessions/README.md` (task no., what it did, Bobcoins).

## Tasks for Claude Code / Codex

Status: `[x]` done, `[~]` in progress, `[ ]` todo. Current state and next step: [HANDOFF.md](HANDOFF.md). Each task gets its own file in [docs/tasks/](docs/tasks/README.md) (spec, decisions, problems, result) when work on it starts.

Who does what (agreed on day 1): Claude Code writes contracts, fixtures and red tests; IBM Bob implements well-bounded modules against them via `scripts/bob-task.sh` (T2, T3, later T8, T9, T13, T14); Claude Code reviews, fixes and commits. Claude Code keeps product-critical glue (prompt renderer, engines, CLI commands).

Each task: small PR/commit, tests green, no secrets.

- [x] **T0 Scaffold.** [→ task file](docs/tasks/T00-scaffold.md) pnpm workspace, `packages/cli` (TS, Node 20, commander, zod, execa, fast-glob, yaml, vitest), `bin: kairos`, lint/format, `pnpm test`, `.gitignore` (`.kairos/cache`, `.env`). Copy `.bob/custom_modes.yaml` from SPEC §6.6.
- [x] **T1 Config.** [→ task file](docs/tasks/T01-config.md) `.kairos/config.yaml` loader with zod + defaults (SPEC §7). `kairos init` writes the config + the mode file if missing.
- [x] **T2 Collector.** [→ task file](docs/tasks/T02-diff-collector.md) `getDiff(base)` → files, hunks with line numbers, changed symbols (regex: function/const/class names, `app.(get|post|put|delete)('route')`, `process.env.X`). Tests on fixture diffs.
- [x] **T3 Context builder.** [→ task file](docs/tasks/T03-context-builder.md) Glob the intent sources, split markdown by headings, select sections by `map` and symbol grep, attach line numbers, enforce `maxContextChars`. Build the prompt (task + diff + excerpts + JSON schema). Snapshot tests.
- [x] **T4 Schema + parser.** [→ task file](docs/tasks/T04-report-schema.md) zod `DriftReport`/`Finding` (SPEC §6.4). Extract JSON from the engine text (fenced or raw), validate, one repair retry through the engine.
- [x] **T5 Engines.** [→ task file](docs/tasks/T05-engines.md) `MockEngine` (fixtures by prompt hash, with a fallback fixture). `BobEngine`: spawn `bob run --mode kairos --format json --max-cost --max-turns`, prompt via stdin, parse the final message, save the raw output to `.kairos/runs/<ts>-check.json`. Cache in `.kairos/cache/<sha>.json`. Timeouts + clear error if `bob` is not installed.
- [x] **T6 `check` command + Markdown reporter.** [→ task file](docs/tasks/T06-check-command.md) Print a summary table, write `.kairos/history/<runId>.json` + `kairos-report.md`, exit 1 if `severity >= failOn`. Flags: `--base`, `--engine`, `--json`, `--no-cache`.
- [x] **T7 Demo repo.** [→ task file](docs/tasks/T07-demo-repo.md) `demo/orders-api`: Express+TS, `POST/GET /orders`, pricing with a discount rule, `docs/SPEC.md` (Pricing, Orders, Config sections), `openapi.yaml`, `README.md` (env vars), vitest tests. `scripts/drift-a.sh`, `drift-b.sh`, `drift-c.sh`, `control.sh`, `reset.sh` (git-based, repeatable).
- [x] **T8 Prompt tuning (me + Bob).** [→ task file](docs/tasks/T08-prompt-tuning.md) Iterate on the mode instructions/prompt until A, B and C are found and control is clean. Record the outputs as fixtures for MockEngine.
- [~] **T9 Fix flow.** [→ task file](docs/tasks/T09-fix-flow.md) `kairos fix --id <ID> [--truth intent|code] [--allow-code] [--yes]` → `bob run --mode kairos-fix`, shows the git diff, confirm, re-runs `check` scoped to that finding.
- [ ] **T10 Integrations.** `kairos hook install` (pre-push). `action.yml` (composite: setup node, `pnpm dlx kairos check --engine ${{ inputs.engine }}`, post/update a PR comment via `gh`). Example workflow in `demo/.github/workflows/kairos.yml`.
- [ ] **T11 HTML timeline.** `kairos report --html` → single-file `kairos-timeline.html` from `.kairos/history`: runs over time, findings opened/resolved, severity colours, logo.
- [ ] **T13 Living docs scaffold.** `kairos init` creates `docs/kairos/{SPEC,PLAN,PROGRESS,DECISIONS,HANDOFF}.md` + `docs/kairos/tasks/README.md` (per-task file format) from templates, plus pointer blocks (between `<!-- kairos:start/end -->` markers) in `CLAUDE.md` and `AGENTS.md`, plus the `kairos-dev` mode in `.bob/custom_modes.yaml`. `post-commit` hook → `PROGRESS.md` entry (hash, message, files). `kairos fix` appends to `DECISIONS.md`. Tests.
- [ ] **T14 Handoff + freshness.** `kairos handoff` (git log since the last handoff + PLAN status + the last report → Bob drafts `HANDOFF.md` by template; mock for tests). Docs-freshness candidates in `check` (SPEC §6.2.1). `kairos session "<task>"` wraps `bob run --mode kairos-dev --format json`, sums turns/cost per session in `.kairos/session.json`, and runs a handoff with the "start a new chat" message over the threshold. Recommend a new chat only when needed (area switch with a clean tree, or over budget), never after every task.
- [ ] **T12 Submission assets.** README (pitch, GIF/screenshots, quickstart, "How Kairos uses IBM Bob" section, architecture diagram), `docs/slides.md`, video script, cover 16:9.

## Video script (≈3 min)
1. (20s) Problem: code drifts from intent; nobody notices until it hurts.
2. (20s) Kairos in one sentence + logo.
3. (90s) Live: three commits → `kairos check` → report (A/B/C) → `kairos fix` B and C → A with "intent is truth" → green check → PR comment → timeline.
3b. (30s) Continuity: Bob in `kairos-dev` builds a task and the docs update themselves → "good moment to start a new chat" → a new session (Bob, then Claude Code) with just "continue" picks up the next step.
4. (30s) How Bob powers it: custom modes, Bob Shell headless, `--max-cost`, subagents, whole-repo understanding, and the measured gains (the metrics table).
5. (20s) What's next: IDE-native nudges at the moment of edit, more languages, org-wide drift dashboard.

## Submission checklist
- [ ] Public GitHub repo, MIT license, README complete.
- [ ] `bob_sessions/`: a PNG screenshot of **every** Bob task's consumption summary (Bob IDE → Tasks → open task → header), named `kairos_taskXX_description.png`. **Take them as you go**, not at the end. No API keys or credentials anywhere.
- [ ] Metrics table (SPEC §2.2) filled with real numbers from the demo, in the README and slides.
- [ ] Video (YouTube/Loom, public or unlisted).
- [ ] Slides (PDF).
- [ ] Cover image + logo.
- [ ] Short and long descriptions (reuse `brand/team_description.md`).
- [ ] Technologies tagged: IBM Bob, Bob Shell (+ watsonx.ai if used).
