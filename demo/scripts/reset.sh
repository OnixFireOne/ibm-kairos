#!/usr/bin/env bash
# Recreates the demo repo: baseline on `main`, then branch `feature/orders-update` for the drift commits.
# Usage: demo/scripts/reset.sh [--install]   (KAIROS_DEMO_DIR overrides the location)
source "$(dirname "$0")/_lib.sh"

rm -rf "$DEMO_DIR"
mkdir -p "$DEMO_DIR"
(cd "$DEMO_SRC" && tar --exclude node_modules --exclude .kairos/cache --exclude .kairos/runs -cf - .) \
  | (cd "$DEMO_DIR" && tar -xf -)
mkdir -p "$DEMO_DIR/.bob"
cp "$KAIROS_ROOT/.bob/custom_modes.yaml" "$DEMO_DIR/.bob/custom_modes.yaml"

cd "$DEMO_DIR"
git init -q -b main
commit "orders-api: create and read orders"
git checkout -q -b feature/orders-update

if [[ "${1:-}" == "--install" ]]; then
  pnpm install --frozen-lockfile --silent
fi
echo "demo repo ready at $DEMO_DIR (branch feature/orders-update, base main)"
