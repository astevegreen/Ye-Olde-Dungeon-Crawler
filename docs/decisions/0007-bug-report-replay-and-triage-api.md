# ADR-0007: Bug-Report Replay and the Triage API in `engine.diagnostics`

**Date:** 2026-09-25
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §2 (Diagnostic API Namespacing, Bug-Report Replay), §8.1 (exception 4); [ADR-0005](0005-owner-authorized-exception-and-agent-workflow.md)

## Context
Review of `334bc61` (F3 bug-report automation) and `e9c3bb1` (F2 triage gaps) found:
- The reports' "AI reproduction context" gave the PRNG state *at report time* and told the reader to replay recent actions from it. The state before those actions was never captured, so nothing could be replayed.
- The action list was built from display strings, and each player action was logged twice (once by `InputHandler`, once by `engine.ts`).
- The new F2 triage tools wrote engine state from `src/ui/`: a synthetic potion run outside the action pipeline to clear statuses (leaving a junk identification record), a `SearchAction` run outside it to reveal secrets (awarding renown), and a direct `GameMap.moveEntity` call covered by a new encapsulation-allowlist entry. §2 puts triage methods in `engine.diagnostics`, which lives in the protected `engine.ts`, so the tools went around it instead.

## Authorization
On 2026-09-25 the owner asked for "all recommended fixes" from that review, and approved these `engine.ts` changes explicitly when asked:
1. **Replay trail:** one call at the top of `handlePlayerAction` records the action (type and scalar parameters) into the flight recorder. This is the only place every player action passes through, including the stunned/paralyzed path that returns early.
2. **Triage API:** `DiagnosticsAPI` extends `TriageAPI`, and `this.diagnostics` is built through `createDiagnosticsApi(this, {...})` (`src/engine/debug/triage.ts`), which adds the triage operations and makes every diagnostics call log itself and request a fresh replay checkpoint.

No other `engine.ts` logic changed. The implementations live in `src/engine/debug/`, which is not protected.

## Decision
- **Checkpoint + trail.** `FlightRecorder` keeps one checkpoint (a `serializeGame` snapshot) and the player actions since it. A checkpoint is taken at the next action boundary: the first action on a new engine, after a floor transition, when the trail reaches 250 actions, and after any `engine.diagnostics` call. Reports carry it as `reproduction.replay`. `loadReplayState()` loads it from a JSON package, a copied Markdown report, a bare replay block, or a save, and `replayActionTrail()` replays it through `handlePlayerAction`, stopping at the first action it can't rebuild rather than replaying past it.
- **Replay data reaches the developer.** The F3 issue body carries the error, location, and last actions itself; the tester pastes the full report beneath it. That paste must fit GitHub's 65,536-character body limit, and a checkpoint alone runs ~45 KB on early floors, so when the readable report doesn't fit, the replay block is gzip + base64 encoded (`src/ui/replayCodec.ts`, a ```` ```replay-gz ```` fence; ~10 KB for a 44 KB checkpoint). `npm run replay:report -- <file>` (`scripts/replay-report.ts`) loads and replays a report, compressed or not, and prints the resulting state.
- **Triage operations are engine methods.** F2 calls `engine.diagnostics` only. The `GameMap.moveEntity` allowlist entry is removed.
- **Known limit.** State changed outside player actions (shop trades, level-up stat allocation, dialog choices) is not in the trail. Where that happens, the replay can diverge silently unless a later action names an item or entity that no longer exists; every report's "How to Reproduce" line says so, and the .json package also carries the report-time snapshot to compare against.

## Consequences
- Building the replay test exposed a real save/load bug: `deserializeMapObject` rebuilt monsters without their loot tables (and other definition-only fields), so every monster that existed at save time died with no drops after a load. `deserializeGame` now restores those fields from each monster's definition.
- `PRNG` now keeps its state wrapped to int32. The stream was already a function of `state mod 2^32`, so no outcome changes; `getState()` values now compare across save/load, and the state no longer grows toward float precision loss.
- Replaying a trail is verified by `bugReportAutomation.test.ts` against a fresh world per run.

## Addendum (2026-09-25): freezes, stack traces, screenshots
- **Freezes.** A hung page runs no script, so it can't file a report. `SessionGuard` (`src/ui/sessionGuard.ts`) persists the replay data, recent log, and the input about to be handled on every key (via `InputHandler.onBeforeInput`, keeping §6 input ownership) and tap; `pagehide`, save & quit, and the crash dialog clear it. A record left by a page that was still visible means the session hung: the next launch opens a pre-filled Crash / Freeze report, stamped with the hung session's build. A tab a phone evicts while hidden is not reported.
- **Stack traces.** Deploys build with hidden source maps, kept 90 days as the `sourcemaps-<sha>` artifact. `npm run map:stack -- <build-id> "<stack>"` downloads them and maps HTML line:column positions (the JS is inlined) to source.
- **Screenshots.** The report window captures the game canvas when it opens and offers *Save Screenshot*; the issue body asks for a screenshot, strongly for Visual & UI reports. DOM UI isn't in the canvas, so the prompt also points to the device's own screenshot.

## Addendum (2026-09-25): report relay
Filing through GitHub's new-issue page needs every tester to have a GitHub account and to paste the report. `relay/` is a Cloudflare Worker that files the issue itself with a fine-grained token (this repository, Issues read/write only): the full report goes in the issue body, or its first comment when too long, and the screenshot is stored in Workers KV and embedded. The game uses it when built with `REPORT_RELAY_URL` (a repository variable in the deploy workflow), and falls back to the new-issue page when it is unset or unreachable; the fallback happens on the next press, since a popup opened after an await is blocked. Chosen over a Discord webhook (a public webhook URL in the bundle, and a second bridge to reach GitHub) and over Zapier-style automation (a third-party dependency and monthly caps).
