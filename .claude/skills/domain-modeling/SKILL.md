---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing the domain glossary (docs/architecture/domain-glossary.md), or recording or editing an ADR.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* the glossary for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

This repo is one context. The repo root holds exactly two markdown files, `ARCHITECTURE.md` and `CLAUDE.md` (ARCHITECTURE.md §8.5): never create a `CONTEXT.md`, `CONTEXT-MAP.md` or any other markdown there.

```
/
├── ARCHITECTURE.md                 ← binding spec, with the routing table every session reads
├── CLAUDE.md
├── docs/
│   ├── architecture/
│   │   └── domain-glossary.md      ← the glossary, once there is one
│   └── decisions/
│       ├── 0001-scheduler-partitioning-evaluated-not-adopted.md
│       └── 0015-planes-and-substances-removed.md
└── src/
```

Create the glossary lazily: when the first term is resolved and `docs/architecture/domain-glossary.md` doesn't exist yet, create it, and in the same change add a row for it to ARCHITECTURE.md's routing table ("What Else To Read"), so it is reachable from the one file every session reads. `docs/decisions/` already exists.

If the repo ever needs several contexts, the map and each context's glossary go under `docs/architecture/` too (`domain-context-map.md`, linked from the routing table, and one `domain-glossary-<context>.md` per context, linked from the map), and every ADR stays in `docs/decisions/`. Never put them at the root or inside `src/`.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in the glossary, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update the glossary inline

When a term is resolved, update `docs/architecture/domain-glossary.md` right there. Don't batch these up: capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

The glossary should be totally devoid of implementation details. Do not treat it as a spec, a scratch pad, or a repository for implementation decisions: binding rules live in `ARCHITECTURE.md` (§8.2), scratch notes in the gitignored `/.prompts/`. It is a glossary and nothing else.

### Offer ADRs sparingly

This repo requires an ADR for an owner-authorized protected-file change (ARCHITECTURE.md §8.1 exception 4) and for a design built and then rejected on evidence (§8.2). Otherwise, only offer to create one when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).
