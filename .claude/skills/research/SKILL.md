---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file (by default in the gitignored .prompts/research/). Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
disable-model-invocation: true
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it to `.prompts/research/<slug>.md`: gitignored scratch, the repo's place for working notes. Only when the user asks for a tracked doc does it go under `docs/` instead, linked from the doc it supports so a reader can find it. Never at the repo root, whose only markdown files are `ARCHITECTURE.md` and `CLAUDE.md` (ARCHITECTURE.md §8.5). Say where you saved it.
