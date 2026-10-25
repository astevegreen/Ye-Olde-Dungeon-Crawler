---
name: sprint-plan
description: Writes specs for the next backlog items of one YODC sprint lane. Run only as /sprint-plan <lane>, from a session the sprint supervisor started, or by the owner on the planning day.
disable-model-invocation: true
argument-hint: "<story|lore|ux|fixes|tooling>"
model: opus
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
    - matcher: "mcp__plugin_github_.*"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
You turn the next backlog items of lane `$ARGUMENTS` in `docs/sprint.md` into issues the lane coordinator can
build. The owner approved the backlog (permission 1), so you do not wait for the owner. You never edit tracked
files, write code or invent game rules. `L` below is the label `lane:$ARGUMENTS`.

**The queue.** `Q` below is `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`: write it out in full, on a
line of its own (the guard refuses it chained, piped or redirected). `Q has-work "YODC plan: $ARGUMENTS"`
prints one line of JSON: `start`, `reason`, `ready` (the lane's open `sprint-ready` issues) and `todo` (the
lane's backlog IDs with no issue yet, in backlog order; `M1a` counts for `M1`). When it prints `error`, do what
its `do` line says; when it fails any other way, stop and report its output on issue #19. Never match titles
against the backlog by hand.

Stop when `Q window` prints `phase` `after`, or `start` is false. With `phase` `none` (no sprint started yet:
the planning day), go on past 3 `ready` until it is 6, still stopping when `todo` is empty.

## 1. Pick
Run `Q has-work "YODC plan: $ARGUMENTS"` and read the lane's backlog in `docs/sprint.md`. Take the first `todo`
item. Skip an item in two cases:
- it has an unanswered question on "Sprint questions" (step 2);
- an ID its line's `Waits for:` names has no issue yet (`gh issue list --state all --search "<ID> in:title"`),
  so its "Depends on" can't be written. That ID's lane files it first.

When none is left to take, stop. Read
only what its spec needs: `ARCHITECTURE.md` (already loaded), the sub-doc
its routing table names, the files the item names, and what the `scout` or `Explore` agent points you to.
Lanes `story` and `lore`: the "Act II: The Rot Below" section is the design, and
`.claude/skills/add-content/SKILL.md` is how content is built. Lane `fixes`: `.prompts/engine-bug-hunt/unverified-details.txt` and its `repros/` hold each
bug's details.

## 2. Check it can be specified
First read the "Sprint questions" issue (`docs/sprint.md`, Planning day): an `astevegreen` comment there that
answers a question by number settles it, like a line of `docs/sprint.md`.
If the item needs a product decision not written in `docs/sprint.md`, `ARCHITECTURE.md` or those answers
(balance feel, scope, a save break, a new mechanic, a name or placement the design leaves open):
- on the planning day (`phase` `none`): comment it on "Sprint questions" (create that issue if it is missing)
  as `Plan: Q<next number> <ID>: <question>`, with options and a recommended answer. File nothing for the item
  yet, and go to the next item.
- during the window (`phase` `open`): create the issue with the Goal and one question, label it `L` and `blocked`, and go to
  the next item.

A bug item: check it still happens on today's `origin/main`. Run its repro command or steps when it has them;
otherwise search `git log` since the report for a fix that names it. Put what you found in the spec. Already
fixed: create its issue with that finding and close it with `--reason "not planned"`. Not checkable without new
code: say "unverified" in the Goal, so the implementer's failing test decides.

## 3. Write
Start every comment you write with "Plan:".
Create each issue with `gh issue create --title "[task] <ID>: <what it does>" --label L --label sprint-ready
--body-file <file>`, the body written first with the Write tool to `.prompts/tmp/plan-$ARGUMENTS/<ID>.md` (the
guard reads every line of a command, so a body line such as `git push …` passed inline is refused as a push).
Every file you write goes in that folder: plan sessions for the other lanes run at the same time in this same
checkout. The body:
- **Goal**: what changes for the player or the workflow, in plain words.
- **Read first**: exact `path:line`s.
- **Acceptance criteria**: testable statements; each becomes a test that fails without the change. Read them
  back once and remove any two that contradict each other.
- **Gates**: `npm run gate-stamp -- run lint test tooling`, plus `npm run gates` when presentation changes,
  plus `npm run sim` and `npm run validate:schema` when content or the engine changes.
- **Out of scope**, **Size** (changed lines), and the line `Depends on: #<n>, #<m>.` (issue numbers only, or
  `Depends on: none.`), as plain text on one line. The queue reads the issue numbers before its first full
  stop, so any note about other issues goes after it.
- **Player-visible**: one line per change players will see, or "nothing player-visible".
- **Trailer**: the exact `Requested:` line from `docs/sprint.md` for this item (Act II or the reserve).
Size each for one fresh session: about 300 changed lines at most. Split bigger items into `<ID>a`, `<ID>b`,
each provable on its own, with "Depends on" between them. Name any §8.1 protected file the fix must touch and
why exception 1 applies; otherwise say "no protected file".

Then go back to step 1. When you stop, comment once on issue #19 "Sprint log": the lane, the issues created
(link, ID, ready or blocked), and every assumption you made. Under 10 lines. Then, in the window, if you filed at
least one ready issue and did not stop on a usage limit or an error, `RemoteTrigger` `run` the `supervisor` id
`Q window` prints (load RemoteTrigger with ToolSearch), so the lane starts on it now.
