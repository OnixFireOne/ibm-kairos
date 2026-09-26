# T13 Living docs scaffold
Status: [x] done · Owner: Claude Code · Commits: see `git log --grep T13`

## Goal
`kairos init` gives any project the living-docs workflow (SPEC §2.1): `docs/kairos/` files, pointers so every agent (Bob, Claude Code, Codex) reads them first, and deterministic logging of commits and drift resolutions.

## Spec
- `kairos init` (`packages/cli/src/commands/init.ts`) also creates `docs/kairos/{SPEC,PLAN,PROGRESS,DECISIONS,HANDOFF}.md` and `docs/kairos/tasks/README.md` from `src/templates/living-docs.ts`. Existing files are skipped unless `--force`.
- Pointer block between `<!-- kairos:start -->` / `<!-- kairos:end -->` in `CLAUDE.md` and `AGENTS.md`: created if the file is missing, appended if there is no block, replaced in place if there is one; a current block is left untouched (idempotent, no `--force` needed). Result lists these under `updated`.
- `kairos-dev` Bob mode was already in `.bob/custom_modes.yaml` (T0/T14 wording); init ships it as before.
- In a git repo, init writes `.git/hooks/post-commit` (chmod 755, marker `# kairos:post-commit`) that runs `node "<kairos entry>" progress || kairos progress`, output silenced, never fails the commit. A hook without the marker is never replaced (listed as skipped).
- `kairos progress [--rev HEAD]` (`src/commands/progress.ts` → `logCommit` in `src/docs/log.ts`): appends `## <date> · <short hash> · <subject>` + a file list to `PROGRESS.md`. Skips commits that touch only `PROGRESS.md`; does nothing when the project has no living docs.
- `kairos fix`: after the user accepts, appends an entry to `docs/kairos/DECISIONS.md` (date, id, type, title, location, truth, changed files, Bob's summary) if the file exists, and commits it together with the fix.

## Decisions
- **Hook entries stay uncommitted** and ride along with the next commit. Amending in `post-commit` would change the hash the entry records; staging in `pre-commit` does not know the message or hash. Because of that, `fix` treats `docs/kairos/PROGRESS.md` as Kairos runtime output: ignored by the clean-tree check, never reverted, never part of the fix commit.
- **Hook calls the absolute entry script** that ran `init` (the demo runs `node .../dist/index.js`, not a global `kairos`), with `kairos` on PATH as fallback.
- **DECISIONS entry goes into the fix commit** (no hash in the entry; the commit message `kairos fix <ID>: ...` ties them). Only when `DECISIONS.md` exists: `fix` does not create living docs in projects that never ran `init`.
- **The demo does not get `docs/kairos/` yet**: it would change the check prompt (and the recorded fixture hashes). Decide in T12 whether the video shows it.

## Problems
None so far.

## Result
- Tests: `test/init.test.ts` (scaffold list, idempotence, pointer append/replace, hook install/refuse), `test/log.test.ts` (commit entry, skip rule, no-docs, the real hook firing on `git commit`, decision format), `test/fix.test.ts` (decision in the fix commit, dirty `PROGRESS.md` ignored). 123 tests green, lint clean.
- Smoke: built CLI, `init` in a fresh repo, two commits → second one logged in `PROGRESS.md` by the hook.
- Follow-ups: T14 uses `PROGRESS.md`/`PLAN.md` for docs freshness and `HANDOFF.md` for `kairos handoff`.
