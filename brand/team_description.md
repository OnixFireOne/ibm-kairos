# Kairos — team description

## Short (team card)
Kairos is a solo team: a fullstack and AI engineer who has shipped his own products since 2016. We're building a Bob-powered guardian that catches the moment code drifts from intent: when a change breaks the spec, outdates the docs, or skips the tests.

## Long (About)
In Greek, *kairos* means the opportune moment. Chronos is the time that passes; kairos is the time that matters. Most engineering pain comes from acting too late: specs that no longer match the code, docs nobody updated, new behavior shipped without tests.

**What we're building.** Kairos is an intent-drift guardian built on IBM Bob. On every change, it reads the diff together with the project's specs, ADRs, README and tests. It then flags where code and intent have split apart and uses Bob to prepare the fix: an updated spec section, the missing tests, or a corrected doc. It runs as a custom Bob mode in the IDE and headless through Bob Shell in CI, so the check happens at the right moment: before merge, not after an incident.

**Who's behind it.** An independent AI and fullstack engineer who works spec-first with coding agents. Solo founder of inp.one, a crypto-analytics service in production that handles ~30k monthly users with multi-million peaks. Also built News Radar (a local-LLM news aggregator with trend clustering) and a Polymarket trading platform that runs ~100 concurrent bots.

Stack: TypeScript, Python, IBM Bob (IDE + Bob Shell), watsonx.ai.
