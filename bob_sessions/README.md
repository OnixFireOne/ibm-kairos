# Bob sessions

Evidence of IBM Bob usage, as required by the hackathon guide.

- `kairos_taskXX_<description>.png`: Bob IDE task consumption summaries (Tasks → open task → click the header).
- `cli/`: raw `bob run --format json` outputs from Bob Shell.

| Task | Tool | What Bob did | Bobcoins | Screenshot |
|---|---|---|---|---|
| 00 | Bob Shell (`bob run`, ask) | Probe: API key auth works headless | 0.011 | — |
| 01 | Bob Shell (`bob run`, agent) | Fixed `fileRegex` quoting in `.bob/custom_modes.yaml` so the `kairos-fix` mode loads | 0.211 | `kairos_task01_custom_modes.png` |
| 01b | Bob Shell (`bob run`, `kairos` mode) | Verified the custom `kairos` mode loads | 0.010 | — |

## How Bob is driven during development

Development is orchestrated from **Claude Code**, which calls **IBM Bob Shell headless** (`scripts/bob-task.sh` → `bob run --format json`) for Bob tasks. This is the same path the product's `BobEngine` uses, so every dev task also tests Kairos's runtime integration with Bob (auth, modes, JSON output, cost caps).

- Prompts: `prompts/<task>.txt`. Raw results: `cli/<timestamp>-<task>.json` (status, task id, Bobcoins, tool calls, final message).
- Bob Shell and Bob IDE share task history on the same machine, so each task also appears in Bob IDE → Tasks, where the consumption summary screenshot is taken.
