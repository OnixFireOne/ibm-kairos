# Bob sessions

Evidence of IBM Bob usage, as required by the hackathon guide.

- `kairos_taskXX_<description>.png`: Bob IDE task consumption summaries (Tasks → open task → click the header).
- `cli/`: raw `bob run --format json` outputs from Bob Shell.

| Task | Tool | What Bob did | Bobcoins | Screenshot |
|---|---|---|---|---|
| 00 | Bob Shell (`bob run`, ask) | Probe: API key auth works headless | 0.011 | — |
| 01 | Bob Shell (`bob run`, agent) | Fixed `fileRegex` quoting in `.bob/custom_modes.yaml` so the `kairos-fix` mode loads | 0.211 | [kairos_task01_custom_modes.png](kairos_task01_custom_modes.png) |
| 01b | Bob Shell (`bob run`, `kairos` mode) | Verified the custom `kairos` mode loads | 0.010 | — |
| 02 | Bob Shell (`bob run`, agent) | Implemented the git diff collector (`packages/cli/src/collector/diff.ts`) against tests written first by Claude Code; 22/22 green | 1.293 | [kairos_task02_diff_collector.png](kairos_task02_diff_collector.png) |
| 03 | Bob Shell (`bob run`, agent) | Implemented intent context selection (`packages/cli/src/context/{glob,sections,intent,select}.ts`) against tests written first by Claude Code. Hit the 2.00 cost cap while chasing a wrong expectation in Claude's test (a missed match on line 30 of a fixture); the implementation itself was correct. Claude fixed the test and reverted Bob's last workaround; 55/55 green | 2.082 | `kairos_task03_context_selection.png` |

## How Bob is driven during development

Development is orchestrated from **Claude Code**, which calls **IBM Bob Shell headless** (`scripts/bob-task.sh` → `bob run --format json`) for Bob tasks. This is the same path the product's `BobEngine` uses, so every dev task also tests Kairos's runtime integration with Bob (auth, modes, JSON output, cost caps).

- Prompts: `prompts/<task>.txt`. Raw results: `cli/<timestamp>-<task>.json` (status, task id, Bobcoins, tool calls, final message).
- Bob Shell and Bob IDE share task history on the same machine, so each task also appears in Bob IDE → Tasks, where the consumption summary screenshot is taken.
