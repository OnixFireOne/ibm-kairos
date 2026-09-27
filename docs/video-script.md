# Kairos: demo video script (~3.5 min)

Recording setup: terminal with a large font, short demo path (`export KAIROS_DEMO_DIR=/tmp/k/orders-api`), `alias kairos="node <repo>/packages/cli/dist/index.js"`, browser tab with the GitHub PR, Bob IDE open on the `orders-api` workspace. Rehearse with `--engine mock`; record the live part on real Bob (≈0.7 Bobcoins for check + 3 fixes + re-checks) or on mock if the budget is tight, and say which one on screen.

## 1. Problem (0:00–0:20)
**Screen:** cover image, then `docs/SPEC.md` of the demo next to `src/pricing.ts`.
**Say:** "Code changes every day. The spec, the API contract and the README don't. Linters check syntax, tests check what someone remembered to test. Nothing checks that a change still matches the intent, until it causes an incident."

## 2. Kairos in one sentence (0:20–0:35)
**Screen:** banner.
**Say:** "Kairos catches the moment code drifts from intent. On every commit, push or pull request, IBM Bob compares the diff with your specs, contracts, docs and tests, and then helps you fix the drift."

## 3. Live: catch and fix (0:35–2:05)
**Screen:** terminal.
```bash
demo/scripts/reset.sh --install && demo/scripts/drift-a.sh && demo/scripts/drift-b.sh && demo/scripts/drift-c.sh
cd $KAIROS_DEMO_DIR && git log --oneline main..
kairos check
```
**Say:** "Three ordinary commits: the discount went from 10 to 15 percent, a new DELETE endpoint, an env var renamed. Kairos runs Bob in its own custom mode. Bob reads the diff, the relevant spec sections, and opens whatever code it needs. Four findings, each with evidence on both sides, and exit code 1: this push is blocked."
Open `kairos-report.md` briefly: show KRS-001 with the code line and the SPEC line.

```bash
kairos fix --id KRS-002                                  # C: docs follow the code
kairos fix --id KRS-002 --truth code                     # B: document the endpoint, add tests
kairos fix --id KRS-001 --truth intent --allow-code      # A: the spec wins
```
**Say:** "Kairos never assumes the code is right. The env rename is intended, so the docs follow the code. The new endpoint is intended too, so Bob adds it to the spec and the OpenAPI file and writes two tests. But the discount change broke a rule owned by Finance, so here the spec is the truth and Bob puts the code back. Each time I see the diff, confirm, Kairos commits, logs the decision and re-checks."
Point at the last re-check: "Bob even noticed its own new endpoint returns a JSON body on 404 that the contract doesn't declare. Low severity, below the threshold, so the check passes, but it stays visible."

## 4. Where it runs (2:05–2:35)
**Screen:** https://github.com/OnixFireOne/kairos-demo-orders-api/pull/2: scroll slowly through the Kairos comment, stop on the red required check and the greyed-out Merge button; then `kairos report --html` in the browser.
**Say:** "The same check runs as a pre-push hook and as a GitHub Action that posts the report on the pull request. Mark it as required, and drift blocks the merge. The timeline shows every Kairos moment: when drift appeared and when it was resolved."

## 5. Continuity (2:35–3:00)
**Screen:** this repo: `HANDOFF.md`, `PLAN.md`, `docs/tasks/`; a new Claude Code chat with the single message "continue" picking up the next task.
**Say:** "Kairos also keeps the docs themselves alive. `kairos init` gives any project a spec, a plan, a progress log, decisions and a handoff note that every agent reads first: Bob in the kairos-dev mode, Claude Code, Codex. I built Kairos itself this way: every new chat started with just 'continue'."

## 6. How Bob powers it (3:00–3:25)
**Screen:** `.bob/custom_modes.yaml`, the metrics table in the README, `bob_sessions/`.
**Say:** "Bob is the engine: four custom modes, Bob Shell headless with JSON output, cost and turn caps, whole-repo reading and agent-mode fixes. On the demo: three of three drifts caught, zero false positives, about a tenth of a Bobcoin and half a minute per check, each fix under 30 seconds. The whole hackathon cost under 5 of 40 Bobcoins."

## 7. What's next (3:25–3:40)
**Say:** "Next: nudges inside the IDE at the moment of the edit, more languages, and an org-wide drift dashboard. Kairos: the right moment, every time."
**Screen:** cover image with the repo URL.
