#!/usr/bin/env bash
# Packs dist/Dopamine.app into dist/Dopamine-mac.dmg with the drag-to-Applications window.
# Needs dmgbuild (pip install dmgbuild). Run scripts/bundle.sh first.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
APP="$ROOT/dist/Dopamine.app"
DMG="$ROOT/dist/Dopamine-mac.dmg"

[[ -d "$APP" ]] || { echo "Missing $APP — run scripts/bundle.sh first" >&2; exit 1; }
command -v dmgbuild >/dev/null || { echo "dmgbuild not found — pip install dmgbuild" >&2; exit 1; }

echo "▸ Packing $DMG"
rm -f "$DMG"
dmgbuild -s scripts/dmg-settings.py \
  -D app="$APP" \
  -D background="$ROOT/Resources/dmg/background.png" \
  Dopamine "$DMG"
hdiutil verify "$DMG" >/dev/null
echo "✓ $DMG"
