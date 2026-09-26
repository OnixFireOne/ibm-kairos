# T00 Scaffold
Status: [x] · Owner: Claude Code (+ Bob task 01) · Commits: aeec0ab, 37474e9, c5276e3

## Goal
Monorepo skeleton, CLI entry, test/lint setup, Bob custom modes.

## Spec
pnpm workspace, `packages/cli` (TS strict, Node ≥ 20, commander, zod, execa, fast-glob, yaml, vitest), `bin: kairos`, `.bob/custom_modes.yaml` from SPEC §6.6.

## Decisions
- Lint = `tsc --noEmit` + prettier (no eslint, to avoid extra deps). TypeScript 7 needs `"types": ["node"]` in tsconfig.
- `scripts/bob-task.sh` runs headless Bob tasks and keeps prompt (`bob_sessions/prompts/`) + raw JSON (`bob_sessions/cli/`).

## Problems
- `bob run` refused to run with only the SSO login: headless needs `BOB_API_KEY` (see T05 file). Run Bob via `zsh -ic` so `~/.zshrc` is loaded.
- `fileRegex` in custom modes must be a double-quoted string with escaped backslashes (fixed by Bob, task 01, 0.21 Bobcoins).

## Result
Scaffold green; `kairos`, `kairos-dev`, `kairos-fix` modes load in Bob.
