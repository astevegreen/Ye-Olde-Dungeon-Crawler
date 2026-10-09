---
name: handoff
description: Handoff note so a fresh session picks up the work, or resume from one. Use when the owner says handoff, wrap up, clear or resume; when a task is committed and leaves open questions, or the next request is unrelated; or when the session has run long.
argument-hint: "[resume [note-path]]"
---

# Handoff

A handoff lets the owner `/clear` and continue in a small, fresh context. Every model call re-reads the whole conversation, so a long session costs more per step and attends worse; a 40-line note costs almost nothing to carry. Questions that surface during a task travel in the note, so the work their answers start runs in the fresh context.

Two branches: **write** (the default) and **resume** (the argument starts with `resume`).

## Write

1. **Gather the facts from git.** Run `git status --short` and `git log --oneline -15`, and note HEAD's short sha. Done when every commit and uncommitted file the note will mention appears in that output.
2. **Settle uncommitted work.** A finished request is committed through the normal flow (hooks, `Requested:` trailer) and pushed (`CLAUDE.md`, Pushing) before the note is written. A question whose answer changes what gets committed goes to the owner now, before the commit; every other question goes in the note. Work in progress stays uncommitted and is listed by file, with its state, under **Done**.
3. **Send durable facts to memory.** A fact that outlives this task (an owner preference, a tooling gotcha) goes to the memory directory; the note carries only what this task needs.
4. **Write the note** to `handoffs/<YYYY-MM-DD-HHMM>-<slug>.md` (timestamp from `date +%Y-%m-%d-%H%M`, slug 2–4 words naming the task), using the template below, 40 lines at most. The folder is git-tracked: a cloud session's disk vanishes with it, and the branch carries the note. Write for a **cold reader**: a session with none of this conversation, only the note, the repo and memory. Point at code by `path:line` and at history by sha, and let the cold reader open what it needs. Done when a cold reader could ask every **Decide first** question and start step 1 of **Next** from the note and the files it names alone.
5. **Commit and push the note.** Stage only the note and commit it (`handoff: <slug>`, `Requested: "handoff"`; the hooks run as usual). Then push by branch:
   - On a session branch: `git push -u origin HEAD`, in the background. Only `main` deploys the site, so the note reaches no player.
   - On `main`: commit only. A push to `main` deploys, so the note rides the next task push.
   Done when `git status --short` is clean and the note is on the remote branch (or, on `main`, committed).
6. **Tell the owner**: the note's path and branch, each **Decide first** question as one line with its recommendation, and the resume line: after `/clear`, type `/handoff resume`. The owner may answer a quick one in place; the rest wait for the fresh session.

### Template

    # Handoff: <task in a few words>
    <YYYY-MM-DD HH:MM> · HEAD <sha> · tree <clean | N uncommitted files>

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

1. **Find the note**: the path given, else the newest unresumed note across the working tree and every remote branch, since the writing session pushed to its own branch, not this one. Run `git fetch origin`, then list each ref's notes:

       for r in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do git ls-tree -r --name-only $r handoffs/ | sed "s|^|$r:|"; done

   A note is resumed when any ref's copy has a `Resumed:` line (`git show <ref>:<path>`). When two or more unresumed notes are under a day old, list them with their branch and ask which one. Bring the chosen note into the working tree: `git show <ref>:<path> > <path>`.
2. **Check drift**: run `git log --oneline <sha>..HEAD` and `git status --short`. Report commits or changes the note doesn't know about, and re-plan any step they invalidate before running it.
3. **Ask the Decide first questions**, recommended option first, and record each answer under **Decisions** with the owner's words. Done when every question has an answer or the owner has deferred it.
4. **Read the Read-first files**, and only those, before starting.
5. **Mark it resumed**: append `Resumed: <YYYY-MM-DD HH:MM>` to the note. It is committed and pushed with this session's first commit, which is how other branches see it as resumed.
6. **Restate the goal and the next step** in two lines, re-planned for any answer from step 3, then start that step. Decisions in the note stand as settled.
