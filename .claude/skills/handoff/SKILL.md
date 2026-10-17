---
name: handoff
description: Handoff note so a fresh session picks up the work, or resume from one. Use when the owner says handoff, wrap up, clear or resume; when a task is committed and leaves open questions, or the next request is unrelated; or when the session has run long.
argument-hint: "[resume [note-name-or-path]]"
---

# Handoff

A handoff lets the owner `/clear` and continue in a small, fresh context. Every model call re-reads the whole conversation, so a long session costs more per step and attends worse; a 40-line note costs almost nothing to carry. Questions that surface during a task travel in the note, so the work their answers start runs in the fresh context.

Two branches: **write** (the default) and **resume** (the argument starts with `resume`).

Notes live on origin's `handoffs` branch, which holds only notes, never merges into `main` and deploys nothing; local and cloud sessions both read and write it there through `notes.mjs` (this skill's folder; `node .claude/skills/handoff/notes.mjs`), which leaves the working branch untouched and runs no gate.

## Write

1. **Gather the facts from git.** Run `git status --short` and `git log --oneline -15`. Done when every commit and uncommitted file the note will mention appears in that output.
2. **Settle uncommitted work.** A finished request is committed through the normal flow (hooks, `Requested:` trailer) and pushed (`CLAUDE.md`, Pushing) before the note is written. Work still running in the background (the push and its gates, a test run, an agent) finishes first: end the turn saying what it waits on, and write the note when its notification arrives, with the result under **Verification**, so the next session has nothing to check. A question whose answer changes what gets committed goes to the owner now, before the commit; every other question goes in the note. Work in progress stays uncommitted and is listed by file, with its state, under **Done**; in a cloud session (`CLAUDE_CODE_REMOTE` is set) the disk goes with the session, so commit it as `wip: <slug>` and push the session branch instead.
3. **Send durable facts to memory.** A fact that outlives this task (an owner preference, a tooling gotcha) goes to the memory directory; the note carries only what this task needs.
4. **Write the draft** to `.prompts/handoffs/<slug>.md` (slug 2–4 words naming the task) from the template below, 40 lines at most, as a new file also when this session began by resuming a note. Write for a **cold reader**: a session with none of this conversation, only the note, the repo and memory. Point at code by `path:line` and at history by sha, and let the cold reader open what it needs. Done when a cold reader could ask every **Decide first** question and start step 1 of **Next** from the note and the files it names alone.
5. **Publish the note**: `notes.mjs publish .prompts/handoffs/<slug>.md`. It writes line 2, checks the note against the template's rules, files it under a UTC-timestamped name and pushes it. Done when it prints `pushed <name>`; on `not published`, fix what it names and run it again. When the push fails, the note exists only on this disk, and step 6 says so. To update a published note (background work has finished), edit its `.prompts/handoffs/<name>` and publish that file: it keeps its name.
6. **Tell the owner**, in the same turn as step 5's `pushed`: the resume line is a promise that `list` shows this note. The note's name, each **Decide first** question as one line with its recommendation, the **Model** line when the note has one, and the resume line: after `/clear`, type `/handoff resume`, in this session or a cloud one. The owner may answer a quick one in place; the rest wait for the fresh session.

### Template

    # Handoff: <task in a few words>
    (publish writes this line: time, branch, HEAD, tree, folder)

    ## Goal
    <the owner's ask, quoted where it was quoted; what done looks like>

    ## Decide first
    - <question in plain terms: what changes for the player or the workflow> — recommend: <option>, because <reason>

    ## Done
    - <sha> <subject>
    - Uncommitted: <path> — <state>   (or: none)

    ## Next
    1. <concrete step, starting from a named file, function or command>

    ## Model
    <model> at <low|medium|high|xhigh|max> thinking — <what **Next** asks for that earns it>

    ## Decisions
    - <decision> — owner: "<quote>"   (or: chosen because <reason>)

    ## Dead ends
    - <what was tried> — <why it failed>

    ## Read first
    - <path:line> — <why>   (five at most)

    ## Verification
    - <gate>: green on <sha> | failing: <one line> | not run

Keep **Goal** and **Next** always; drop any other section that would be empty. When the work is finished, **Next** reads `Complete` and the note keeps only what a later task would want.

**Model** names the model and thinking level the next session should run, chosen from what **Next** will do, by `CLAUDE.md`'s Model and effort rule: Opus for design, debugging and engine work, Sonnet 5.5 for routine content, tuning and UI changes with a clear spec. Thinking follows the hardest step in **Next**: `low` for mechanical edits, `medium` for a specified change, `high` for tracing a cause or a cross-file change, `xhigh` or `max` for open design or a bug with no reproduction. When **Next** mixes kinds, recommend for the part that decides the outcome. Omit the section when **Next** reads `Complete` or the first step is still undecided.

## Resume

1. **Claim the note**: `notes.mjs claim [name]`, with the name from the argument if there is one. With no name it claims the only open note; when several are open it claims nothing and lists them: show them all and ask which one, whatever their age, then claim that one. Claiming copies the note to `.prompts/handoffs/`, appends `Resumed:` and publishes it, so no other session's `list` offers it. Done when it prints the note followed by **Since the note**; on `already claimed`, another session took that note first: run `list` and ask. A path given instead of a name (a note whose push failed) is read where it is, and step 2 checks by hand.
2. **Bring in the work** as **Since the note** says: run the merge it names (a conflict goes to the owner); when it says the work never left another machine, or sits in another folder, tell the owner before going on. Report commits or changes the note doesn't know about, and uncommitted files it lists that are absent here; re-plan any step they invalidate before running it. When it can't read line 2, check by hand: `git fetch origin`, then `git merge-base --is-ancestor <sha> HEAD`, and when that fails `git merge --no-edit origin/<branch>`; then `git log --oneline <sha>..HEAD` and `git status --short`. Done when the note's HEAD is an ancestor of HEAD, or the owner has decided.
3. **Ask the Decide first questions**, recommended option first, and record each answer under **Decisions** in the claimed copy, with the owner's words, then `notes.mjs record <path>`. Done when every question has an answer or the owner has deferred it.
4. **Read the Read-first files**, and only those, before starting.
5. **Restate the goal and the next step** in two lines, re-planned for any answer from step 3. When the note's **Model** names a different model from this session's, add one line saying so and let the owner switch before the step starts. A session cannot see its own thinking level, so never claim it differs: when the note recommends one, add one line naming it (`The note recommends high thinking.`). Then start that step. Decisions in the note stand as settled.
