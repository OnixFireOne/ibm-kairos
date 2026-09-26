// Living docs scaffolded by `kairos init` into docs/kairos/ (SPEC §2.1).
export const KAIROS_DOCS_DIR = 'docs/kairos';
export const PROGRESS_PATH = `${KAIROS_DOCS_DIR}/PROGRESS.md`;
export const DECISIONS_PATH = `${KAIROS_DOCS_DIR}/DECISIONS.md`;

const SPEC = `# Spec

The intent of this project: what it does, why, and the rules the code must follow.
\`kairos check\` compares every change against this file. Keep it short and stable;
task-level detail goes into \`tasks/TNN-<slug>.md\`.

## Goal
What problem this project solves and for whom.

## Scope
- In:
- Out:

## Rules
Business rules, contracts and constraints the code must respect.

## Architecture
Main modules and how they talk to each other.
`;

const PLAN = `# Plan

Status: \`[ ]\` todo, \`[~]\` in progress, \`[x]\` done. Each task gets its own file in
[tasks/](tasks/README.md) when work on it starts. Current state and next step: [HANDOFF.md](HANDOFF.md).

- [ ] **T1 First task.** What it delivers.
`;

const PROGRESS = `# Progress

Append-only dev log, newest last. The \`post-commit\` hook installed by \`kairos init\` adds one entry
per commit (hash, message, files). Agents add a line on why after each task.
`;

const DECISIONS = `# Decisions

Project-wide decisions and trade-offs, newest last. \`kairos fix\` appends how each drift finding
was resolved and which side (intent or code) was the source of truth.
`;

const HANDOFF = `# Handoff

Snapshot for the next session. Any model starts here and continues from "Next step".

## State
What is done and working.

## In progress
The current task and its file in tasks/.

## Next step
1. The very next thing to do.

## Gotchas
Traps, conventions and commands worth knowing.

## Read first
This file, the current task file, PLAN.md, and only the SPEC.md sections the task needs.
`;

const TASKS_README = `# Task files

One file per task from [PLAN.md](../PLAN.md): \`TNN-<slug>.md\`. It holds everything needed to work on
that task without reading the whole history:

\`\`\`
# TNN Title
Status: [ ] todo | [~] in progress | [x] done · Commits: <hashes>

## Goal          what and why, 1–3 lines
## Spec          interfaces, rules, files to create/change
## Decisions     choices made and why (append as they happen)
## Problems      traps hit, bugs, open questions
## Result        tests, follow-ups for later tasks
\`\`\`

\`SPEC.md\` keeps only the stable product picture; task-level detail lives here.
`;

export const LIVING_DOCS: ReadonlyArray<[path: string, content: string]> = [
  [`${KAIROS_DOCS_DIR}/SPEC.md`, SPEC],
  [`${KAIROS_DOCS_DIR}/PLAN.md`, PLAN],
  [PROGRESS_PATH, PROGRESS],
  [DECISIONS_PATH, DECISIONS],
  [`${KAIROS_DOCS_DIR}/HANDOFF.md`, HANDOFF],
  [`${KAIROS_DOCS_DIR}/tasks/README.md`, TASKS_README],
];

/** Agent instruction files that get the pointer block (Claude Code, Codex and others). */
export const POINTER_FILES = ['CLAUDE.md', 'AGENTS.md'] as const;
export const POINTER_START = '<!-- kairos:start -->';
export const POINTER_END = '<!-- kairos:end -->';

export const POINTER_BLOCK = `${POINTER_START}
## Kairos living docs
Before any work read \`docs/kairos/HANDOFF.md\`, then the current task file in \`docs/kairos/tasks/\`,
\`docs/kairos/PLAN.md\` and only the \`docs/kairos/SPEC.md\` sections you need. A new chat may start with
just "continue": pick up from "Next step".
- When a task starts, create \`docs/kairos/tasks/TNN-<slug>.md\` (Goal, Spec, Decisions, Problems, Result).
- After each task: fill its task file, mark it in \`PLAN.md\`, add why to \`PROGRESS.md\`, record
  project-wide choices in \`DECISIONS.md\`.
- If the work contradicts \`SPEC.md\`, stop and ask whether to change the code or the spec.
- Resolving a Kairos drift finding: fix it with the smallest change, append the decision (id, source of
  truth, files, resolution) to \`DECISIONS.md\`, then run \`kairos check\` once to confirm.
- Recommend a new chat only when the next task needs different code and the tree is clean, or the
  session is long. Update \`HANDOFF.md\` first.
${POINTER_END}`;

/** Inserts the pointer block, replacing an existing one between the markers. */
export function upsertPointer(existing: string | undefined): string {
  if (existing === undefined || existing.trim() === '') return `${POINTER_BLOCK}\n`;
  const start = existing.indexOf(POINTER_START);
  const end = existing.indexOf(POINTER_END, start);
  if (start !== -1 && end !== -1) {
    return existing.slice(0, start) + POINTER_BLOCK + existing.slice(end + POINTER_END.length);
  }
  return `${existing.replace(/\n*$/, '')}\n\n${POINTER_BLOCK}\n`;
}

export const HOOK_MARKER = '# kairos:post-commit';

/** `post-commit` hook: log the commit in PROGRESS.md; never fails the commit. */
export function postCommitHook(kairosBin?: string): string {
  const run = kairosBin ? `node "${kairosBin}" progress || kairos progress` : 'kairos progress';
  return `#!/bin/sh
${HOOK_MARKER} (written by kairos init): log this commit in ${PROGRESS_PATH}
{ ${run}; } >/dev/null 2>&1 || true
`;
}
