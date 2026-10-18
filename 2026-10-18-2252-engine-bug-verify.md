# Handoff: verify the engine bug hunt's leftover findings
2026-10-18 22:52 UTC · branch main · HEAD 92e5362c · tree 1 uncommitted file · folder C:/Antigravity/YODC

## Goal
"Find and fix engine bugs nobody has caught yet." The ten owner-decided bugs are fixed and deployed. What's left: the 7 findings the hunt never verified (`.prompts/engine-bug-hunt/report.md`, under "Not verified"). Done means each one has a failing repro test and a fix (one commit each, repro folded into the module's `__tests__/`), or is dropped as not reproducible, with a line saying why. A fix that changes balance or feel goes to the owner as a question first.

## Done
- 5a69cb10..ddaec734 (merged as 92e5362c, deployed green): wand Zap opens the aim; Blood Reap judges the foe its ray strikes; energy debt; gear Speed/Strength apply; ally deaths pay no kill reward; runestone step stays a turn; item actions honour haste/slow/carry perks; Spellbook edits take answered turns; Einherjar holy-ground refusal.
- Uncommitted: none (`.playwright-mcp/` is stray MCP output, not ours)

## Next
1. For each of the 7 in report.md "Not verified" (turret windup, seer sensing across floors, worn-belt take, disarm rows, fast-monster windup warning, tile effects after blink/slide, chord buffer under a modal): write a failing vitest repro first, and drop the finding if no repro fails.
2. Fix each confirmed one in its own commit with `Requested: "Find and fix engine bugs nobody has caught yet."`, then gate-stamp, and the sim if it touches the engine.

## Model
Opus at high thinking — each finding needs a cause traced across files before a repro exists.

## Decisions
- Prologue warlocks roam freely — owner: "Let them roam"
- Gear Speed/Strength retune is its own session (proposal card "Retune gear Speed/Strength after they took effect") — owner: "Apply, then retune"

## Dead ends
- Sim aimed Blood Reap (range 2) at foes 3–5 tiles off; fixed in scripts/headless-sim.ts (b4540cb9). `moveEntity` ignores passability.

## Read first
- .prompts/engine-bug-hunt/report.md:24 — the unverified list
- .prompts/engine-bug-hunt/repros/ — repro style to copy

## Verification
- gate-stamp lint/test/tooling: green on 92e5362c (3337 tests)
- pre-push (sim, build, Playwright ×3): green on 92e5362c; deploy.yml green
- Flake seen once: e2e/story-milestones.spec.ts:77 floating text (passed 5/5 rerun)
