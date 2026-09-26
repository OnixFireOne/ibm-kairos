# CLAUDE.md — Kairos

Hackathon project (IBM Bob 2.0, lablab.ai). Deadline: **Sun Sep 27, 2026 15:00 UTC**. Solo dev.

Before doing anything read `HANDOFF.md` (current state, next step, gotchas), then the current task file in `docs/tasks/`, `PLAN.md` (statuses) and the `SPEC.md` sections you need. Each task keeps its spec, decisions, problems and result in `docs/tasks/TNN-*.md`; after each task update that file, `PLAN.md` and `HANDOFF.md`.

## Rules
- At a milestone or when the session gets long, refresh `HANDOFF.md` (and PLAN/SPEC) and tell the user: "Good moment to start a new chat. Handoff is in HANDOFF.md."
- Everything in the repo is in English (code, comments, docs, commits, Bob prompts): judges are English-speaking.
- IBM Bob is the runtime engine of the product (`bob run --mode kairos --format json`). Never replace it with another LLM.
- Develop and test against `MockEngine`. Don't run real `bob` commands unless explicitly asked: they cost limited Bobcoins.
- Every real `bob run` saves its raw output to `bob_sessions/cli/`. Never delete `bob_sessions/`.
- Never commit secrets (`.env`, API keys, tokens). Check before each commit.
- Keep scope to the MVP in SPEC §5. Ask before adding dependencies beyond SPEC §8.
- TypeScript strict, small modules, vitest for every module; `pnpm test` must stay green.
- Small, focused commits named after the task (e.g. `T2: diff collector`).
- Save Claude Code limits: Claude Code writes the contract, fixtures and red tests, then hands the implementation to Codex (codex-bridge MCP `codex_run`, `sandbox: workspace-write`, cwd = repo), reviews the result, fixes small things and commits (Codex cannot write `.git`). IBM Bob implements only tasks planned for Bob (they need Bob evidence).
