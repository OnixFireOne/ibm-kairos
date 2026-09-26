# Shared helpers for the demo scripts. Source it, don't run it.
set -euo pipefail
KAIROS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_SRC="$KAIROS_ROOT/demo/orders-api"
DEMO_DIR="${KAIROS_DEMO_DIR:-$KAIROS_ROOT/demo/.work/orders-api}"

in_demo() {
  [[ -d "$DEMO_DIR/.git" ]] || { echo "No demo repo at $DEMO_DIR, run demo/scripts/reset.sh first" >&2; exit 1; }
  cd "$DEMO_DIR"
}

# replace <file> <old> <new>: literal replace, fails if <old> is missing.
replace() {
  OLD="$2" NEW="$3" perl -0pi -e 'my $n = s/\Q$ENV{OLD}\E/$ENV{NEW}/g; die "pattern not found\n" unless $n' "$1" \
    || { echo "replace failed in $1" >&2; exit 1; }
}

commit() {
  git add -A
  git -c user.name="Dev" -c user.email="dev@orders.example" commit -q -m "$1"
  echo "committed: $1 ($(git rev-parse --short HEAD))"
}
