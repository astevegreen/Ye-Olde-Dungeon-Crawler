# Handoff: WebKit main-menu flake (GPU-process stall)
2026-10-09 18:14 UTC · branch claude/cool-goldberg-822ce8 · HEAD f5c7f1a · tree clean

## Goal
"Root-cause and fix an intermittent Playwright failure in webkit (and occasionally firefox)": the menu button not clickable within 30 s after goto. Done = WebKit's flaky count drops to zero in the pre-push run.

## Decide first
- Land it on main: the branch is pushed but 5 commits behind main, and the app's sync refused (origin not confirmed: Help → Troubleshooting → Review Pinned Git Origins). — recommend: open a PR into main; main's changes touch only handoff/hooks/docs plus the test already cherry-picked (bb42bd2), so it merges cleanly.
- Firefox itself sometimes hangs on page load or context close (twice in a 3× full run, once in this push; logs show "RenderCompositorSWGL failed mapping default framebuffer"). Not the game. — recommend: leave it to the pre-push retry; look again only if it rises.
- In Playwright's Windows WebKit at Safari's 2x scale the game draws 15-19 fps since the idle animations (8d01a2f; 27 before), against 57-59 in Chromium. Real Safari on a Mac is untested. — recommend: no change unless a Mac player reports slowness.

## Done
- f190e0e fix(art): a stalled WebKit GPU process no longer leaves the page without a main menu
- f5c7f1a test(e2e): the F2 triage feedback click lands in WebKit
- bb42bd2 cherry-pick of main's 1dfbcda (family-sprite test timeout), so the gates passed here
- Uncommitted: none

## Next
1. Complete, apart from landing on main (Decide first 1).

## Decisions
- Fix in the game plus test headroom, not a harness that swaps pages — chosen because the stalled page recovers once the throw is caught (load stall costs ~15 s), and players on Safari get no blank page.
- WebKit project timeout 90 s — chosen because tests that hit a stall took 28-55 s, and wide-window tests take 40-50 s under a three-browser run.

## Dead ends
- Art waves / bundle size as the cause — the pre-art build (b494c40) fails identically under a forced stall.
- willReadFrequently, OffscreenCanvas (absent in this WebKit), browser flags — none keeps canvas out of the GPU process.
- page.mouse.click on the F2 button — misses: the button sits below the tab's scrolled view.

## Read first
- src/rendering/atlas/sprite-atlas.ts:190 — editPixels, the caught readback
- src/main.ts:164 — installUiIcons runs before the DOMContentLoaded handler
- playwright.config.ts:75 — webkit timeout and why
- e2e/feedback-and-diagnostics.spec.ts:135 — dispatchEvent, racing src/ui/diagnostic-modal.ts:268's 500 ms rebuild

## Verification
- lint + test: green on f5c7f1a's tree (2626/2626); sim, validate:schema, build, Chromium Playwright 32/32: green
- pre-push on f5c7f1a: 87 passed, 1 flaky (firefox page.goto hang), 8 skipped; WebKit 0 flaky
- Forced stall (NtSuspendProcess on WebKitGPUProcess): unfixed build reproduces "waiting for #btn-menu-new-game"; fixed build passes
