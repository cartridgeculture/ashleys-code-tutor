#!/bin/bash
# Renders Resources/AppIcon.icns (the pixel "ACT", purple and yellow) with tools/make_icon.py.
# The first icon, "Original" in Preferences, is Resources/OriginalIcon.png (tools/make_original_icon.swift).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -I tools/make_icon.py
