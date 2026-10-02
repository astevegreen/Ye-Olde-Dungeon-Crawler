/** Markup the diagnostic tabs share (styles in src/ui/styles/diagnostics.css). */

/** Label/value rows. Values are markup: escape any text that comes from the game. */
export function kvList(rows: ReadonlyArray<readonly [string, string]>): string {
  return `<dl class="ui-kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}
