<p align="center"><img src="brand/kairos_banner_1600x600.png" alt="Kairos" width="800"></p>

# Kairos

> **Catch the moment code drifts from intent.** A spec-driven continuity and intent-drift guardian built on **IBM Bob**.

Built for the [IBM Bob 2.0 Hackathon](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon) (lablab.ai, Sep 25–27, 2026). See [SPEC.md](SPEC.md) and [PLAN.md](PLAN.md).

## Status

Work in progress. See [PLAN.md](PLAN.md) for the task list.

## Development

```bash
corepack enable
pnpm install
pnpm test
pnpm build && node packages/cli/dist/index.js --help
```

Requires Node ≥ 20 (Node ≥ 24 for Bob Shell).

## IBM Bob usage

Bob custom modes live in [.bob/custom_modes.yaml](.bob/custom_modes.yaml). Evidence of every Bob task is in [bob_sessions/](bob_sessions/).

## How it was built

Kairos is built by one developer with two AI tools in distinct roles:

- **Claude Code** writes most of the CLI code and orchestrates the work.
- **IBM Bob** is the product's runtime engine and also runs selected dev tasks. Claude Code calls Bob Shell headless (`scripts/bob-task.sh`), exactly as `kairos check` will, so Bob's integration is exercised from day 1. Evidence: [bob_sessions/](bob_sessions/).

Kairos is also built *with* its own workflow: [HANDOFF.md](HANDOFF.md), [PLAN.md](PLAN.md) with statuses and one file per task in [docs/tasks/](docs/tasks/README.md). Every new session, in Claude Code or Bob, starts from "continue" and reads only the current task.

## License

MIT
