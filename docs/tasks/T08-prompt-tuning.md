# T08 Prompt tuning on the demo (real Bob)
Status: [x] · Owner: Claude Code + IBM Bob (runtime) · Commits: see `git log --grep T8`

## Goal
`kairos check` with real Bob finds demo drifts A (SPEC_VIOLATION), B (UNDOCUMENTED_BEHAVIOR / MISSING_TEST) and C (STALE_DOC) with evidence on both sides, and reports nothing on the control commit. Record the final replies as MockEngine fixtures.

## Spec
- Setup: `pnpm -C packages/cli build`, `demo/scripts/reset.sh --install`, `drift-a/b/c.sh` (or `control.sh`), then in `demo/.work/orders-api`: `zsh -ic 'node ../../../packages/cli/dist/index.js check'` (key from `~/.zshrc`).
- Evidence: each run's raw output (`.kairos/runs/*-check.json` in the demo repo) is copied to `bob_sessions/cli/<ts>-taskNN-<desc>.json` and listed in `bob_sessions/README.md`; IDE screenshot per task.
- Fixtures: `demo/orders-api/.kairos/fixtures/<fixtureName(prompt)>.txt` = Bob's final message for the A/B/C and control prompts.

## Runs
| # | Scenario | Bob task | Bobcoins | Result |
|---|---|---|---|---|
| 04 | A/B/C | `f3babde56e40092f568b0fd80ed7ad85` | 0.091 | 4 findings, all correct: A SPEC_VIOLATION (high, truth intent, `pricing.ts:8` ↔ SPEC 10-14), C STALE_DOC (high, truth code, SPEC:26 + README 10/18 named), B UNDOCUMENTED_BEHAVIOR (medium, truth ask) + MISSING_TEST (medium). Confidence 1.0. Exit 1. 8 tool calls, 27 s. |
| 05 | control | `99bc687f5163d26359f24d74d876a94a` | 0.026 | No drift. Exit 0. 1 tool call. |

## Decisions
- No prompt/mode tuning was needed: the first real run hit the acceptance criteria (SPEC §10: A/B/C found with evidence, control clean, ≤ budget). Remaining Bobcoin reserve goes to fix flow (T9) and the video.
- B yields two findings (UNDOCUMENTED_BEHAVIOR + MISSING_TEST). Kept: both are true and map to the two fixes in the story (OpenAPI entry, test).
- The head sha was removed from the prompt: commit shas change on every `reset.sh`, so the prompt hash (cache key, fixture name) never matched. Now the prompt depends only on the change; this also makes the Bob cache survive rebases for real users.
- Fixtures: `demo/orders-api/.kairos/fixtures/{e252b0ec…,a89f2ee0…}.txt` = Bob's verbatim final messages (recorded with the head line in the prompt, the only difference; re-keyed to the new prompt hashes). `test/demo.test.ts` replays them after a fresh reset.
- `demo/sample-report.md`: the Markdown report of run 04, for the README/slides.

## Problems
- Fixture keys depended on commit shas (see above).

## Result
Total 0.117 Bobcoins for both runs. 89 tests green, lint clean. Screenshots for tasks 04 and 05 pending (user).
