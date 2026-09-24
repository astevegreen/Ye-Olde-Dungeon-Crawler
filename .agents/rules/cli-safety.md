---
trigger: always_on
---

# CLI Command Safety (Windows PowerShell)

- **No inline eval (`-e`, `--eval`, `-c`, `-p`):** never run `npx tsx -e`, `node -e`, `python -c`, or any code passed as a quoted shell argument. Windows PowerShell drops or mangles quoted arguments to native commands; `tsx` left without code starts a REPL and waits on stdin forever.
- **Probes go in files:** write ad-hoc code to `.prompts/` (gitignored) or your scratch directory and run it with `npm run safe:eval -- <path> [args...]`. It closes stdin and kills the probe after 30s. It has no `-e` mode, on purpose.
- **Gates run through `package.json` scripts:** `npm test`, `npm run lint`, `npm run sim`, `npm run validate:schema`, `npm run build` / `build:all`, or `npx vitest run <test-file>` for one file. Never hand-assemble one-liners for them.
- **Nothing interactive:** never run a command that waits for terminal input.
