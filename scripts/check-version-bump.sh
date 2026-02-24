#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-origin/main}"

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "[version-check] Basis-Ref '$BASE_REF' nicht gefunden – Prüfung wird übersprungen."
  exit 0
fi

APP_FILES_REGEX='^(README\.md|assets/|service-worker\.js|manifest\.webmanifest)'
CHANGED_FILES="$(git diff --name-only "$BASE_REF"...HEAD)"

if ! printf '%s\n' "$CHANGED_FILES" | rg -q "$APP_FILES_REGEX"; then
  echo "[version-check] Keine relevanten App-Änderungen erkannt."
  exit 0
fi

if git diff --quiet "$BASE_REF"...HEAD -- README.md; then
  echo "[version-check] Fehler: App-Dateien wurden geändert, aber README.md (mit app-version Meta-Tag) nicht."
  exit 1
fi

if git diff "$BASE_REF"...HEAD -- README.md | rg -q '^[+-].*meta name="app-version" content="[0-9]+\.[0-9]+\.[0-9]+"'; then
  echo "[version-check] OK: app-version wurde angepasst."
  exit 0
fi

echo "[version-check] Fehler: App-Dateien wurden geändert, aber die Versionsnummer im Meta-Tag wurde nicht angepasst."
exit 1
