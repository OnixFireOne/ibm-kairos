# AGENTS.md — Kairos

Instructions for any coding agent (IBM Bob, Codex, others). Claude Code reads `CLAUDE.md`, which has the same rules.

Before any work read `HANDOFF.md`, then the current task file in `docs/tasks/`, `PLAN.md` and the `SPEC.md` sections you need. Each task keeps its spec, decisions, problems and result in `docs/tasks/TNN-*.md`; after each task update that file, `PLAN.md` and `HANDOFF.md`.

Rules:
- At a milestone or when the session gets long, refresh `HANDOFF.md` (and PLAN/SPEC) and tell the user: "Good moment to start a new chat. Handoff is in HANDOFF.md."
- Everything in the repo is in English.
- TypeScript strict, ESM (`.js` import suffixes), small modules, vitest for every module. `pnpm test` and `pnpm lint` must pass.
- When given tests as the specification, do not modify the tests or the contract types; make them green.
- No new dependencies beyond SPEC §8 without asking. Never commit secrets.
