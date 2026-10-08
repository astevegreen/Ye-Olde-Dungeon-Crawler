---
name: handoff
description: Handoff note so a fresh session picks up the work, or resume from one. Use when the owner says handoff, wrap up, clear or resume; when a task is committed and the next request is unrelated; or when the session has run long.
argument-hint: "[resume [note-path]]"
---

# Handoff

A handoff lets the owner `/clear` and continue in a small, fresh context. Every model call re-reads the whole conversation, so a long session costs more per step and attends worse; a 40-line note costs almost nothing to carry.

Two branches: **write** (the default) and **resume** (the argument starts with `resume`).

## Write

1. **Gather the facts from git.** Run `git status --short` and `git log --oneline -15`, and note HEAD's short sha. Done when every commit and uncommitted file the note will mention appears in that output.
2. **Settle uncommitted work.** A finished request is committed through the normal flow (hooks, `Requested:` trailer) before the note is written. Work in progress stays uncommitted and is listed by file, with its state, under **Done**.
3. **Send durable facts to memory.** A fact that outlives this task (an owner preference, a tooling gotcha) goes to the memory directory; the note carries only what this task needs.
4. **Write the note** to `.prompts/handoffs/<YYYY-MM-DD-HHMM>-<slug>.md` (timestamp from `date +%Y-%m-%d-%H%M`, slug 2–4 words naming the task), using the template below, 40 lines at most. Write for a **cold reader**: a session with none of this conversation, only the note, the repo and memory. Point at code by `path:line` and at history by sha, and let the cold reader open what it needs. Done when a cold reader could start step 1 of **Next** from the note and the files it names alone.
5. **Tell the owner** the note's path and the resume line: after `/clear`, type `/handoff resume`.

### Template

    # Handoff: <task in a few words>
    <YYYY-MM-DD HH:MM> · HEAD <sha> · tree <clean | N uncommitted files>

    ## Goal
    <the owner's ask, quoted where it was quoted; what done looks like>

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

    ## Open questions
    - <question for the owner>

Keep **Goal** and **Next** always; drop any other section that would be empty. When the work is finished, **Next** reads `Complete` and the note keeps only what a later task would want.

## Resume

1. **Find the note**: the path given, else the newest note in `.prompts/handoffs/` without a `Resumed:` line. When two or more unresumed notes are under a day old, list them and ask which one.
2. **Check drift**: run `git log --oneline <sha>..HEAD` and `git status --short`. Report commits or changes the note doesn't know about, and re-plan any step they invalidate before running it.
3. **Read the Read-first files**, and only those, before starting.
4. **Mark it resumed**: append `Resumed: <YYYY-MM-DD HH:MM>` to the note.
5. **Restate the goal and the next step** in two lines, then start that step. Decisions in the note stand as settled; an open question that blocks the step goes to the owner first.
