# Domain Glossary Format

The glossary lives at `docs/architecture/domain-glossary.md`, never at the repo root (see [SKILL.md](./SKILL.md), File structure).

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.

## Single vs multi-context

**Single context (this repo):** one glossary, `docs/architecture/domain-glossary.md`, linked from ARCHITECTURE.md's routing table.

**Multiple contexts (only if the repo ever needs them):** a context map at `docs/architecture/domain-context-map.md` lists the contexts, where each one's glossary lives, and how they relate to each other:

```md
# Context Map

## Contexts

- [Ordering](./domain-glossary-ordering.md): receives and tracks customer orders
- [Billing](./domain-glossary-billing.md): generates invoices and processes payments
- [Fulfillment](./domain-glossary-fulfillment.md): manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

The skill infers which structure applies:

- If `docs/architecture/domain-context-map.md` exists, read it to find contexts
- If only `docs/architecture/domain-glossary.md` exists, single context
- If neither exists, create `docs/architecture/domain-glossary.md` lazily when the first term is resolved, and add it to ARCHITECTURE.md's routing table in the same change

Every file here stays under `docs/architecture/`: never the repo root, never inside `src/`. When multiple contexts exist, infer which one the current topic relates to. If unclear, ask.
