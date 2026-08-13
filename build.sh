#!/usr/bin/env bash
# Local package build: clean → build aion-core → package aion-app with that binary.
#
# Usage (from repo root):
#   ./build.sh                 # core release + current-platform app installer
#   ./build.sh release         # same (default)
#   ./build.sh debug           # core debug + app installer (larger / slower)
#   ./build.sh release mac-arm64
#   ./build.sh release mac-x64
#   ./build.sh release win
#   ./build.sh release linux
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_ROOT="${ROOT}/aion-core"
APP_ROOT="${ROOT}/aion-app"

PROFILE="${1:-release}"
TARGET="${2:-auto}"

case "${PROFILE}" in
  debug|release) ;;
  *)
    echo "Usage: $0 [debug|release] [auto|mac-arm64|mac-x64|win|linux]" >&2
    exit 1
    ;;
esac

BINARY="${CORE_ROOT}/target/${PROFILE}/aioncore"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) BINARY="${BINARY}.exe" ;;
esac

if [ "${TARGET}" = "auto" ]; then
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "${OS}" in
    Darwin)
      if [ "${ARCH}" = "arm64" ]; then
        TARGET="mac-arm64"
      else
        TARGET="mac-x64"
      fi
      ;;
    Linux)
      TARGET="linux"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      TARGET="win"
      ;;
    *)
      echo "Unsupported host OS: ${OS}. Pass an explicit target." >&2
      exit 1
      ;;
  esac
fi

case "${TARGET}" in
  mac-arm64) APP_SCRIPT="build-mac:arm64" ;;
  mac-x64)   APP_SCRIPT="build-mac:x64" ;;
  win)       APP_SCRIPT="build-win" ;;
  linux)     APP_SCRIPT="build-deb" ;;
  *)
    echo "Unknown target: ${TARGET}" >&2
    echo "Usage: $0 [debug|release] [auto|mac-arm64|mac-x64|win|linux]" >&2
    exit 1
    ;;
esac

echo "==> [0/3] Cleaning previous app package artifacts..."
# Keep aion-core/target so Cargo can reuse deps / incremental cache.
# Only wipe previous installer outputs and the bundled aioncore copy.
rm -rf "${APP_ROOT}/out" "${APP_ROOT}/dist" \
  "${APP_ROOT}/resources/bundled-aioncore"

echo "==> [1/3] Building aion-core (${PROFILE})..."
if [ "${PROFILE}" = "release" ]; then
  (cd "${CORE_ROOT}" && cargo build --release -p aionui-app)
else
  (cd "${CORE_ROOT}" && cargo build -p aionui-app)
fi

if [ ! -f "${BINARY}" ]; then
  echo "Missing binary: ${BINARY}" >&2
  exit 1
fi

echo "==> [2/3] Packaging aion-app (${TARGET}) with local aioncore:"
echo "    ${BINARY}"
export AIONUI_BACKEND_LOCAL_BINARY="${BINARY}"
(
  cd "${APP_ROOT}"
  bun run "${APP_SCRIPT}"
)

echo "==> [3/3] Build finished."
echo "    aioncore: ${BINARY}"

case "${TARGET}" in
  mac-arm64|mac-x64)
    APP_BUNDLE="$(find "${APP_ROOT}/out" -maxdepth 3 -name 'AionUi.app' -type d 2>/dev/null | head -n 1 || true)"
    if [ -n "${APP_BUNDLE}" ]; then
      echo "    .app:     ${APP_BUNDLE}"
    else
      echo "    .app:     not found under ${APP_ROOT}/out" >&2
    fi
    ;;
  win)
    echo "    installers:"
    find "${APP_ROOT}/out" -maxdepth 1 -type f -name '*.exe' 2>/dev/null | sed 's/^/      /' || true
    find "${APP_ROOT}/out" -maxdepth 1 -type f -name '*.msi' 2>/dev/null | sed 's/^/      /' || true
    ;;
  linux)
    echo "    packages:"
    find "${APP_ROOT}/out" -maxdepth 1 -type f -name '*.deb' 2>/dev/null | sed 's/^/      /' || true
    ;;
esac

if [ -d "${APP_ROOT}/out" ]; then
  echo "    out dir:  ${APP_ROOT}/out"
fi
