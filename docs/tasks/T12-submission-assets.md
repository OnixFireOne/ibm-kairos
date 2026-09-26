# T12 Submission assets
Status: [~] in progress · Owner: Claude Code (+ user: video, PR, form) · Commits: see `git log --grep T12`

## Goal
Everything the lablab.ai submission needs: README that sells and explains, slides (PDF), video script, 16:9 cover, form texts, real numbers in the metrics table.

## Spec
- `README.md`: pitch, 60-second offline demo, sample output, timeline screenshot, commands, "How Kairos uses IBM Bob", metrics table (SPEC §2.2), living docs, mermaid architecture, use in your repo, limitations, how it was built.
- `docs/assets/timeline.png` (mock replay of the real fix chain), `docs/assets/cover.{html,png}` (1920x1080), `docs/slides.{html,pdf}` (9 slides), `docs/video-script.md` (~3.5 min), `docs/submission.md` (title, short/long descriptions, tags, links, how to regenerate).

## Decisions
- **Images and PDF rendered with headless Google Chrome** (`--screenshot`, `--print-to-pdf`) from HTML sources in the repo: no new dependencies (no Marp, no ImageMagick). Slides are `docs/slides.html` instead of the planned `slides.md`.
- **Metrics only from real Bob runs** (tasks 04–13, durations from the Bob Shell log timestamps). No manual stopwatch baseline was taken, and the README says so instead of inventing one.
- **Honest scope in README**: Bob subagents (SPEC §3) are not implemented, listed under "next"; `kairos session`/`handoff` are mock-tested only, stated under limitations.

## Problems
- The real final re-check (task 13) was described as "no drift left", but its reply holds one `low` finding (the JSON 404 body of the new DELETE route is not in openapi.yaml, introduced by fix B). It passes (`failOn: medium`). Corrected in `bob_sessions/README.md` and T09; README and slides tell it as a feature (Bob checks its own fix).
- Mock timeline run #2 shows "+1 opened": MISSING_TEST moved from `src/routes/orders.ts` to `test/orders.test.ts` in Bob's reply, and findings are matched by type + file (T11 decision).

## Result
- Done: README, cover, timeline screenshot, slides PDF, video script, submission texts. `pnpm test` + lint green.
- Left (user): PR comment of the Action on a real PR (push a copy of the demo to a GitHub repo, open a PR with drifts A/B/C), record and upload the video, fill the lablab form, final secret check.
