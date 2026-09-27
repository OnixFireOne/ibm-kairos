# Submission (lablab.ai, IBM Bob 2.0 Hackathon)

Everything the submission form asks for, in one place. Deadline: Sun Sep 27, 2026 15:00 UTC.

## Title
Kairos: catch the moment code drifts from intent

## Short description
An intent-drift guardian powered by IBM Bob. On every commit, push or pull request, Bob compares the diff with your specs, API contracts, docs and tests, reports each divergence with evidence on both sides, and fixes it on the side that is wrong.

## Long description
Code changes every day, but the documents that say what it should do (specs, API contracts, READMEs, tests) rarely keep up. Linters check syntax and tests check what someone remembered to test. Nothing checks that a change still matches the intent, until it becomes an incident.

Kairos is a CLI, a pre-push hook and a GitHub Action built on IBM Bob. `kairos check` takes the diff, selects the matching sections of the project's intent sources, and runs Bob Shell headless in a dedicated `kairos` custom mode. Bob reads the code it needs and returns a Drift Report: spec violations, stale docs, undocumented behaviour, missing tests, each with file:line evidence on both sides, a severity and a proposed resolution. Drift at or above the threshold blocks the push or fails the PR check, and the report is posted as a PR comment.

Kairos does not assume the code is right. `kairos fix` asks which side is the truth: when the code is, Bob updates the docs and adds the missing tests (a docs-and-tests-only mode); when the spec is, Bob puts the code back in line (only with `--allow-code`). You confirm the diff, Kairos commits, logs the decision and re-checks. `kairos report --html` shows every drift moment on a timeline.

Kairos is for development teams whose services are described by specs, API contracts and READMEs that several people and AI agents edit: backend developers see drift before they push, reviewers see it on the pull request, and tech leads get a history of every decision. Kairos treats drift between code and intent as a checkable, fixable event rather than a review-time hunch.

Kairos also keeps the docs themselves alive. `kairos init` gives a project living docs (SPEC, PLAN, PROGRESS, DECISIONS, per-task files and a HANDOFF note) plus pointers that make Bob, Claude Code and Codex read the handoff first, so a new chat continues from "continue". Kairos itself was built this way.

Measured on the demo with real IBM Bob: 3/3 seeded drifts caught, 0 false positives on a control commit, 20–35 s and 0.03–0.18 Bobcoins per check (0 for a cached rerun), each fix in 11–28 s, the whole loop from detection to a passing check in 5.5 minutes for 1.12 Bobcoins. The whole hackathon used 6.26 of 40 Bobcoins.

## IBM Bob Usage Statement
IBM Bob is both the runtime engine of Kairos and a developer on its team.

**Bob as the product engine.** Every `kairos check` and `kairos fix` is a headless IBM Bob Shell run: `bob run --mode <mode> --format json --max-cost <N> --max-turns <N>`, prompt on stdin. Kairos collects the git diff and deterministically selects only the relevant sections of the intent sources (Markdown specs, OpenAPI YAML, READMEs, tests); Bob then opens whatever code it needs across the repository (8 tool calls on the demo drift check, 1 on a clean control commit) and returns a JSON Drift Report with file:line evidence on both sides. Kairos ships four Bob custom modes in `.bob/custom_modes.yaml`, usable headless and in Bob IDE:
- `kairos`: read-only drift auditor.
- `kairos-fix`: agent mode restricted by `fileRegex` to docs, contracts and tests, used when the code is the source of truth.
- `kairos-fix-code`: may also edit code, used only with `--allow-code` when the spec is the source of truth.
- `kairos-dev`: works on a task and keeps PLAN, PROGRESS, DECISIONS and HANDOFF current.

In fix mode Bob edits the files, runs the project tests, and Kairos shows the diff, commits and re-checks with Bob. Cost is controlled by per-command `--max-cost`/`--max-turns` caps and a prompt-hash cache (a repeated check costs 0). The same Bob path runs in CI: the Kairos GitHub Action calls Bob Shell with `BOB_API_KEY` from a repository secret and posts the report as a PR comment.

**Bob as a developer.** Development was orchestrated from Claude Code, which wrote contracts and failing tests first and handed implementation tasks to Bob Shell headless (`scripts/bob-task.sh`), the same path the product uses. Bob implemented the git diff collector (22/22 tests green) and the intent context selection module (55/55), fixed the quoting of `fileRegex` in our custom modes, and verified that each mode loads. Every Bob task is logged in `bob_sessions/README.md` with Bob IDE task consumption screenshots and raw `bob run --format json` outputs.

**Measured with real Bob on the demo service:** 3/3 seeded drifts caught (a changed business rule, an undocumented endpoint, a renamed env var), 0 false positives on a control commit, 0.03–0.18 Bobcoins and 20–40 s per check, each fix in 11–60 s including the re-check. In one run Bob flagged a gap in a test it had just written itself. Total: about 6 of 40 Bobcoins for the whole hackathon.

watsonx.ai and watsonx Orchestrate are not used: IBM Bob is the only AI engine in Kairos.

## Demo application platform / URL
- Platform: CLI (Node.js 20+, macOS/Linux), git pre-push hook, GitHub Action.
- Application URL: https://github.com/OnixFireOne/ibm-kairos (install and 60-second offline demo in the README).
- Live example: https://github.com/OnixFireOne/kairos-demo-orders-api/pull/2 (Kairos comment and the blocked merge on a real pull request).

## Technologies / tags
IBM Bob, Bob Shell, Bob IDE, custom modes, TypeScript, Node.js, GitHub Actions, vitest

## Links and files
| Field | Value |
|---|---|
| Repository | https://github.com/OnixFireOne/ibm-kairos (public, MIT) |
| Cover (16:9) | [assets/cover.png](assets/cover.png) (source: [assets/cover.html](assets/cover.html)) |
| Slides (PDF) | [slides.pdf](slides.pdf) (source: [slides.html](slides.html)) |
| Video | MP4 upload `kairos-demo.mp4` (2:25, 92 s of the live product; built by [../scripts/video/](../scripts/video/README.md)) (script: [video-script.md](video-script.md)) |
| Bob evidence | [../bob_sessions/](../bob_sessions/README.md) |
| Team | [../brand/team_description.md](../brand/team_description.md) |

## Regenerate the images
From the repo root, with Google Chrome installed:
```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless --hide-scrollbars --allow-file-access-from-files --window-size=1920,1080 --screenshot=docs/assets/cover.png "file://$PWD/docs/assets/cover.html"
"$CH" --headless --no-pdf-header-footer --allow-file-access-from-files --print-to-pdf=docs/slides.pdf "file://$PWD/docs/slides.html"
```
`docs/assets/timeline.png`: run the offline demo from the README, `kairos report --html`, then screenshot `kairos-timeline.html` at `--window-size=1100,880 --force-device-scale-factor=2`.
