# ADR-0006: Review After Commit, and Agent Rules Antigravity Actually Loads

**Date:** 2026-09-24
**Status:** Accepted (owner decision)
**Supersedes:** the "engine changes stay uncommitted" clause of [ADR-0005](0005-owner-authorized-exception-and-agent-workflow.md)
**Related:** `ARCHITECTURE.md` §7.2 (PRNG discipline), §8.2, §8.4

## Context
`ac5d335` (Antigravity, 2026-09-23: the feedback reporter) broke two written §8.4 rules: it had no `Agent: Antigravity` trailer, and it committed engine production source instead of leaving it for Claude Code review. It also bundled unrelated work (coin renames, an inventory-overlay rewrite, ~6,000 lines of session transcripts) and minted a coin ID from `Date.now()`.

Three causes, in order of weight:
1. **Antigravity never loaded its rules.** They lived in `.antigravity/rules.md`, which is not a location Antigravity reads. It loads `AGENTS.md`/`GEMINI.md`, `.agents/rules/*.md` (with a `trigger` frontmatter), `.agents/skills/<name>/SKILL.md`, and global files under `~/.gemini/`. None of those existed, so the rules reached a session only if the agent happened to open the file. Its committed transcripts mention `rules.md` once (2026-09-22) and never in the 2026-09-23 sessions that broke it.
2. **The uncommitted-engine rule fought the owner's workflow.** The owner sometimes wants a change committed and pushed immediately; nothing could enforce holding it back, and it blocked the owner as often as it protected them.
3. **Review couldn't see intent.** The coin renames and naming changes were owner requests, but nothing in the commit said so, so review flagged them as unrequested scope.

## Decision
- **Rules move where Antigravity loads them.** `.antigravity/rules.md` becomes `.agents/rules/project-rules.md` (`trigger: always_on`); archetypes become `.agents/rules/persona-*.md` (`trigger: model_decision`, keyed to their `[Tag]`); skills become `.agents/skills/<name>/SKILL.md` with `name`/`description` frontmatter.
- **Review after commit.** Either agent may commit any change, including engine source, and push when the owner asks. Claude Code reviews `verified..HEAD` each session. §8.1 protected files still require a stated exception (hook-enforced), and `pre-push` still runs the full gates.
- **Commits carry the context review needs:** a mandatory attribution trailer (the `commit-msg` hook now rejects a commit without one; the owner's own commits use `Agent: owner`), a `Requested: "<the ask>"` trailer when the owner asked for the change, and one request per commit (the hook warns on large commits spanning several areas).
- **`check:engine-purity` fails on `Date.now()`** in engine and content source, as it already did on `Math.random()`. Legitimate timestamps are allowlisted per file with a reason in `scripts/purity-clock-allowlist.json`; stale entries fail.

## Alternatives Considered
- **Keep the uncommitted-engine rule and restate it more forcefully.** Rejected: the agent could not see the rule at all, and the owner does not want the constraint.
- **A PR-only workflow with required CI** (as in ADR-0005). Still not adopted: the `verified` queue gives after-the-fact review without changing the working rhythm.
- **`AGENTS.md` at the repo root.** Rejected: the root holds exactly `ARCHITECTURE.md` and `CLAUDE.md` (see `CLAUDE.md`), and `.agents/rules/` supports per-file activation modes.

## Consequences
- Instructions only bind an agent if they are in a file it loads; for Antigravity, `.agents/` is the one place.
- Enforcement lives in hooks and gates wherever possible: attribution and protected files block commits; bundling only warns, because size alone cannot tell a large single request from several small ones.
- Engine changes can reach `main`, and the remote, before review. The `verified..HEAD` queue plus the pre-push gates are the safety net; a problem found in review becomes a fix-forward commit.
- The new check surfaced one real gap: `PRNG`'s default seed was the wall clock and `GameEngine.changeFloor` passed no seed, so floor layouts were clock-seeded. Fixed under §8.1 exception 1: new floors draw their seed from `engine.prng`, and `PRNG` defaults to a fixed constant.
