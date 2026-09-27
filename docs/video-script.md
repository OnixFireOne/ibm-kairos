# Kairos: demo video script (≤ 3:00)

The submission video must be at most 3 minutes. Everything below runs on **live IBM Bob**; cut the waiting time while Bob works (keep a second of the spinner so it is clear it is live).

## Before recording (once)
```bash
cd <repo>                                   # ibm-kairos
pnpm -r build
export KAIROS_DEMO_DIR=/tmp/k/orders-api
alias kairos="node $PWD/packages/cli/dist/index.js"
demo/scripts/reset.sh --install && demo/scripts/drift-a.sh && demo/scripts/drift-b.sh && demo/scripts/drift-c.sh
cd $KAIROS_DEMO_DIR
```
Run `kairos` from a shell that has the Bob API key (`zsh` with `~/.zshrc`). Terminal font large, window clean.
Browser tabs ready: `docs/assets/cover.png`, the PR https://github.com/OnixFireOne/kairos-demo-orders-api/pull/2, `docs/assets/timeline.png`.
A retake: rerun the `reset.sh … drift-c.sh` line (≈0.3 Bobcoins per take: check + one fix with re-check).

## 1. Problem + one sentence (0:00–0:25)
**Screen:** cover image.
**Say:** "Code changes every day. The spec, the API contract and the README don't. Linters check syntax, tests check what someone remembered to test. Nothing checks that a change still matches the intent. Kairos does: on every commit, push or pull request, IBM Bob compares the diff with your specs, contracts, docs and tests, and then helps you fix the drift."

## 2. Live check (0:25–1:10)
**Screen:** terminal.
```bash
git log --oneline main..
kairos check
```
**Say:** "Three ordinary commits: the discount went from 10 to 15 percent, a new DELETE endpoint, an env var renamed. Kairos runs Bob headless in its own custom mode. Bob reads the diff and the matching spec sections, and opens whatever code it needs." (cut the wait) "Every drift is caught, each with evidence on both sides, and exit code 1: this push is blocked."
Scroll `kairos-report.md` briefly: the discount finding with the code line and the SPEC line.

Bob words and splits findings slightly differently on each run, so the number of rows can vary (4 to 6). That is fine: point at the three stories (discount, DELETE, DB_URL).

## 3. Live fix: the spec wins (1:10–1:50)
Check in the table that `KRS-001` is the discount `SPEC_VIOLATION` in `src/pricing.ts` (it was in every run; if not, use the id of that row).
```bash
kairos fix --id KRS-001 --truth intent --allow-code --yes
```
**Say:** "Kairos never assumes the code is right. This discount rule belongs to Finance, so the spec is the truth and Bob puts the code and the tests back. When the code is the truth, Bob updates the docs, the contract and the tests instead. Kairos commits, logs the decision and re-checks: this drift is resolved."
(`--yes` skips the confirm prompt to save time; drop it to show the diff confirmation.)

## 4. Where it runs (1:50–2:20)
**Screen:** the PR tab: scroll through the Kairos comment, stop on the red required check and the blocked Merge button. Then the timeline image.
**Say:** "The same check runs as a pre-push hook and as a GitHub Action that posts the report on the pull request. Make it a required check, and drift blocks the merge. The timeline shows every Kairos moment: when drift appeared and when it was resolved."

## 5. How Bob powers it (2:20–2:50)
**Screen:** `.bob/custom_modes.yaml`, then the metrics table in the README, then `bob_sessions/`.
**Say:** "Bob is the engine: four custom modes, Bob Shell headless with JSON output, cost and turn caps, whole-repo reading and agent-mode fixes. About a tenth of a Bobcoin and half a minute per check. Kairos also gives any project living docs that Bob, Claude Code and Codex read first, and I built Kairos itself that way. Kairos: the right moment, every time."
**Screen (last 3 s):** cover image with the repo URL.
