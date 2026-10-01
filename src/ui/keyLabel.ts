const NAMED: Record<string, string> = {
  Escape: 'Esc',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Period: '.',
  Comma: ',',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
};

/** A KeyboardEvent code, or a "Shift+" chord of one, as a key chip reads it: "KeyE" -> "E",
 *  "Shift+KeyT" -> "⇧T", "Numpad8" -> "Num 8". */
export function keyLabel(code: string): string {
  const shift = code.startsWith('Shift+');
  const bare = shift ? code.slice('Shift+'.length) : code;
  let label = NAMED[bare];
  if (!label) {
    if (/^Key[A-Z]$/.test(bare)) label = bare.slice(3);
    else if (/^Digit\d$/.test(bare)) label = bare.slice(5);
    else if (/^Numpad\d$/.test(bare)) label = `Num ${bare.slice(6)}`;
    else label = bare;
  }
  return shift ? `⇧${label}` : label;
}
