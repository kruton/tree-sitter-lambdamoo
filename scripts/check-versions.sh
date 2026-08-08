#!/usr/bin/env bash
set -euo pipefail

# Ensure we are in repository root
REPOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPOS_DIR"

EXPECTED_TAG=""
AUTO_FIX=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fix)
      AUTO_FIX=true
      shift
      ;;
    --tag|--version)
      EXPECTED_TAG="$2"
      shift 2
      ;;
    *)
      if [[ "$1" == --* ]]; then
        echo "Unknown option: $1"
        exit 1
      fi
      EXPECTED_TAG="$1"
      shift
      ;;
  esac
done

# Infer tag/expected version from GitHub Actions or environment if not explicitly passed
if [[ -z "$EXPECTED_TAG" ]]; then
  if [[ "${GITHUB_REF_TYPE:-}" == "tag" && -n "${GITHUB_REF_NAME:-}" ]]; then
    EXPECTED_TAG="$GITHUB_REF_NAME"
  elif [[ "${GITHUB_REF:-}" == refs/tags/* ]]; then
    EXPECTED_TAG="${GITHUB_REF#refs/tags/}"
  elif [[ -n "${TAG:-}" ]]; then
    EXPECTED_TAG="$TAG"
  fi
fi

CLEAN_TAG="${EXPECTED_TAG#v}"

# Extract versions from manifest, lock, and generated parser files
PKG_VER=$(jq -r '.version // empty' package.json 2>/dev/null || echo "")
PKG_LOCK_VER1=$(jq -r '.version // empty' package-lock.json 2>/dev/null || echo "")
PKG_LOCK_VER2=$(jq -r '.packages[""].version // empty' package-lock.json 2>/dev/null || echo "")
TS_VER=$(jq -r '.metadata.version // .version // empty' tree-sitter.json 2>/dev/null || echo "")
CARGO_VER=$(sed -n -E 's/^version = "(.*)"/\1/p' Cargo.toml 2>/dev/null | head -n1 || echo "")
CARGO_LOCK_VER=$(awk '/^name = "tree-sitter-lambdamoo"/ { found=1 } found && /^version = / { gsub(/"/, "", $3); print $3; exit }' Cargo.lock 2>/dev/null || echo "")

PARSER_MAJOR=$(sed -n -E 's/.*\.major_version = ([0-9]+).*/\1/p' src/parser.c 2>/dev/null | head -n1 || echo "")
PARSER_MINOR=$(sed -n -E 's/.*\.minor_version = ([0-9]+).*/\1/p' src/parser.c 2>/dev/null | head -n1 || echo "")
PARSER_PATCH=$(sed -n -E 's/.*\.patch_version = ([0-9]+).*/\1/p' src/parser.c 2>/dev/null | head -n1 || echo "")
if [[ -n "$PARSER_MAJOR" && -n "$PARSER_MINOR" && -n "$PARSER_PATCH" ]]; then
  PARSER_VER="${PARSER_MAJOR}.${PARSER_MINOR}.${PARSER_PATCH}"
else
  PARSER_VER=""
fi

MISMATCH=false

if [[ -z "$PKG_VER" || "$PKG_LOCK_VER1" != "$PKG_VER" || "$PKG_LOCK_VER2" != "$PKG_VER" || "$TS_VER" != "$PKG_VER" || "$CARGO_VER" != "$PKG_VER" || "$CARGO_LOCK_VER" != "$PKG_VER" || "$PARSER_VER" != "$PKG_VER" ]]; then
  MISMATCH=true
fi

if [[ -n "$CLEAN_TAG" && "$PKG_VER" != "$CLEAN_TAG" ]]; then
  MISMATCH=true
fi

if [[ "$MISMATCH" == "true" ]]; then
  if [[ "$AUTO_FIX" == "true" ]]; then
    TARGET_VER="${CLEAN_TAG:-$PKG_VER}"
    echo "Attempting to fix version mismatches (target: ${TARGET_VER})..."
    npx tree-sitter version "$TARGET_VER"
    npx tree-sitter generate >/dev/null 2>&1 || true
    npm install --legacy-peer-deps --package-lock-only >/dev/null 2>&1 || true
    cargo check >/dev/null 2>&1 || true
    
    # Re-verify after fix
    PKG_VER=$(jq -r '.version // empty' package.json 2>/dev/null || echo "")
    PKG_LOCK_VER1=$(jq -r '.version // empty' package-lock.json 2>/dev/null || echo "")
    PKG_LOCK_VER2=$(jq -r '.packages[""].version // empty' package-lock.json 2>/dev/null || echo "")
    TS_VER=$(jq -r '.metadata.version // .version // empty' tree-sitter.json 2>/dev/null || echo "")
    CARGO_VER=$(sed -n -E 's/^version = "(.*)"/\1/p' Cargo.toml 2>/dev/null | head -n1 || echo "")
    CARGO_LOCK_VER=$(awk '/^name = "tree-sitter-lambdamoo"/ { found=1 } found && /^version = / { gsub(/"/, "", $3); print $3; exit }' Cargo.lock 2>/dev/null || echo "")
    
    PARSER_MAJOR=$(sed -n -E 's/.*\.major_version = ([0-9]+).*/\1/p' src/parser.c 2>/dev/null | head -n1 || echo "")
    PARSER_MINOR=$(sed -n -E 's/.*\.minor_version = ([0-9]+).*/\1/p' src/parser.c 2>/dev/null | head -n1 || echo "")
    PARSER_PATCH=$(sed -n -E 's/.*\.patch_version = ([0-9]+).*/\1/p' src/parser.c 2>/dev/null | head -n1 || echo "")
    if [[ -n "$PARSER_MAJOR" && -n "$PARSER_MINOR" && -n "$PARSER_PATCH" ]]; then
      PARSER_VER="${PARSER_MAJOR}.${PARSER_MINOR}.${PARSER_PATCH}"
    else
      PARSER_VER=""
    fi

    MISMATCH=false
    if [[ "$PKG_LOCK_VER1" != "$PKG_VER" || "$PKG_LOCK_VER2" != "$PKG_VER" || "$TS_VER" != "$PKG_VER" || "$CARGO_VER" != "$PKG_VER" || "$CARGO_LOCK_VER" != "$PKG_VER" || "$PARSER_VER" != "$PKG_VER" ]]; then
      MISMATCH=true
    fi
    if [[ -n "$CLEAN_TAG" && "$PKG_VER" != "$CLEAN_TAG" ]]; then
      MISMATCH=true
    fi

    if [[ "$MISMATCH" == "true" ]]; then
      echo "❌ Auto-fix failed to sync all version files."
    else
      echo "✅ Versions successfully synchronized to $PKG_VER."
    fi
  fi
fi

if [[ "$MISMATCH" == "true" ]]; then
  echo "❌ Version mismatch detected!"
  if [[ -n "$CLEAN_TAG" ]]; then
    echo "  Git tag:             ${EXPECTED_TAG} (expected version: ${CLEAN_TAG})"
  fi
  echo "  package.json:        ${PKG_VER:-<missing>}"
  echo "  package-lock.json:   ${PKG_LOCK_VER1:-<missing>} (packages[\"\"]: ${PKG_LOCK_VER2:-<missing>})"
  echo "  tree-sitter.json:    ${TS_VER:-<missing>}"
  echo "  Cargo.toml:          ${CARGO_VER:-<missing>}"
  echo "  Cargo.lock:          ${CARGO_LOCK_VER:-<missing>}"
  echo "  src/parser.c:        ${PARSER_VER:-<missing>}"
  echo ""
  if [[ -n "$CLEAN_TAG" && "$PKG_VER" != "$CLEAN_TAG" ]]; then
    echo "The git tag version (${CLEAN_TAG}) does not match the project version (${PKG_VER:-<missing>})."
  fi
  echo "Please ensure all versions match. You can fix this by running:"
  if [[ -n "$CLEAN_TAG" ]]; then
    echo "  npx tree-sitter version $CLEAN_TAG"
  else
    echo "  npx tree-sitter version <version>"
  fi
  echo "  or: npm run check-versions -- --fix"
  exit 1
fi

# Check for unstaged lockfile/manifest/parser changes if version files are staged
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  STAGED=$(git diff --cached --name-only 2>/dev/null || echo "")
  UNSTAGED=$(git diff --name-only 2>/dev/null || echo "")
  
  VERSION_FILES=("package.json" "package-lock.json" "Cargo.toml" "Cargo.lock" "tree-sitter.json" "src/parser.c")
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
    echo "Please stage all updated lock files, manifest files, and src/parser.c (e.g. git add package-lock.json Cargo.lock src/parser.c)."
    exit 1
  fi
fi

if [[ -n "$CLEAN_TAG" ]]; then
  echo "✅ All version files (package.json, package-lock.json, tree-sitter.json, Cargo.toml, Cargo.lock, src/parser.c) match git tag ${EXPECTED_TAG} (${PKG_VER})."
else
  echo "✅ All version files (package.json, package-lock.json, tree-sitter.json, Cargo.toml, Cargo.lock, src/parser.c) are consistent (${PKG_VER})."
fi
