# T02 Diff collector
Status: [x] · Owner: IBM Bob (task 02) against Claude Code's tests · Commits: 0ac881c, d9389d4

## Goal
Turn `git diff <base>...HEAD` into files, hunks with line numbers and changed symbols.

## Spec
Contract: `collector/types.ts`. Implementation: `collector/diff.ts` (`parseDiff`, `extractSymbols`, `getDiff`, `DiffError`). Fixtures: `test/fixtures/diffs/{drift,multi}.diff` generated from real git (drift A/B/C, binary, added/deleted/renamed, multi-hunk, no EOL).
Symbols: function/class/const/route (`METHOD /path`)/env on changed lines; enclosing declaration of a changed line (walk back in the hunk, stop at a column-0 closer, fall back to the `@@` header); removed+added of the same symbol → `modified`.

## Decisions
- Tests-first split: Claude wrote contract + fixtures + tests, Bob implemented.

## Problems
- Local consts (`path`, `result`) are extracted too; filtered later by `isSearchable` (T03).
- Paths with spaces (git quotes them) are not supported.

## Result
22 tests green. Bob: 1.29 Bobcoins, 28 tool calls (it ran the tests many times).
