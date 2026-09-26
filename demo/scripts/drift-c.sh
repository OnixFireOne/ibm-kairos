#!/usr/bin/env bash
# Drift C (STALE_DOC): DB_URL is renamed to DATABASE_URL; README and SPEC still say DB_URL.
source "$(dirname "$0")/_lib.sh"
in_demo
replace src/config.ts 'process.env.DB_URL' 'process.env.DATABASE_URL'
replace src/config.ts "'DB_URL is required'" "'DATABASE_URL is required'"
commit "Use the platform-standard DATABASE_URL"
