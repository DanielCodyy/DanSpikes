#!/usr/bin/env bash
# ================================================================
# optimize-assets.sh
# Converts PNG source files in /assistant/source/ to WebP runtime
# files in /assistant/ using ImageMagick.
#
# REQUIREMENTS:
#   ImageMagick v7+ (magick command) or v6 (convert command)
#
# USAGE:
#   Run from the project root:
#     bash assistant/optimize-assets.sh
#
# OUTPUT:
#   assistant/character_idle.webp
#   assistant/character_talk.webp
#   assistant/character_mocking.webp
#   assistant/character_surprised.webp
#   assistant/character_thinking.webp
#   assistant/character_peek.webp
#   assistant/character_bored.webp
#
# QUALITY:
#   WebP quality 85, alpha quality 90, 1024x1024 max, transparent.
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/source"
OUT_DIR="$SCRIPT_DIR"
QUALITY=85
SIZE="1024x1024"

NAMES=(
  character_idle
  character_talk
  character_mocking
  character_surprised
  character_thinking
  character_peek
  character_bored
)

# Detect ImageMagick command
if command -v magick &>/dev/null; then
  MAGICK="magick"
elif command -v convert &>/dev/null; then
  MAGICK="convert"
else
  echo "ERROR: ImageMagick not found. Install it from https://imagemagick.org/"
  exit 1
fi

echo "Using: $($MAGICK --version | head -1)"
echo "Source: $SRC_DIR"
echo "Output: $OUT_DIR"
echo ""

CONVERTED=0
SKIPPED=0

for NAME in "${NAMES[@]}"; do
  SRC="$SRC_DIR/${NAME}.png"
  OUT="$OUT_DIR/${NAME}.webp"

  if [ ! -f "$SRC" ]; then
    echo "  SKIP  ${NAME}.png — not found in source/"
    ((SKIPPED++))
    continue
  fi

  echo -n "  Converting ${NAME}.png → ${NAME}.webp ... "
  "$MAGICK" "$SRC" \
    -resize "${SIZE}>" \
    -define webp:lossless=false \
    -define webp:alpha-quality=90 \
    -quality "$QUALITY" \
    "$OUT"
  SIZE_KB=$(du -k "$OUT" | cut -f1)
  echo "done (${SIZE_KB}K)"
  ((CONVERTED++))
done

echo ""
echo "Converted: $CONVERTED  |  Skipped: $SKIPPED"
echo "WebP files are in: $OUT_DIR"
