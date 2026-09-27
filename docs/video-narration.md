# Kairos video: narration (voice track)

Five blocks, one audio file per block (`1.mp3` … `5.mp3`, any format). The video is cut to each file's length, so pace is free; the total should stay under ~2:50 (about 400 words at a calm pace). Visuals per block: `docs/video-script.md`.

## 1. Problem (~25 s)
Code changes every day. The spec, the API contract and the README don't. Linters check syntax, and tests check what someone remembered to test. Nothing checks that a change still matches the intent. Kairos does. On every commit, push or pull request, IBM Bob compares the diff with your specs, contracts, docs and tests, and then helps you fix the drift.

## 2. Live check (~40 s)
Here is a small orders service with three ordinary commits: the loyalty discount went from ten to fifteen percent, a new DELETE endpoint was added, and an environment variable was renamed. Kairos runs IBM Bob headless, in its own custom mode. Bob reads the diff and the matching spec sections, and opens whatever code it needs. Every drift is caught, each with evidence on both sides: the line of code and the line of the spec it breaks. Exit code one: this push is blocked.

## 3. Live fix (~35 s)
Kairos never assumes the code is right. The discount rule belongs to Finance, so here the spec is the truth, and Bob puts the code and the tests back. When the code is the truth, Bob updates the docs, the contract and the tests instead. Kairos commits the fix, logs the decision, and asks Bob to check again. This drift is resolved.

## 4. Where it runs (~30 s)
The same check runs as a pre-push hook, and as a GitHub Action that posts the report on the pull request. Make it a required check, and drift blocks the merge. The timeline shows every Kairos moment: when drift appeared, and when it was resolved.

## 5. How Bob powers it (~30 s)
IBM Bob is the engine: four custom modes, Bob Shell headless with JSON output, cost and turn caps, whole-repo reading and agent-mode fixes. About a tenth of a Bobcoin and half a minute per check. Kairos also gives any project living docs that Bob, Claude Code and Codex read first. I built Kairos itself that way. Kairos: the right moment, every time.
