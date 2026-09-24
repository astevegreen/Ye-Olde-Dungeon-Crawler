---
trigger: always_on
---

# CLI Command Safety & Execution Rules (Windows PowerShell)

- **No Inline Eval (`-e`, `--eval`, `-c`):** Never run `npx tsx -e`, `node -e`, `python -c`, or multiline string code blocks directly in shell commands. In Windows PowerShell, nested quote stripping mangles string literals, causing Node/TSX to hang indefinitely waiting for closed input on `stdin`.
- **Run Files, Not Raw Code Strings:** For ad-hoc probes, calculations, or inspections, write code to a scratch file (in `.prompts/` or the conversation scratch directory) and execute it by path: `npx tsx <path/to/script.ts>`. Alternatively, use the safe evaluation wrapper: `npm run safe:eval -- <path/to/script.ts>`.
- **Always Use Repository Gate Scripts:** When running tests, lints, or builds, always invoke defined `package.json` scripts (`npm test`, `npm run lint`, `npm run sim`, `npm run validate:schema`, `npm run build:all`) or direct test runners (`npx vitest run <path/to/test.ts>`). Never synthesize raw inline CLI commands or one-liners for builds or gate checks.
- **Enforce Non-Interactive Execution:** Commands must run non-interactively with `stdin` ignored or closed; never run commands that await interactive terminal input.
