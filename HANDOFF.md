# Handoff

Updated: 2026-09-27 18:40 Astana. **Submitted to lablab.ai** (deadline was 15:00 UTC = 20:00 Astana). Waiting for judging.

## State
- Done: T0–T16 (`PLAN.md`, `docs/tasks/`). After the submission and before the deadline: T15 live Bob progress (`stream-json`, TTY status line), T16 `kairos doctor` + environment check at the end of `init`.
- Submission assets: `docs/submission.md` (form texts), `docs/slides.pdf`, `docs/assets/cover.png`, video `../shots/video/kairos-demo.mp4` (built by `scripts/video/`, the video predates T15).
- 170 tests green, lint clean, CI green on `main`.
- Bobcoins: 6.38 / 40 (`bob_sessions/README.md`; the submitted slides and form say 6.26). 15 Bob IDE screenshots; tasks 14–15 (video rehearsal and take) have raw logs only.

## In progress
Nothing.

## Next step
None until results. Don't merge demo PR https://github.com/OnixFireOne/kairos-demo-orders-api/pull/2 (the live example in the submission); keep both repos public. After judging, ideas from README "what's next": publish to npm, IDE nudges, Bob subagents, more languages.

## Gotchas
- Never run real `bob` unless asked; with the key use `zsh -ic` (the key lives in `~/.zshrc`). Never print or commit it.
- Bob evidence: after each Bob run, give the user the task number and `task_id` for a Bob IDE screenshot (`orders-api` workspace for runs on the demo); file it as `bob_sessions/kairos_taskNN_<desc>.png` + a row in `bob_sessions/README.md`. Next Bob task number: 18.
- Copy `.kairos/runs/` of real runs into `bob_sessions/cli/` before `demo/scripts/reset.sh` (reset deletes them).
- Live Bob is not deterministic: finding count and ids vary between runs (see T12).
- Intel Mac: Homebrew builds ffmpeg from source (too slow); video is assembled with AVFoundation (`scripts/video/`).
- `gh` is not installed; check CI with `curl https://api.github.com/repos/OnixFireOne/ibm-kairos/actions/runs?per_page=1`.
- Run prettier and `pnpm lint` from the repo root; `pnpm test` green at every commit.
- Repo in English; chat with the user in Russian. Delegate to Codex only when cheaper (`CLAUDE.md`).

## Read first
`CLAUDE.md`, this file, `PLAN.md`, then only the task file and `SPEC.md` sections the work needs.
