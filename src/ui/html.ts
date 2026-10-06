/**
 * Escapes text for interpolation into an HTML string (names a player typed, pack text).
 * Coerces first: a hand-edited save's number or object where a name belongs renders as
 * text rather than throwing and blanking the list it sits in.
 */
export function escapeHtml(text: string): string {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A key chip, as the menus draw keys. */
export function keyChip(key: string): string {
  return `<span class="ui-key">${escapeHtml(key)}</span>`;
}
