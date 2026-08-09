#!/usr/bin/env bash
# erp-spec stack digest — SessionStart. Surfaces the two halves of the stack knowledge:
# the curated notes in research-drop/reference/ (CLAUDE.md rule #10) and the cached upstream
# dumps in .claude/docs/ (written by `deno task fetch-llms-docs`).
#
# EVERYTHING PRINTED IS DERIVED FROM THE FILESYSTEM. There is no hand-maintained list of tools
# or filenames here, because that list is exactly what drifts: api-cloudrun's CLAUDE.md has told
# the model to read a `.claude/docs/eta.txt` that its fetcher has never been able to write.
# Add a note, add a source, rename a file — this hook follows without being edited.
#
# Plain stdout, always exit 0. Silent outside erp-spec and on resumed/compacted sessions.
set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$PWD}"
case "$REPO" in
  */erp-spec|*/erp-spec/*) ;;
  *) exit 0 ;;
esac

REF="$REPO/research-drop/reference"
DOCS="$REPO/.claude/docs"
[ -d "$REF" ] || exit 0

# Only fresh sessions — a resume already has this in context.
src="$(cat 2>/dev/null | sed -n 's/.*"source"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
case "$src" in startup|clear|"") ;; *) exit 0 ;; esac

# Title + opening paragraph of one note, flattened to a single line.
summarize() {
  awk '
    !title { if ($0 ~ /^# /) title = substr($0, 3); next }
    !intro { if ($0 ~ /^[[:space:]]*$/) next; intro = $0; next }
    $0 ~ /^[[:space:]]*$/ { exit }
    { intro = intro " " $0 }
    END {
      gsub(/\[\[|\]\]|\*|`/, "", intro)        # wiki-links, bold/italic, code ticks
      gsub(/[[:space:]]+/, " ", intro)
      if (length(intro) > 132) { intro = substr(intro, 1, 132); sub(/ [^ ]*$/, "", intro); intro = intro " …" }
      print intro
    }
  ' "$1"
}

# Notes ordered by size — a proxy for how much project-specific material the tool has
# accumulated, and derived rather than a ranking someone has to maintain.
notes="$(ls -S "$REF"/*.md 2>/dev/null | grep -v '/README\.md$')"
[ -n "$notes" ] || exit 0

body=""
for f in $notes; do
  base="$(basename "$f" .md)"
  cached=""
  for d in "$DOCS/$base"*.txt; do
    [ -e "$d" ] || continue
    kb=$(( ( $(wc -c < "$d") + 512 ) / 1024 ))
    cached="$cached $(basename "$d") ${kb}K,"
  done
  cached="${cached%,}"
  [ -n "$cached" ] && cached=" [cached:${cached}]"
  body="$body  • ${base}.md${cached} — $(summarize "$f")
"
done

warn=""
if [ ! -f "$DOCS/MANIFEST.txt" ]; then
  warn="  ⚠ no upstream stack docs cached yet — run: deno task fetch-llms-docs"
else
  missing=""
  while IFS="$(printf '\t')" read -r file _url _bytes _day; do
    case "$file" in \#*|"") continue ;; esac
    [ -f "$DOCS/$file" ] || missing="$missing $file"
  done < "$DOCS/MANIFEST.txt"
  [ -n "$missing" ] && warn="  ⚠ cached doc(s) missing despite the manifest:$missing — run: deno task fetch-llms-docs"
  # A dump older than a week is upstream drift nobody has looked at.
  if [ -z "$warn" ] && [ -n "$(find "$DOCS/MANIFEST.txt" -mtime +7 2>/dev/null)" ]; then
    warn="  ⚠ cached stack docs are >7 days old — run: deno task fetch-llms-docs"
  fi
fi

printf 'ℹ️  CFS ERP stack notes — read the note before writing spec that touches the tool\n'
printf '   (research-drop/reference/ · upstream dumps cached in .claude/docs/)\n'
printf '%s' "$body"
[ -n "$warn" ] && printf '%s\n' "$warn"
exit 0
