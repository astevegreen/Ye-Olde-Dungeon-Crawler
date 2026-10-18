# Handoff: engine bug hunt, owner questions
2026-10-18 21:14 UTC · branch worktree-engine-bug-hunt · HEAD 4fb4dc8d · tree clean · folder C:/Antigravity/YODC/.claude/worktrees/engine-bug-hunt

## Goal
"Find and fix engine bugs nobody has caught yet." 17 fixes shipped; 10 confirmed bugs wait on the owner because each changes balance or feel. Done: each answered, the approved ones fixed one per commit with their repro test.

## Decide first
- Inventory wand Zap fires on the hero's own tile — recommend: open the aiming reticle, as spells do.
- Blood Reap judges the aimed foe but hits whoever blocks the ray — recommend: judge the creature hit; refuse at no cost.
- Prologue warlocks walk off the fountain — recommend: restore ef8810f9's stay-put tuning.
- Slow, burden, water and mud cost a speed-100 actor nothing (energy clamp) — recommend: soak first; the fix slows every slowed fight.
- Speed and Strength on gear do nothing — recommend: apply them, then soak and retune those items.
- Killing your own ally pays kill perks and bestiary counts — recommend: extend the "never the hero's kill" rule.
- Cancelling a runestone prompt makes the step onto it free — recommend: a normal turn.
- Pick up, drop and equip ignore haste, slow and carry perks — recommend: apply them like every other action.
- Spellbook or grimoire edits mid-fight spend a turn monsters never answer — recommend: let monsters act, as the command bus does.
- Einherjar refusing a holy-ground burn grants a free action — recommend: the swing lands and the turn is spent.

## Done
- d8a8689e..4fb4dc8d: 17 fix commits on main, one bug each (list and player impact in report.md).
- Uncommitted: none.

## Next
1. Ask the questions; for each approved one, start from its failing repro in C:/Antigravity/YODC/.prompts/engine-bug-hunt/repros/ and fold it into the module's test file.
2. Optional: verify the 7 unverified findings listed in report.md (failing repro first; no repro, drop it).

## Model
Opus at high thinking — engine fixes that cross the scheduler, combat and content hooks.

## Decisions
- Wand Zap from inventory — owner: "Open the aim"
- Blood Reap — owner: "Judge who's hit" (refuse at no cost)
- Prologue warlocks — owner: "Let them roam" (no fix)
- Slow/burden/water/mud energy clamp — owner: "Fix now" (no soak first)
- Gear Speed/Strength — owner: "Apply, then retune"
- Ally kills — owner: "No reward"
- Runestone cancel — owner: "A normal turn"
- Pick up/drop/equip speed — owner: "Apply them"
- Spellbook edits mid-fight — owner: "Monsters act"
- Einherjar holy-ground refusal — owner: "Swing lands, turn spent"

## Read first
- C:/Antigravity/YODC/.prompts/engine-bug-hunt/report.md — every fix, the dropped findings, the questions
- C:/Antigravity/YODC/.prompts/engine-bug-hunt/notes.md — per-finding files and line numbers

## Verification
- pre-push (sim, build, Playwright x3, 93 tests): green on 4fb4dc8d
- ci:watch: deploy.yml success, deployed, on 4fb4dc8d
Resumed: 2026-10-18 21:58 UTC
