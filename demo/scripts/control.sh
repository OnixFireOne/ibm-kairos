#!/usr/bin/env bash
# Control commit: a doc typo fix. Kairos must report no drift for it.
source "$(dirname "$0")/_lib.sh"
in_demo
replace docs/SPEC.md 'retreive' 'retrieve'
commit "Fix a typo in the spec"
