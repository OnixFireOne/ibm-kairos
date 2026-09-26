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

Kairos also keeps the docs themselves alive. `kairos init` gives a project living docs (SPEC, PLAN, PROGRESS, DECISIONS, per-task files and a HANDOFF note) plus pointers that make Bob, Claude Code and Codex read the handoff first, so a new chat continues from "continue". Kairos itself was built this way.

Measured on the demo with real IBM Bob: 3/3 seeded drifts caught, 0 false positives on a control commit, 20–35 s and 0.03–0.18 Bobcoins per check (0 for a cached rerun), each fix in 11–28 s, the whole loop from detection to a passing check in 5.5 minutes for 1.12 Bobcoins. The whole hackathon used 4.85 of 40 Bobcoins.

## Technologies / tags
IBM Bob, Bob Shell, Bob IDE, custom modes, TypeScript, Node.js, GitHub Actions, vitest

## Links and files
| Field | Value |
|---|---|
| Repository | https://github.com/OnixFireOne/ibm-kairos (public, MIT) |
| Cover (16:9) | [assets/cover.png](assets/cover.png) (source: [assets/cover.html](assets/cover.html)) |
| Slides (PDF) | [slides.pdf](slides.pdf) (source: [slides.html](slides.html)) |
| Video | _todo: YouTube/Loom URL_ (script: [video-script.md](video-script.md)) |
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
