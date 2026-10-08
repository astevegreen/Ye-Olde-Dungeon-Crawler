---
name: commit-review
description: Review a commit range against ARCHITECTURE.md (layering, purity, protected files, unrequested behavior changes, bundled work) and write the findings as a report to .prompts/antigravity/. Use when asked to review commits, a range, a feature that landed, or what changed recently.
---

# Skill: Commit Review

Report only: never change a file outside `.prompts/antigravity/`, and never move a tag.

## Range
Use the range the owner names (`<from>..<to>`). If none is named, start from the HEAD sha in the newest earlier `commit-review` report in `.prompts/antigravity/`, else `HEAD~20`, and end at HEAD.

## Steps
1. List the range: `git log --reverse --format='%h %s' <range>`. For each commit, read its whole message (`git show -s <sha>`) and its diff (`git show --stat <sha>`, then the files that matter).
2. Read `ARCHITECTURE.md` in full, then the sub-doc its routing table names for each area the range touches.
3. Check each commit against:
   - **Layering and imports (§2, §3):** no engine import of another layer; presentation and content reach the engine only through `src/engine/index.ts`; only `src/main.ts` imports content packs.
   - **Purity and determinism (§2, §7.2):** no DOM, Canvas, audio or timing global on the simulation path; no `Math.random()` or `Date.now()` for outcomes or IDs.
   - **Encapsulation (§7.2):** no engine-field writes from outside `src/engine/`; a new allowlist entry states a reason that holds.
   - **Engine creep and pack-neutral presentation (§3):** no campaign names or logic in `src/engine/`; no pack names, hex colors or emoji in `src/ui/`, `src/rendering/` or `src/main/**`.
   - **Protected files (§8.1):** a commit that changes `actionPipeline.ts`, `engine.ts` or `migrator.ts` names `§8.1 exception N`, and the change fits that exception.
   - **Save format (§5):** a breaking save-format change bumps `CURRENT_SCHEMA_VERSION` with exactly one forward-only step.
   - **Requested behavior (§8.4):** a `Requested: "..."` trailer quotes the owner. Treat that behavior as intended and check only that it is done correctly. Flag a behavior change that has neither a `Requested:` trailer nor a stated bug it fixes.
   - **One request per commit (§8.4):** flag a commit that bundles unrelated work.
   - **Docs sync (§8.2):** a change that makes `ARCHITECTURE.md` or a `docs/architecture/**` sub-doc untrue updates it in the same commit.
   - **Tests:** a behavior change or bug fix comes with a test that would fail without it.
4. If the range ends at HEAD, run `npm run lint` and `npm test` and paste the real output. The commit hooks already ran both, so a failure is itself a finding.
5. Write `.prompts/antigravity/<YYYY-MM-DD>-commit-review.md` with the header in `project-rules.md` (date, HEAD short sha, the range). Give each commit a line: its sha, subject, and either "clear" or its findings (`path:line`, evidence, severity, suggested fix). End with the count of commits clear and commits with findings, then stop.
