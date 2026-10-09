#!/bin/sh
# Handoff notes live on origin's `handoffs` branch: an orphan branch that holds only
# notes, never merges into main and deploys nothing. Local and cloud sessions read and
# write the same branch through this script, and the working branch is never touched:
# notes are committed with plumbing on a private index, so no commit hook runs, and
# .githooks/pre-push skips the gates for a push that updates only this branch.
#
#   sh notes.sh publish <file>   add or replace the note (by file name) and push
#   sh notes.sh list             unresumed notes, newest first, with their header line
#   sh notes.sh get <name>       copy a note to .prompts/handoffs/<name>
#   sh notes.sh mark <name>      append a Resumed: line to that copy and publish it
set -eu

BRANCH=handoffs
REF=refs/remotes/origin/$BRANCH
LOCAL=.prompts/handoffs

cd "$(git rev-parse --show-toplevel)"

# An explicit refspec, so a single-branch clone fetches it too.
fetch() {
  git fetch -q origin "+refs/heads/$BRANCH:$REF" 2>/dev/null
}

tip() {
  git rev-parse -q --verify "$REF^{commit}" || true
}

publish() {
  file=$1
  [ -f "$file" ] || { echo "notes.sh: no such file: $file" >&2; exit 1; }
  name=$(basename "$file")
  idx=$(git rev-parse --git-path handoffs-index)
  tries=0
  while :; do
    fetch || true
    parent=$(tip)
    rm -f "$idx"
    if [ -n "$parent" ]; then
      GIT_INDEX_FILE=$idx git read-tree "$parent"
    else
      GIT_INDEX_FILE=$idx git read-tree --empty
    fi
    blob=$(git -c core.safecrlf=false hash-object -w --path="$name" "$file")
    GIT_INDEX_FILE=$idx git update-index --add --cacheinfo "100644,$blob,$name"
    tree=$(GIT_INDEX_FILE=$idx git write-tree)
    rm -f "$idx"
    if [ -n "$parent" ]; then
      if [ "$tree" = "$(git rev-parse "$parent^{tree}")" ]; then
        echo "unchanged: $name is already on origin/$BRANCH"
        return 0
      fi
      commit=$(git commit-tree "$tree" -p "$parent" -m "handoff: $name")
    else
      commit=$(git commit-tree "$tree" -m "handoff: $name")
    fi
    if git push -q origin "$commit:refs/heads/$BRANCH"; then
      git update-ref "$REF" "$commit"
      echo "pushed $name to origin/$BRANCH ($(git rev-parse --short "$commit"))"
      return 0
    fi
    # Another session pushed a note first: rebuild on the new tip.
    tries=$((tries + 1))
    [ "$tries" -lt 3 ] || { echo "notes.sh: push to origin/$BRANCH failed 3 times" >&2; exit 1; }
  done
}

list() {
  fetch || echo "notes.sh: could not fetch origin/$BRANCH (not created yet, or offline)" >&2
  [ -n "$(tip)" ] || { echo "no notes on origin/$BRANCH"; return 0; }
  open=0
  for name in $(git ls-tree --name-only "$REF" | sort -r); do
    if git show "$REF:$name" | grep -q '^Resumed:'; then continue; fi
    echo "$name  $(git show "$REF:$name" | sed -n 2p)"
    open=$((open + 1))
  done
  [ "$open" -gt 0 ] || echo "no unresumed notes on origin/$BRANCH"
}

get() {
  fetch || true
  mkdir -p "$LOCAL"
  git show "$REF:$1" > "$LOCAL/$1"
  echo "$LOCAL/$1"
}

mark() {
  [ -f "$LOCAL/$1" ] || get "$1" > /dev/null
  printf 'Resumed: %s\n' "$(date -u '+%Y-%m-%d %H:%M UTC')" >> "$LOCAL/$1"
  publish "$LOCAL/$1"
}

case "${1:-}" in
  publish) publish "$2" ;;
  list) list ;;
  get) get "$2" ;;
  mark) mark "$2" ;;
  *) echo "usage: sh notes.sh publish <file> | list | get <name> | mark <name>" >&2; exit 2 ;;
esac
