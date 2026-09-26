# CLAUDE.md — Kairos

Hackathon project (IBM Bob 2.0, lablab.ai). Deadline: **Sun Sep 27, 2026 15:00 UTC**. Solo dev.

Before doing anything read `HANDOFF.md` (current state, next step, gotchas), then `SPEC.md` (what/why/architecture) and `PLAN.md` (tasks with statuses). After each task update `PLAN.md` statuses and `HANDOFF.md`.

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
