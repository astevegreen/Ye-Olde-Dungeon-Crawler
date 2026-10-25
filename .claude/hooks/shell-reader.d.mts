/** Types for `shell-reader.mjs`, which the sprint guard runs under plain node. */

export class Unreadable extends Error {}

/** One command a simple command runs: its words, and whether find or xargs adds words to it (`repl` is the placeholder). */
export interface Run {
  w: string[];
  /** Its first word as written (`./run.sh`, `C:/x/git.exe`), before cmdName. */
  at: string;
  fromArgs: boolean;
  repl: string | null;
}

export interface Read {
  /** The line with message values blanked. */
  text: string;
  /** The line with every literal string blanked. */
  literalsBlank: string;
  /** Its words as the shell reads them, joined. */
  textRead: string;
  /** Its simple commands, a substitution's commands among them. */
  parts: string[];
  words(part: string): string[];
  /** Throws Unreadable when a command can't be read word by word. */
  commandsIn(words: string[]): Run[];
  /** Why the line runs a command the reader can't see, or can't be sure where its comments and heredocs end, or null. */
  refusal: string | null;
  /** Git's subcommand or checkout is held in a variable or a substitution. */
  gitHidden: boolean;
  /** Each heredoc or here-string's body; a quoted one is literal input. */
  heredocs: { quoted: boolean; body: string }[];
}

export function readCommand(command: unknown, shell?: 'bash' | 'powershell'): Read;
export function gitSub(w: string[]): string | undefined;
export function cmdName(x: unknown): string;
