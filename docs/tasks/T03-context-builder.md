# T03 Context builder
Status: [x] · Owner: IBM Bob (task 03) + Claude Code (prompt, builder) · Commits: 2537cc3, aadd512

## Goal
Pick the intent excerpts relevant to a diff, within budget, and render the Bob prompt. No LLM.

## Spec
Contract `context/types.ts`. Bob: `glob.ts` (`matchesGlob`), `sections.ts` (`splitMarkdown`), `intent.ts` (`loadIntentFiles`), `select.ts` (`isSearchable`, `selectContext`). Claude: `prompt.ts` (`buildPrompt`, `fence`; snapshot `test/__snapshots__/prompt.drift.md`), `builder.ts` (`buildContext`). Fixture project: `test/fixtures/intent/` (excluded from vitest and tsc).
Rules:
- The diff always goes in whole; excerpts get `maxContextChars - diff.length`.
- Map `file#Heading` selects the section with subsections; bare `file` the whole file.
- Symbol grep only for searchable symbols: env, routes, functions/classes ≥ 3 chars, consts only if UPPER_CASE or camelCase ≥ 4 chars. Routes match `:param` and `{param}` on a path boundary.
- Markdown match → the section; other files → ±10 line window. Overlaps merge.
- Budget priority: map excerpts, then number of matched symbols, then file/line; omitted ones are listed in the prompt.

## Problems
- Claude's test missed a match on fixture line 30 (`describe('applyDiscount'`); Bob burnt its 2.00 cap chasing it and hacked the regex at the end. Test fixed, hack reverted. Lesson: grep fixtures for every term before handing tests to Bob.

## Result
55 tests green. Bob: 2.08 Bobcoins (cap hit at step 5/7; do not "Continue Task").
