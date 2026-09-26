# Task files

One file per task from [PLAN.md](../../PLAN.md): `TNN-<slug>.md`. It holds everything needed to work on that task without reading the whole history:

```
# TNN Title
Status: [ ] todo | [~] in progress | [x] done · Owner: Claude Code | IBM Bob | both · Commits: <hashes>

## Goal          what and why, 1–3 lines
## Spec          interfaces, rules, files to create/change
## Decisions     choices made and why (append as they happen)
## Problems      traps hit, bugs, open questions
## Result        tests, Bob task id + Bobcoins, follow-ups for later tasks
```

`SPEC.md` keeps only the stable product picture; task-level detail lives here. `HANDOFF.md` links the current task file.
