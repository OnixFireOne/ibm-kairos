# Kairos — Product Spec (IBM Bob 2.0 Hackathon)

> **Catch the moment code drifts from intent.**
> Team Kairos (solo) · lablab.ai IBM Bob 2.0 Hackathon · Sep 25–27, 2026

## 1. Problem

Code changes every day, but the documents that describe what the code *should* do rarely keep up: specs, ADRs, API contracts, READMEs, tests. The gap between intent and implementation grows silently until it causes an incident, a failed onboarding or a wrong decision. Linters check syntax and tests check behaviour someone remembered to write. Nothing checks that **the change still matches the intent**.

## 2. Solution

Kairos is a **spec-driven continuity and intent-drift guardian built on IBM Bob**. On every change (a local commit, pre-push or pull request) it:

1. Takes the diff.
2. Collects the relevant **intent sources**: specs, ADRs, README, OpenAPI and tests.
3. Asks Bob, running in a dedicated **`kairos` custom mode**, to compare implementation vs. intent.
4. Produces a **Drift Report**: every place where code and intent diverged, with evidence (file:line on both sides), severity and a proposed resolution.
5. On request, uses Bob to **prepare the fix**: update the spec or doc, add the missing test, or flag the code as violating the spec.

Key principle: **Kairos does not assume the code is right.** For each drift it asks which side is the source of truth (intent or implementation) and proposes the fix on the other side.

### 2.1 Living docs + session handoff (spec-driven continuity)

The way I already work with AI: the project keeps a `docs/` folder that the model **maintains by itself** while it develops. It holds the spec, the plan, a log of changes and decisions, and a handoff note. Any model (Bob, Claude, Codex) can read these files and continue the work. There's no need to export a chat, and nothing gets lost. When a session gets heavy, the model **suggests starting a new chat on its own** and writes the handoff first. Kairos turns this workflow into a Bob-native tool.

**Kairos docs** (`docs/kairos/`, created by `kairos init`):
| File | What it holds | Who writes it |
|---|---|---|
| `SPEC.md` | intent: what and why, rules, constraints | human + Bob (`kairos spec init` can draft it from code) |
| `PLAN.md` | tasks with status `[ ] [~] [x]` | Bob updates it as tasks complete |
| `PROGRESS.md` | append-only dev log: date, what changed, files, why | Bob after each task + a `post-commit` hook (deterministic) |
| `DECISIONS.md` | decisions and trade-offs, including drift resolutions from `kairos fix` | Bob / `kairos fix` |
| `HANDOFF.md` | snapshot for the next session: state, in-progress item, next step, gotchas, files to read first | Bob at the end of a session or on a "new chat" recommendation |

**How any model picks it up automatically:** `kairos init` adds a short pointer ("Before any work read `docs/kairos/HANDOFF.md`, then `SPEC.md` and `PLAN.md`. After each task update `PLAN`/`PROGRESS`.") where each agent looks by default:
- **Bob:** the `kairos-dev` custom mode's instructions (and `.bob/rules/`, if supported).
- **Claude Code:** `CLAUDE.md`. **Codex and others:** `AGENTS.md`.

A new chat with any of them starts with "continue" and nothing else.

