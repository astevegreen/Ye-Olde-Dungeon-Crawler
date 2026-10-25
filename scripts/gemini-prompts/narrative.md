Write a plain-English tour of how the game's code is organised right now, for the owner, who designs the game
but does not read code. Read the code on disk; don't rely on the docs being current. Write no file and run no
command at all, not even git; answer in your reply.

- Start with one paragraph: what happens, step by step, when the player presses a key to move or attack.
- Then one short section per top-level folder under `src/`: what it is responsible for, what it depends on, and
  what it must never do.
- Then "What changed since last month", from the month of git log in the material file.
- Then "Things that surprised me": anything that doesn't match `ARCHITECTURE.md`, in plain words.

No code blocks longer than 5 lines. No jargon without a one-line explanation. Under 800 words.
This is a description, not a review.

The answer is posted on a public GitHub issue: cite files as plain `path:line` relative to the repository root,
never as links or absolute paths.
