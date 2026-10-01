/** Escapes text for interpolation into an HTML string (names a player typed, pack text). */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A key chip, as the menus draw keys. */
export function keyChip(key: string): string {
  return `<span class="ui-key">${escapeHtml(key)}</span>`;
}
