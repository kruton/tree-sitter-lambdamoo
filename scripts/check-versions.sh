#!/usr/bin/env bash
set -euo pipefail

# Ensure we are in repository root
REPOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPOS_DIR"

AUTO_FIX=false
if [[ "${1:-}" == "--fix" ]]; then
  AUTO_FIX=true
fi

# Extract versions from manifest and lock files
PKG_VER=$(jq -r '.version // empty' package.json 2>/dev/null || echo "")
PKG_LOCK_VER1=$(jq -r '.version // empty' package-lock.json 2>/dev/null || echo "")
PKG_LOCK_VER2=$(jq -r '.packages[""].version // empty' package-lock.json 2>/dev/null || echo "")
TS_VER=$(jq -r '.metadata.version // .version // empty' tree-sitter.json 2>/dev/null || echo "")
CARGO_VER=$(sed -n -E 's/^version = "(.*)"/\1/p' Cargo.toml 2>/dev/null | head -n1 || echo "")
CARGO_LOCK_VER=$(awk '/^name = "tree-sitter-lambdamoo"/ { found=1 } found && /^version = / { gsub(/"/, "", $3); print $3; exit }' Cargo.lock 2>/dev/null || echo "")

MISMATCH=false

if [[ -z "$PKG_VER" || "$PKG_LOCK_VER1" != "$PKG_VER" || "$PKG_LOCK_VER2" != "$PKG_VER" || "$TS_VER" != "$PKG_VER" || "$CARGO_VER" != "$PKG_VER" || "$CARGO_LOCK_VER" != "$PKG_VER" ]]; then
  MISMATCH=true
fi

if [[ "$MISMATCH" == "true" ]]; then
  if [[ "$AUTO_FIX" == "true" ]]; then
    echo "Attempting to fix version mismatches using 'tree-sitter version $PKG_VER'..."
    npx tree-sitter version "$PKG_VER"
    npm install --legacy-peer-deps --package-lock-only >/dev/null 2>&1 || true
    cargo check >/dev/null 2>&1 || true
    
    # Re-verify after fix
    PKG_LOCK_VER1=$(jq -r '.version // empty' package-lock.json 2>/dev/null || echo "")
    PKG_LOCK_VER2=$(jq -r '.packages[""].version // empty' package-lock.json 2>/dev/null || echo "")
    TS_VER=$(jq -r '.metadata.version // .version // empty' tree-sitter.json 2>/dev/null || echo "")
    CARGO_VER=$(sed -n -E 's/^version = "(.*)"/\1/p' Cargo.toml 2>/dev/null | head -n1 || echo "")
    CARGO_LOCK_VER=$(awk '/^name = "tree-sitter-lambdamoo"/ { found=1 } found && /^version = / { gsub(/"/, "", $3); print $3; exit }' Cargo.lock 2>/dev/null || echo "")

    if [[ "$PKG_LOCK_VER1" != "$PKG_VER" || "$PKG_LOCK_VER2" != "$PKG_VER" || "$TS_VER" != "$PKG_VER" || "$CARGO_VER" != "$PKG_VER" || "$CARGO_LOCK_VER" != "$PKG_VER" ]]; then
      echo "❌ Auto-fix failed to sync all version files."
      MISMATCH=true
    else
      echo "✅ Versions successfully synchronized to $PKG_VER."
      MISMATCH=false
    fi
  fi
fi

if [[ "$MISMATCH" == "true" ]]; then
  echo "❌ Version mismatch detected across manifest and lock files!"
  echo "  package.json:        ${PKG_VER:-<missing>}"
  echo "  package-lock.json:   ${PKG_LOCK_VER1:-<missing>} (packages[\"\"]: ${PKG_LOCK_VER2:-<missing>})"
  echo "  tree-sitter.json:    ${TS_VER:-<missing>}"
  echo "  Cargo.toml:          ${CARGO_VER:-<missing>}"
  echo "  Cargo.lock:          ${CARGO_LOCK_VER:-<missing>}"
  echo ""
  echo "Please ensure all versions match. You can fix this by running:"
  echo "  npx tree-sitter version <version>"
  echo "  or: npm run check-versions -- --fix"
  exit 1
fi

# Check for unstaged lockfile/manifest changes if version files are staged
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  STAGED=$(git diff --cached --name-only 2>/dev/null || echo "")
  UNSTAGED=$(git diff --name-only 2>/dev/null || echo "")
  
  VERSION_FILES=("package.json" "package-lock.json" "Cargo.toml" "Cargo.lock" "tree-sitter.json")
  STAGED_VER_FILES=()
  UNSTAGED_VER_FILES=()

  for f in "${VERSION_FILES[@]}"; do
    if echo "$STAGED" | grep -q "^${f}$"; then
      STAGED_VER_FILES+=("$f")
    fi
    if echo "$UNSTAGED" | grep -q "^${f}$"; then
      UNSTAGED_VER_FILES+=("$f")
    fi
  done

  if [[ ${#STAGED_VER_FILES[@]} -gt 0 && ${#UNSTAGED_VER_FILES[@]} -gt 0 ]]; then
    echo "❌ Unstaged version file changes detected!"
    echo "The following version files are staged for commit:"
    for f in "${STAGED_VER_FILES[@]}"; do echo "  - $f"; done
    echo "However, the following version files have unstaged changes:"
    for f in "${UNSTAGED_VER_FILES[@]}"; do echo "  - $f"; done
    echo ""
    echo "Please stage all updated lock files and manifest files (e.g. git add package-lock.json Cargo.lock)."
    exit 1
  fi
fi

echo "✅ All version files (package.json, package-lock.json, tree-sitter.json, Cargo.toml, Cargo.lock) are consistent (${PKG_VER})."