**Kairos = the right moment:**
1. **The right moment to write things down.** In `kairos-dev` mode, Bob updates `PLAN`/`PROGRESS`/`DECISIONS` right after each task, while the context is fresh.
2. **The right moment to start a new chat.** Bob recommends a new session when a milestone is done or the session passes a budget (turns or Bobcoins, taken from Bob Shell `--format json` stats via `kairos session`). Before recommending, it writes `HANDOFF.md`, so the reset costs nothing.
3. **The right moment to catch drift.** `kairos check` verifies that the code still matches `SPEC.md`/contracts/tests, and also that the docs were updated (for example, code changed but `PROGRESS.md` or `PLAN.md` didn't → `STALE_DOC`).

This closes the loop: **spec → plan → work (docs auto-updated) → handoff → new session continues → drift check keeps code and docs honest.**

## 2.2 Fit with the official challenge
Guide theme: *"Build with purpose using IBM Bob 2.0"*. The ask is a functional prototype that improves a developer workflow (onboarding, debugging, code review, testing, maintenance, deployment) where "time, effort, or errors are too high today", with **measurable productivity gains**, using Bob 2.0 features such as Agent mode, parallel tasks, subagents and document understanding.

Kairos targets **code review + maintenance + onboarding**, and the demo measures:
| Metric | How it's measured in the demo |
|---|---|
| Drift caught before merge | 3/3 seeded drifts found, 0 false positives on the control commit |
| Time to resolve a drift | manual (stopwatch, docs + test by hand) vs `kairos fix` |
| Docs kept current | PLAN/PROGRESS/DECISIONS entries written automatically per task (count) |
| Session restart cost | context the new session needs: HANDOFF (≤3k chars) vs re-reading repo + chat; turns to resume |
| Bobcoins per check | from the Bob task consumption summary + cache hits at 0 |

## 3. Why IBM Bob is the core (eligibility)

- The analysis engine *is* Bob: `bob run --mode kairos --format json`.
- Kairos ships a **Bob custom mode** (`.bob/custom_modes.yaml`) usable interactively in Bob IDE (`/kairos`) and headless via Bob Shell.
- Bob's whole-repo understanding is what makes the check possible: it reads the code around the diff, not just the diff.
- Cost control relies on Bob Shell features: `--max-cost`, `--max-turns`.
- **Bob 2.0 features used:** custom modes (`kairos`, `kairos-fix`, `kairos-dev`); **subagents** (`check` fans out one subagent per intent area/finding type in isolated contexts, then merges); **document understanding** (specs, ADRs, OpenAPI as input); **Agent mode** for fixes; optionally packaged as a **Bob Skill** (`kairos` skill = instructions + templates) so it works in any mode.
- **Evidence (required by the guide):** `bob_sessions/` holds **PNG screenshots of Bob IDE task consumption summaries**, named `kairos_taskXX_description.png`. Raw CLI outputs go to `.kairos/runs/` (not required, kept for debugging).

## 4. Users and core scenario

**User:** a developer or tech lead on a repo with specs/docs (spec-driven teams, API teams, regulated code).

**Demo scenario (the story for the video):**
1. The `demo/orders-api` repo has `docs/SPEC.md` (business rules), `openapi.yaml`, `README.md` and tests.
2. The developer makes three commits:
   - **A. Spec violation:** the discount rule changes in code (10% → 15% above $100), but the SPEC still says 10%.
   - **B. Undocumented behaviour:** a new endpoint `DELETE /orders/:id` is added, with no OpenAPI entry and no test.
   - **C. Stale doc:** an env var is renamed (`DB_URL` → `DATABASE_URL`), and the README is outdated.
3. `kairos check` → the report finds all 3 and exits non-zero (blocks the push/PR).
4. `kairos fix --id B` → Bob adds the OpenAPI entry and a test. `kairos fix --id C` → Bob updates the README.
5. For A, the developer chooses "intent is truth" → Kairos marks the code as violating the spec and proposes a code patch.
6. The PR comment and the HTML timeline show the "Kairos moments": when drift appeared and when it was resolved.
7. **Continuity moment:** a feature is built in Bob's `kairos-dev` mode, and `PLAN`/`PROGRESS`/`DECISIONS` update by themselves as it goes. At the milestone, Bob writes `HANDOFF.md` and says "good moment to start a new chat". A *new* session (Bob, or even Claude Code or Codex) gets only "continue", picks up the exact next step from `HANDOFF.md`, and respects an earlier decision from `DECISIONS.md`.

## 5. Scope

### MVP (must have, day 1–2)
- `kairos init`: scaffold config + the Bob mode file.
- `kairos check`: diff → context → Bob → Drift Report (JSON + Markdown), with an exit code.
- `kairos fix --id <finding>`: Bob applies the fix for one finding (docs/tests only by default) and appends the decision to `decisions.md`.
- `kairos init` also scaffolds `docs/kairos/` (SPEC, PLAN, PROGRESS, DECISIONS, HANDOFF) and the agent pointers (`CLAUDE.md`, `AGENTS.md`, the Bob mode).
- `kairos-dev` Bob mode: works on tasks and auto-updates the docs; writes `HANDOFF.md` and recommends a new chat at a milestone or over budget.
- `kairos handoff`: generates or refreshes `HANDOFF.md` from the git log + docs + the last report (for sessions that ended abruptly).
- A `post-commit` hook appends commit entries to `PROGRESS.md` (no LLM).
- A `mock` engine with recorded fixtures (tests and offline demo).
- The demo repo with 3 scripted drift commits.
- A `bob_sessions/` folder with PNG screenshots of the Bob task summaries.

### Should have
- A GitHub Action (`action.yml`) that runs `kairos check` on PRs and posts the Markdown report as a comment.
- A git `pre-push` hook installer (`kairos hook install`).
- `kairos report --html`: a static single-file HTML timeline of drift history (`.kairos/history/*.json`).
- `kairos spec init`: Bob drafts a SPEC from code for repos without one.
- `kairos session "<task>"`: wraps `bob run --mode kairos-dev`, tracks cumulative turns/Bobcoins per session, triggers a handoff over the threshold.

### Out of scope
- Multi-repo, SaaS or auth, a web backend, IDE extension packaging, languages beyond a JS/TS demo repo.

## 6. Architecture

```
git diff ──► Collector ──► Context Builder ──► Engine (Bob | Mock) ──► Parser/Validator ──► Reporters
               │                 │                    │                      │              ├─ Markdown (PR comment)
               │                 │            bob run --mode kairos      │              ├─ JSON (.kairos/history)
          changed files   intent sources      --format json --max-cost N     zod schema      └─ HTML timeline
                          (config globs +
                           symbol matching)
```

### 6.1 Collector
- `git diff --unified=5 <base>...HEAD` (default base: `origin/main`, or `HEAD~1` for local).
- Outputs the changed files, hunks and **changed symbols** (function/const/route/env names, extracted with regex; no AST needed for the MVP).

### 6.2 Context Builder (no LLM, cheap and deterministic)
- Intent sources come from config globs (`docs/**/*.md`, `adr/**/*.md`, `openapi.yaml`, `README.md`, `**/*.test.ts`).
- Relevance: an explicit mapping in config (`src/pricing/** → docs/SPEC.md#pricing`) plus a grep for changed symbols in intent files.
- Trims to a token budget (`maxContextChars`, default 60k). Markdown files are sectioned by heading and only matching sections are included.
- Builds the prompt: the task, the diff, relevant intent excerpts with paths and line numbers, and the output JSON schema.
- As implemented (T3): the diff always goes in whole; excerpts get `maxContextChars - diff.length`. Map targets `file#Heading` select the section incl. subsections; bare `file` selects the whole file. Symbol grep uses only "searchable" symbols (env, routes, functions/classes ≥3 chars, consts only if UPPER_CASE or camelCase ≥4 chars); routes match `:param` and `{param}`. Markdown matches select the section; other files a ±10 line window. Overlapping excerpts merge; budget priority: map, then number of matched symbols.

### 6.2.1 Kairos docs as context
- The Context Builder always includes `docs/kairos/SPEC.md` sections matched to the diff, plus `DECISIONS.md` entries touching those areas, so past decisions are respected.
- Docs-freshness rules (deterministic, before calling Bob): the diff touches `src/**` but no `docs/kairos/PROGRESS.md` entry exists since the base → a `STALE_DOC` candidate. A `PLAN.md` task referenced in commits is still `[ ]` → a candidate. Bob confirms or dismisses them.
- `HANDOFF.md` template: `## State` · `## In progress` · `## Next step` · `## Gotchas` · `## Read first` (file list) · `## Last check` (link to the latest report). Kept ≤ 3k chars.

### 6.3 Engine
```ts
interface Engine { analyze(prompt: string, opts: RunOpts): Promise<EngineResult> }
```
- **BobEngine**: spawns `bob run --mode kairos --format json --max-cost <n> --max-turns <n> [--accept-license]`. The prompt goes via stdin. It extracts the final message, parses the JSON block, and saves the raw output to `.kairos/runs/<timestamp>-<cmd>.json`.
- **MockEngine**: returns fixtures from `fixtures/<diff-hash>.json`. Used in tests and in CI when Bob is not available.
- Cache: key = sha256(prompt), stored in `.kairos/cache/`, so a rerun on the same diff costs 0 Bobcoins.
- Verified Bob Shell 2.0.5 facts: headless `bob run` needs `BOB_API_KEY` (SSO login is not used); `--format json` prints one JSON object per line: optional `{"type":"error","message":...}` lines (e.g. cost limit), then `{"type":"result","status","stats":{task_id,session_costs,tool_calls,duration_ms,...},"last_message"}`. Hitting `--max-cost` still ends with `status: "success"` plus the error line, so treat an error line as a failed run. Tasks run by Bob Shell also appear in Bob IDE → Tasks (same machine), which is where screenshots come from.

### 6.4 Drift Report schema (zod)
```ts
Finding {
  id: string                 // "KRS-001"
  type: "SPEC_VIOLATION" | "UNDOCUMENTED_BEHAVIOR" | "STALE_DOC" | "MISSING_TEST" | "ADR_CONFLICT"
  severity: "high" | "medium" | "low"
  title: string
  code:   { file: string, lines: [number, number], excerpt: string }
  intent: { file: string, lines: [number, number], excerpt: string } | null
  explanation: string        // why this is drift
  truth: "intent" | "code" | "ask"   // which side Bob believes is correct
  proposal: { action: "update_code" | "update_spec" | "update_doc" | "add_test", summary: string }
  confidence: number         // 0..1
}
DriftReport { runId, base, head, createdAt, findings: Finding[], summary: string, cost?: { bobcoins?: number } }
```
- Bob replies with `BobReply = { findings, summary }`; Kairos wraps it into `DriftReport` (adds runId/base/head/createdAt/cost). The JSON Schema in the prompt is generated from the zod schema (`bobReplyJsonSchema()`, ~1.8k chars).
- Invalid JSON: one repair retry (a small prompt: "return valid JSON only"), then fail gracefully. JSON is accepted raw, fenced or wrapped in prose; a single line number and a missing `intent` are normalised.

### 6.5 Fix flow
- `kairos fix --id KRS-002 [--truth intent|code]`.
- Runs `bob run --mode kairos-fix` with the finding plus the files. The mode's `edit` group is restricted by `fileRegex` to docs/tests (`\.(md|ya?ml|test\.ts)$`) unless `--allow-code`.
- Then shows `git diff` and asks for confirmation (`--yes` for CI or demo).

### 6.6 Bob custom modes (`.bob/custom_modes.yaml`)
```yaml
customModes:
  - slug: kairos
    name: Kairos — Drift Auditor
    description: Detects drift between code changes and project intent (specs, ADRs, API contracts, docs, tests)
    roleDefinition: >-
      You are Kairos, a meticulous reviewer who checks whether a code change still matches
      the documented intent of the project. You never assume the code is correct.
    whenToUse: Before merging a change, to find where implementation and intent diverged.
    customInstructions: |-
      - Read the diff and the provided intent excerpts; open other repo files if needed.
      - Report ONLY real divergences with concrete evidence (file + line range on both sides).
      - Classify each finding: SPEC_VIOLATION, UNDOCUMENTED_BEHAVIOR, STALE_DOC, MISSING_TEST, ADR_CONFLICT.
      - Decide which side is the source of truth (intent|code|ask) and propose the fix on the other side.
      - Do not modify files in this mode.
      - Final answer: a single JSON object matching the schema given in the prompt, nothing else.
    groups: [read]
  - slug: kairos-dev
    name: Kairos — Spec-driven Developer
    description: Develops against docs/kairos, keeps the docs updated, and hands off at the right moment
    roleDefinition: >-
      You are a spec-driven developer. The source of truth is docs/kairos/. You keep it current
      so that any model can continue your work in a new session without the chat history.
    customInstructions: |-
      - Start: read docs/kairos/HANDOFF.md, then SPEC.md and PLAN.md. Summarise the state in 3 lines.
      - After each completed task: mark it in PLAN.md, append to PROGRESS.md (date, what, files, why),
        record non-obvious choices in DECISIONS.md.
      - If the work contradicts SPEC.md, stop and ask whether to change the code or the spec.
      - When a milestone is done or the session is long (many turns / large context), update HANDOFF.md
        and tell the user: "Good moment to start a new chat. Handoff is in docs/kairos/HANDOFF.md."
    groups: [read, edit, command]
  - slug: kairos-fix
    name: Kairos — Drift Fixer
    description: Applies the proposed resolution for one Kairos finding
    roleDefinition: >-
      You resolve one drift finding with the smallest correct change.
    customInstructions: |-
      - Change only what is needed to resolve the given finding.
      - Keep the style of the surrounding docs/tests. Run the tests if asked.
    groups:
      - read
      - - edit
        - fileRegex: \.(md|ya?ml|json|test\.ts)$
          description: Docs, specs, contracts and tests only
      - command
```
> Verified day 1 by Bob (task 01): `fileRegex` must be a double-quoted string with escaped backslashes, e.g. `"\\.(md|ya?ml|json|test\\.ts)$"`. See `.bob/custom_modes.yaml`.

## 7. Config (`.kairos/config.yaml`)
```yaml
base: origin/main
intent:
  - docs/**/*.md
  - adr/**/*.md
  - openapi.yaml
  - README.md
tests: ["**/*.test.ts"]
map:
  "src/pricing/**": ["docs/SPEC.md#Pricing"]
  "src/routes/**":  ["openapi.yaml"]
failOn: medium          # exit 1 if any finding >= this severity
minConfidence: 0.6      # drop findings below this confidence
budget:
  maxCost: 2            # bobcoins per run
  maxTurns: 8
  maxContextChars: 60000
engine: bob             # bob | mock
```

## 8. Tech stack
- TypeScript, Node 20, pnpm, `commander` (CLI), `zod` (schema), `execa` (git/bob processes), `fast-glob`, `yaml`, `vitest`.
- The HTML report is a single self-contained file (no framework).
- The demo repo: a minimal Express + TS `orders-api` with vitest.

## 9. Repo layout
```
kairos/
  README.md                 # pitch, quickstart, how Bob is used, screenshots
  SPEC.md  PLAN.md  CLAUDE.md
  .bob/custom_modes.yaml
  bob_sessions/             # REQUIRED: PNG screenshots of Bob task summaries; cli/ raw bob run JSON; prompts/
  scripts/bob-task.sh       # dev: run one headless Bob task and keep prompt + JSON evidence
  packages/cli/src/
    index.ts                # commander entry
    commands/{init,check,fix,handoff,session,report,hook,spec}.ts
    config/{schema,load}.ts # zod config + defaults (§7)
    templates/              # config + Bob modes shipped by `kairos init`
    collector/{types,diff}.ts
    docs/{scaffold,handoff,freshness,progress}.ts
    context/{types,glob,sections,intent,select,prompt,builder}.ts
    engine/{types,bob,mock,cache}.ts
    report/{schema,parse,markdown,html}.ts
  packages/cli/test/
  fixtures/                 # mock engine responses
  demo/orders-api/          # demo repo + scripts/drift-{a,b,c}.sh
  action.yml                # GitHub Action
  docs/                     # slides, cover, video script
```

## 10. Acceptance criteria (demo-ready)
- [ ] `kairos check` on the demo repo after the drift commits finds A, B and C with correct types, and each has evidence on both sides where applicable.
- [ ] No false positives on a clean commit (a control commit with a doc typo fix).
- [ ] `kairos fix` resolves B and C, and after it `kairos check` returns clean for them.
- [ ] One full `check` run costs ≤ the budget and a cached rerun costs 0.
- [ ] The Markdown report renders well as a PR comment. The HTML timeline opens offline.
- [ ] `bob_sessions/` holds PNG screenshots of every relevant Bob task summary (`kairos_taskXX_*.png`). No secrets anywhere in the repo.
- [ ] Unit tests pass using `MockEngine` (`pnpm test`).
- [ ] `kairos init` on a bare repo creates `docs/kairos/*` + pointers for Bob, Claude and Codex.
- [ ] In `kairos-dev` mode, completing a task updates PLAN + PROGRESS without being asked.
- [ ] A new session given only "continue" states the correct next step from `HANDOFF.md`.
- [ ] Code changed without a docs update → `check` reports `STALE_DOC`.

## 11. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Limited Bobcoins | Cheap deterministic pre-filtering, `--max-cost`, prompt cache, mock engine for dev/tests. Real Bob only for tuning + demo runs. |
| Bob Shell auth in GitHub CI | Verified day 1: headless `bob run` requires `BOB_API_KEY` (Inference scope) even after SSO login, so CI can use a repo secret. Default the Action to `engine: mock`; real Bob via the secret or a local run/pre-push hook. |
| Non-JSON / unstable output | Strict schema in the prompt, a JSON repair retry, zod validation, low temperature through instructions. |
| False positives | Require evidence on both sides, a confidence threshold (default 0.6), and a control commit in the demo. |
| Time (solo, 48h) | Strict MVP cut. Dashboard and Action are "should", not "must". |

## 12. Open questions (check on the live page / Discord)
- Does Bob load project rules from `.bob/rules/`? (Community tooling references it; verify on day 1.) The `kairos-dev` mode instructions cover it either way.
- Can a Bob IDE mode see its own context size or turn count? If not, the IDE uses "milestone done" as the trigger and the CLI (`kairos session`) uses the JSON stats.
- Judging criteria (not in the guide; the live page says TBA). There's a single theme, no tracks.
- Bobcoins: **40 per participant, confirmed**; no top-ups. Whether Bob Shell has an API key for CI: not in the guide (ask in Discord).
- Video length limit and slide format for the submission.
