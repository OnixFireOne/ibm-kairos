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
- PR comment verified: demo repo https://github.com/OnixFireOne/kairos-demo-orders-api (built with `KAIROS_DEMO_DIR=../kairos-demo-pr demo/scripts/reset.sh` + drifts A/B/C), PR #2 → Kairos comment with 4 findings, red check. Found and fixed a base-ref bug on the way (see T10 Problems).
- Left (user): record and upload the video, fill the lablab form, final secret check.

## Video rehearsal on live Bob (Sep 27)
- Full live chain on `/tmp/k/orders-api` (Bob task 14, raw outputs `bob_sessions/cli/20260927T10*-task14-video-rehearsal.json`, 9 runs, 1.049 Bobcoins): check 41 s, 6 findings (Bob split C into README + SPEC and B into SPEC + openapi + test); every fix resolved its finding; A (`--truth intent --allow-code`) was `KRS-001` and fixed first try.
- Live runs are not deterministic: finding count and ids change between runs, and the final re-check flagged a new medium MISSING_TEST in Bob's own test for B (no GET after DELETE), so the chain needs one more fix to go green. Not a Kairos bug, but unsuitable for a scripted video.
- **Decision:** the video limit is 3 minutes, so the script was cut to 2:50 with one live check and one live fix (A, stable id and outcome); the PR and the timeline are shown as ready assets. ≈0.3 Bobcoins per take.
