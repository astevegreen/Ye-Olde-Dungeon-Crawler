---
name: handoff
description: Handoff note so a fresh session picks up the work, or resume from one. Use when the owner says handoff, wrap up, clear or resume; when a task is committed and leaves open questions, or the next request is unrelated; or when the session has run long.
argument-hint: "[resume [note-name-or-path]]"
---

# Handoff

A handoff lets the owner `/clear` and continue in a small, fresh context. Every model call re-reads the whole conversation, so a long session costs more per step and attends worse; a 40-line note costs almost nothing to carry. Questions that surface during a task travel in the note, so the work their answers start runs in the fresh context.

Two branches: **write** (the default) and **resume** (the argument starts with `resume`).

Notes live on origin's `handoffs` branch, which holds only notes, never merges into `main` and deploys nothing; local and cloud sessions both read and write it there through `notes.sh` (this skill's folder; `sh .claude/skills/handoff/notes.sh`), which leaves the working branch untouched and runs no gate.

## Write

1. **Gather the facts from git.** Run `git status --short`, `git log --oneline -15` and `git branch --show-current`, and note HEAD's short sha. Done when every commit and uncommitted file the note will mention appears in that output.
2. **Settle uncommitted work.** A finished request is committed through the normal flow (hooks, `Requested:` trailer) and pushed (`CLAUDE.md`, Pushing) before the note is written. A question whose answer changes what gets committed goes to the owner now, before the commit; every other question goes in the note. Work in progress stays uncommitted and is listed by file, with its state, under **Done**; in a cloud session (`CLAUDE_CODE_REMOTE` is set) the disk goes with the session, so commit it as `wip: <slug>` and push the session branch instead.
3. **Send durable facts to memory.** A fact that outlives this task (an owner preference, a tooling gotcha) goes to the memory directory; the note carries only what this task needs.
4. **Write the note** to `.prompts/handoffs/<YYYY-MM-DD-HHMM>-<slug>.md` (timestamp in UTC from `date -u +%Y-%m-%d-%H%M`, since cloud sessions run in UTC and names sort as times; slug 2–4 words naming the task), using the template below, 40 lines at most. Write for a **cold reader**: a session with none of this conversation, only the note, the repo and memory. Point at code by `path:line` and at history by sha, and let the cold reader open what it needs. Done when a cold reader could ask every **Decide first** question and start step 1 of **Next** from the note and the files it names alone.
5. **Publish the note**: `notes.sh publish <path>`. Done when it prints `pushed <name>`; when the push fails, the note exists only on this disk, and step 6 says so.
6. **Tell the owner**: the note's name, each **Decide first** question as one line with its recommendation, and the resume line: after `/clear`, type `/handoff resume`, in this session or a cloud one. The owner may answer a quick one in place; the rest wait for the fresh session.

### Template

    # Handoff: <task in a few words>
    <YYYY-MM-DD HH:MM> UTC · branch <name> · HEAD <sha> · tree <clean | N uncommitted files>

    ## Goal
    <the owner's ask, quoted where it was quoted; what done looks like>

    ## Decide first
    - <question in plain terms: what changes for the player or the workflow> — recommend: <option>, because <reason>

    ## Done
    - <sha> <subject>
    - Uncommitted: <path> — <state>   (or: none)

    ## Next
    1. <concrete step, starting from a named file, function or command>

    ## Decisions
    - <decision> — owner: "<quote>"   (or: chosen because <reason>)

    ## Dead ends
    - <what was tried> — <why it failed>

    ## Read first
    - <path:line> — <why>   (five at most)

    ## Verification
    - <gate>: green on <sha> | failing: <one line> | not run

Keep **Goal** and **Next** always; drop any other section that would be empty. When the work is finished, **Next** reads `Complete` and the note keeps only what a later task would want.

## Resume

1. **Find and claim the note**: a path given is read where it is. Otherwise `notes.sh list` prints the unresumed notes, newest first, each with its header line; take the name given, or the only note listed, and when two or more are listed, show them all and ask which one, whatever their age. Then `notes.sh claim <name>` copies it to `.prompts/handoffs/`, appends `Resumed: <YYYY-MM-DD HH:MM> UTC` and publishes it, so another session's `list` stops offering it. Done when it prints `pushed <name>`; when it prints `already claimed`, another session took that note first: run `list` again and ask.
2. **Bring in the work**: the header names the branch and HEAD the note was written on. Run `git fetch origin` (`git fetch --unshallow` instead when `git rev-parse --is-shallow-repository` prints `true`), then `git merge-base --is-ancestor <sha> HEAD`. When it fails, merge the note's branch: `git merge --no-edit origin/<branch>`; a conflict goes to the owner. When no remote branch holds `<sha>` (`git branch -r --contains <sha>` prints nothing), the work never left the machine that wrote the note: tell the owner before going on. Done when `<sha>` is an ancestor of HEAD, or the owner has decided.
3. **Check drift**: run `git log --oneline <sha>..HEAD` and `git status --short`. Report commits or changes the note doesn't know about, and uncommitted files it lists that are absent here (they stayed on the machine that wrote it); re-plan any step they invalidate before running it.
4. **Ask the Decide first questions**, recommended option first, and record each answer under **Decisions** in the copy, with the owner's words, then `notes.sh publish <path>` the copy. Done when every question has an answer or the owner has deferred it.
5. **Read the Read-first files**, and only those, before starting.
6. **Restate the goal and the next step** in two lines, re-planned for any answer from step 4, then start that step. Decisions in the note stand as settled.
