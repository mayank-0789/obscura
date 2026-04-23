#!/usr/bin/env bash
#
# Rename an npm scope across the monorepo. Updates package.json names,
# workspace dependency declarations, source imports, docs, and examples.
#
# Usage:
#   scripts/rename-scope.sh                          # dry run (default)
#   scripts/rename-scope.sh --apply                  # make the changes
#   scripts/rename-scope.sh --apply OLD NEW          # custom scopes
#
# Default rename: @payrail  →  @payrail-app
#
# What is NOT touched:
#   - node_modules/, dist/, .turbo/, .next/, .git/   (build/cache/VCS)
#   - pnpm-lock.yaml                                  (regenerate via pnpm install)
#
# After running:
#   1. pnpm install              # refresh lock + workspace links
#   2. pnpm check-types          # verify nothing broke
#   3. pnpm build                # rebuild SDKs (dist/ had stale strings)

set -euo pipefail

# Defaults. Override via positional args after --apply.
OLD_SCOPE="${2:-@payrail}"
NEW_SCOPE="${3:-@payrail-app}"
MODE="${1:-dry}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# File types to scan. Keep narrow — we only want source + config + docs.
INCLUDES=(
  --include='*.ts' --include='*.tsx'
  --include='*.mjs' --include='*.js'
  --include='*.json' --include='*.jsonc'
  --include='*.md' --include='*.mdx'
  --include='*.yaml' --include='*.yml'
)

EXCLUDES=(
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=.turbo
  --exclude-dir=.next
  --exclude-dir=build
  --exclude-dir=.git
  --exclude=pnpm-lock.yaml
)

# Pattern — match "@<scope>/" with trailing slash so we don't false-match
# e.g. an email address or a token like "@payrail org".
pattern="${OLD_SCOPE}/"

# File list: everything that contains the scope reference. Uses a while-read
# loop instead of mapfile so this works on macOS bash 3.2 (no mapfile).
files=()
while IFS= read -r line; do
  files+=("$line")
done < <(grep -rln "$pattern" . "${INCLUDES[@]}" "${EXCLUDES[@]}" 2>/dev/null || true)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No files reference ${pattern}. Nothing to do."
  exit 0
fi

echo "Found ${#files[@]} files referencing ${pattern}"

if [[ "$MODE" != "--apply" ]]; then
  echo ""
  echo "Dry run. Files that would change:"
  printf '  %s\n' "${files[@]}"
  echo ""
  echo "Rerun with --apply to make the changes."
  exit 0
fi

echo "Applying rename: ${OLD_SCOPE}/  →  ${NEW_SCOPE}/"
echo ""

# macOS (BSD) sed requires `-i ''`; GNU sed uses plain `-i`.
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i '')
fi

for f in "${files[@]}"; do
  sed "${SED_INPLACE[@]}" "s|${OLD_SCOPE}/|${NEW_SCOPE}/|g" "$f"
  echo "  ✓ $f"
done

echo ""
echo "Done. Next steps:"
echo "  1. pnpm install"
echo "  2. pnpm check-types"
echo "  3. pnpm --filter ${NEW_SCOPE}/sdk build"
echo "  4. pnpm --filter ${NEW_SCOPE}/merchant-sdk build"
