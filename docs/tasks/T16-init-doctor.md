# T16 Environment check (init + doctor)
Status: [x] done · Owner: Claude Code · Commits: see `git log --grep T16`

## Goal
A new user runs `kairos init` and then `kairos check`, and only learns at that point that Bob Shell or the API key is missing. Tell them right after `init`, with what to do.

## Spec
- `commands/doctor.ts`: `checkEnvironment()` runs `bob --version` and checks `BOB_API_KEY` in the environment; `formatEnvChecks()` prints ✓/✗ lines with a hint and, when something is missing, the offline fallback `kairos check --engine mock`.
- `kairos init` prints the check after the file list. `kairos doctor` prints it on demand and exits 1 when something is missing.

## Decisions
- Kairos does not install Bob Shell itself: it is IBM's product with its own installer and account.
- The key is not asked for and never written to a file: `.kairos/config.yaml` is committed, and a leaked IBM key can get the account suspended. It stays in the environment (shell profile, CI secret). The check never prints the key.

## Result
- 170 tests green (3 new). Verified in a temp repo: key missing, all ok (exit 0), Bob Shell not on PATH (exit 1).
