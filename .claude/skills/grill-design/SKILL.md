---
name: grill-design
description: Stress-test a game feature against the owner's goals, or drill into something that feels off until the owner's intent is pinned down. Use when the owner says "grill", asks whether a feature is done or complete, or reports something that feels wrong without saying how to fix it.
disable-model-invocation: true
---

# Grill Design

Interview the owner relentlessly until you share an understanding. The owner makes the design decisions; you find every fact yourself and bring a recommendation to every question. Adapted from mattpocock/skills `grilling`, with a grounding step and two modes added for this game.

## The loop

Map the topic as a **design tree**: every decision branches into the decisions that hang off it. Work it in **rounds**.

- The **frontier** is every decision whose prerequisites are already settled. Ask the whole frontier in one round, then wait. A question that depends on another open one belongs to a later round.
- Each round, recompute the frontier from the answers and ask the next.
- Format each question like this, numbered across the session:

```
❓ **Q1** - **<title>**: <body, with the options and what each costs>

➡️ <your recommended answer>

---
```

- Facts are your job, never the owner's. Look them up first: read the code, run the game, capture screenshots. For anything slow, dispatch a sub-agent and keep asking the questions that don't depend on it.
- Put a decision to the owner only once you could say what each answer would change.

## Ground first, before the first question

1. Find what is already settled: `MEMORY.md` and the memory files it points to, `docs/decisions/**`, and the owner's words in this conversation. **Never re-ask a settled decision.** If the owner's new words conflict with one, quote both and ask which stands.
2. Read the code and docs the topic touches (ARCHITECTURE.md routes to the right sub-doc).
3. Pick the mode. If it is unclear, that is Q1.

## Mode A: is this feature complete?

1. Collect the owner's goals for the feature, in their words, from the sources above. Restate each as an observable "done" condition a player could see or a test could assert.
2. Check each condition against reality: code, tests, `npm run sim`, and play (`.prompts/play.mjs` for scripted play; capture scripts for visuals). Mark each **done**, **partial**, **missing** or **unverifiable**, with the evidence.
3. Ask the owner only about what you cannot settle yourself: a goal too vague to test, two goals that conflict, behavior you found that no goal covers (keep or cut?), and any "partial" where finishing could go several ways.
4. Report the verdict table before the first round, so the questions have context.

## Mode B: something feels off

1. Q1 is the symptom in player terms: what happened, when, and what they expected instead. Skip it if the owner already said.
2. Reproduce and capture it yourself before asking more. Never ask the owner to look again.
3. Separate three things: what the game does, what the owner wanted, and why the gap matters. Often the real decision is the third one.
4. Branch into the fixes. For each, state what it changes and what it costs, including cost to the architecture: a fix that needs a change in `actionPipeline.ts`, `engine.ts` or `migrator.ts` is expensive (§8.1) and counts against the option, as the rejected road-home map did.

## Finishing

The session is done when the frontier is empty: every branch visited, nothing left silently assumed. Do not act on the result until the owner confirms the shared understanding.

Then write the result to `.prompts/grill-<topic>.md` (gitignored; never a new `.md` at the repo root):

- settled decisions, each with the owner's **verbatim words** quoted. Antigravity needs these for `Requested: "..."` commit trailers
- anything still open, and anything deliberately cut
- for Mode A, the final verdict table

Offer to save decisions that will outlast the task as a memory (preferences, design choices) or an ADR (anything that changes the architecture). An ADR goes in `docs/decisions/NNNN-slug.md`, written with `domain-modeling` (its ADR-FORMAT.md) and referenced from the ARCHITECTURE.md section it concerns. Do not write either unasked; an ADR the repo requires (a §8.1 exception-4 change, a design rejected on evidence) is written with the change it records.
