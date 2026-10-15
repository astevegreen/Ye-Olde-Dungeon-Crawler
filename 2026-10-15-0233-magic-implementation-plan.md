# Handoff: magic implementation plan (planning only)
2026-10-15 02:33 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Owner: "Plan the implementation of the revised cotw magic system. Plan only: change no code, and edit neither ARCHITECTURE.md nor CLAUDE.md." Output: a Notion child page of the main magic page titled "Magic implementation plan — <date>", written for the owner (plain terms, no paths or capability letters in summaries), plus in chat: one line per phase, total sessions, the first session's task, and owner questions with recommendations. Done when a fresh session could start phase 1 from the page alone. The full brief (8 required sections: phases, order, save format, §8.1 exposure, removals, risks, §9 drafts P-28+, questions) is the owner's message in the session that wrote this note; if it isn't available, ask the owner to paste it again.

## Done
- Read all three Notion pages (main https://app.notion.com/p/3f8eb012942f815aa849c981efb30225, runestones .../3faeb012942f81a48630e644820fb375, forge .../3faeb012942f815cb21ec74740bc154e) and memories magic-review-2026-10-13, soak-after-magic, ui-tests-no-deep-imports.
- Code has not moved since 7e23de4d: origin/main == 7e23de4d, no unmerged branches besides `handoffs`.
- Deploy runs only on push to main (.github/workflows/deploy.yml:5), so a branch push deploys nothing.
- Five Explore inventories were running when this was written (spell engine; terrain/surfaces; statuses/AI/kill rites; grimoire/altars/learning/blood; UI/e2e/capture/soak/saves). If this note is resumed, rerun them; their results lived only in the old session.
- Uncommitted: none

## Next
Complete. The plan is the Notion page "Magic implementation plan — 15 Oct 2026" (https://app.notion.com/p/3faeb012942f8151966add5a1946da01), a child of the main magic page; its "Start here" callout briefs session 1a-1. Six owner questions sit at its top; phase 1 waits on question 6 (the P-28–P-36 entries) only.

## Decisions
- Measure magic last; no soak before it — owner, 13 Oct (memory soak-after-magic).
- Design is settled; don't re-open it — owner's brief.

## Read first
- src/content/cotw/spells.ts:103 — today's spell data shape
- src/content/cotw/hybridSpells.ts:67 — the 12 recipes being removed
- src/content/cotw/index.ts:293 — Odin, Ivalda (:336), Skuld (:344) placements
- src/engine/storage/migrator.ts — CURRENT_SCHEMA_VERSION (§8.1)
Resumed: 2026-10-15 03:02 UTC
