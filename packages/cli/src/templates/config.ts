export const CONFIG_TEMPLATE = `# Kairos config. See https://github.com/OnixFireOne/ibm-kairos
base: origin/main       # git ref to diff against
intent:                 # where the intent lives
  - docs/**/*.md
  - adr/**/*.md
  - openapi.yaml
  - README.md
tests: ["**/*.test.ts"]
map: {}                 # e.g. "src/pricing/**": ["docs/SPEC.md#Pricing"]
failOn: medium          # exit 1 if any finding >= this severity
minConfidence: 0.6      # drop findings below this confidence
budget:
  maxCost: 2            # Bobcoins per run
  maxTurns: 8
  maxContextChars: 60000
engine: bob             # bob | mock
`;
