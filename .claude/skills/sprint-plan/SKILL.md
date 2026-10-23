---
name: sprint-plan
description: Writes specs for the next backlog items of one YODC sprint lane. Run only as /sprint-plan <lane>, from a session the sprint supervisor started.
disable-model-invocation: true
argument-hint: "<aids|ux|fixes|tooling>"
model: opus
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
You turn the next backlog items of lane `$ARGUMENTS` in `docs/sprint.md` into issues the lane coordinator can
build. The owner approved the backlog (permission 1), so you do not wait for the owner. You never edit files,
write code or invent game rules. `L` below is the label `lane:$ARGUMENTS`.

Stop when `date -u +%Y%m%dT%H%M` is outside the window on the `Window (UTC)` line of `docs/sprint.md`, or the lane has 3 open
`sprint-ready` issues, or its backlog has no item left without an issue.

## 1. Pick
Read `docs/sprint.md` and the lane's backlog, top to bottom. An item is done when an issue title starts
`[task] <ID>:` or `[task] <ID>` plus a letter and a colon. Get every title once with
`gh issue list --state all --search "[task] in:title" --limit 500 --json title` and match the start yourself.
Take the first item not done. Read only what its spec needs: `ARCHITECTURE.md` (already loaded), the sub-doc
its routing table names, the files the item names, and what the `scout` or `Explore` agent points you to.
Lane `aids`: the "Magic onboarding" section is the design, and `.claude/skills/add-content/SKILL.md` is how
content is built. Lane `fixes`: `.prompts/engine-bug-hunt/unverified-details.txt` and its `repros/` hold each
bug's details.

## 2. Check it can be specified
If the item needs a product decision not written in `docs/sprint.md` or `ARCHITECTURE.md` (balance feel,
scope, a save break, a new mechanic, a name or placement the design leaves open), create the issue with the
Goal and one question, label it `L` and `blocked`, and go to the next item.

## 3. Write
Start every comment you write with "Plan:".
Create each issue with `gh issue create --title "[task] <ID>: <what it does>" --label L --label sprint-ready`
and this body:
- **Goal**: what changes for the player or the workflow, in plain words.
- **Read first**: exact `path:line`s.
- **Acceptance criteria**: testable statements; each becomes a test that fails without the change.
- **Gates**: `npm run gate-stamp -- run lint test tooling`, plus `npm run gates` when presentation changes,
  plus `npm run sim` and `npm run validate:schema` when content or the engine changes.
- **Out of scope**, **Size** (changed lines), **Depends on** (issue numbers, or none).
- **Player-visible**: one line per change players will see, or "nothing player-visible".
- **Trailer**: the exact `Requested:` line from `docs/sprint.md` for this lane.
Size each for one fresh session: about 300 changed lines at most. Split bigger items into `<ID>a`, `<ID>b`,
each provable on its own, with "Depends on" between them. Name any §8.1 protected file the fix must touch and
why exception 1 applies; otherwise say "no protected file".

Then go back to step 1. When you stop, comment once on issue #19 "Sprint log": the lane, the issues created
(link, ID, ready or blocked), and every assumption you made. Under 10 lines.
