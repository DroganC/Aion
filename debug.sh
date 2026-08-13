#!/usr/bin/env bash
# Local debug: build aion-core (debug), wire it into aion-app, then start Electron.
#
# Usage (from repo root):
#   ./debug.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_ROOT="${ROOT}/aion-core"
APP_ROOT="${ROOT}/aion-app"
BINARY="${CORE_ROOT}/target/debug/aioncore"

echo "==> [1/3] Building aion-core (debug)..."
(cd "${CORE_ROOT}" && cargo build -p aionui-app)

if [[ ! -f "${BINARY}" ]]; then
  echo "Missing binary: ${BINARY}" >&2
  exit 1
fi

echo "==> [2/3] Preparing aion-app to use local aioncore..."
echo "    ${BINARY}"
(cd "${APP_ROOT}" && AIONUI_BACKEND_LOCAL_BINARY="${BINARY}" node scripts/prepareAioncore.js)

echo "==> [3/3] Starting aion-app (bun start)..."
cd "${APP_ROOT}"
exec bun start
