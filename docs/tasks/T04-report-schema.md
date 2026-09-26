# T04 Report schema + parser
Status: [x] · Owner: Claude Code · Commits: 2f90fc7

## Goal
Validate Bob's reply and store drift reports.

## Spec
`report/schema.ts`: `Finding`, `BobReply = { findings, summary }` (what Bob returns), `DriftReport` = BobReply + `runId, base, head, createdAt, cost?` (what Kairos stores), `bobReplyJsonSchema()`. `report/parse.ts`: `extractJson`, `parseReply`, `repairPrompt`, `parseWithRepair(text, repair)`, `ReplyParseError`.

## Decisions
- The prompt's JSON Schema is generated from the zod schema (`z.toJSONSchema(..., { reused: 'ref' })`, compact, ~1.8k chars) so they cannot drift apart.
- JSON is accepted raw, fenced (last block wins) or wrapped in prose. Near-misses normalised: single line number → `[n, n]`, missing `intent` → null.
- Repair is a callback, so the parser does not depend on engines; T05/T06 pass the engine.
- Finding ids come from Bob (`KRS-001…` in reply order).

## Result
10 tests in `test/report.test.ts`; 65 total green.
