# ADR Format

ADRs live in `docs/decisions/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc. (ARCHITECTURE.md §8.1(4), §8.2). The directory already exists; never create another ADR directory, and never put an ADR at the repo root, whose only markdown files are `ARCHITECTURE.md` and `CLAUDE.md` (§8.5).

## Template

Match the existing ADRs; `docs/decisions/0015-*.md` and `0010-*.md` are good models.

```md
# ADR-NNNN: {Short title of the decision}

**Date:** YYYY-MM-DD
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §N (section name); [ADR-NNNN](NNNN-slug.md); [sub-doc](../architecture/sub-doc.md)

## Context
{What forced the decision: the problem, the evidence, the question put to the owner.}

## Decision
{What was decided and by whom, quoting the owner's words when they decided or authorized it.}

## Alternatives Considered
- **{Option}.** Rejected: {why}.

## Consequences
- {What follows, and what reversing or reviving it would take.}
```

- **Status:** `Accepted`, `Accepted (owner decision)`, or `Rejected (evaluated on evidence, not merely deferred)` for a design built and then reverted (ADR-0001). When a later ADR replaces part of an earlier one, the later one carries a `**Supersedes:**` line and the earlier one's status says `Accepted; partly superseded by ADR-NNNN (...)`, with a link.
- **A protected-file change (§8.1 exception 4)** quotes the owner's authorization and names the file and the exact scope of the change (ADR-0013, ADR-0015).
- **Keep it short.** Most sections are a paragraph or a few bullets. Omit Alternatives Considered only when there truly were none.
- **Later changes:** a closed ADR is history, not a living doc. Record a later change as a dated `## Amendment (YYYY-MM-DD): {topic}` section or a one-line dated note (ADR-0011), and leave the original text as it was.

## Numbering

Scan `docs/decisions/` for the highest existing number and increment by one.

## Wiring it in

In the same change, reference the new ADR from the `ARCHITECTURE.md` section it concerns (§8.2: "reference it from the relevant stub"), as §5 and §6 cite theirs in their *History:* lines. A binding rule the decision creates goes into `ARCHITECTURE.md` itself; the ADR records only why.

## When to offer an ADR

This repo requires one, whatever the tests below say, in two cases:

- an owner-authorized protected-file change (§8.1 exception 4);
- a design that was built and then rejected on evidence, not merely deferred (§8.2).

Otherwise, all three of these must be true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it: you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library: just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it; otherwise someone will suggest GraphQL again in six months.
