#!/bin/bash

# Download Mooneye GM ROMs from https://gekkio.fi/files/mooneye-test-suite/mts-20240926-1737-443f6e1/mts-20240926-1737-443f6e1.tar.xz
# Extract them to the "roms/mooneye-test-suite" directory.

set -euo pipefail

URL="https://gekkio.fi/files/mooneye-test-suite/mts-20240926-1737-443f6e1/mts-20240926-1737-443f6e1.tar.xz"
ARCHIVE_DIR_NAME="mts-20240926-1737-443f6e1"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
DEST_DIR="${REPO_ROOT}/roms/mooneye-test-suite"

command -v curl >/dev/null 2>&1 || { echo "curl is required but not installed." >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is required but not installed." >&2; exit 1; }

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf -- "${TMP_DIR}"
}
trap cleanup EXIT

echo "Downloading Mooneye test suite..."
curl -L "${URL}" -o "${TMP_DIR}/mooneye.tar.xz"

echo "Extracting archive..."
tar -xf "${TMP_DIR}/mooneye.tar.xz" -C "${TMP_DIR}"

SOURCE_DIR="${TMP_DIR}/${ARCHIVE_DIR_NAME}"
if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Expected directory ${ARCHIVE_DIR_NAME} not found in archive." >&2
  exit 1
fi

echo "Preparing destination at ${DEST_DIR}..."
rm -rf -- "${DEST_DIR}"
mkdir -p -- "${DEST_DIR}"

echo "Copying ROMs..."
cp -a "${SOURCE_DIR}/." "${DEST_DIR}/"

echo "Done. ROMs available in ${DEST_DIR}"
