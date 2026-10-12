/**
 * The grimoire's grid as the Spellbook and the altars draw it: 5x5, slots on the even
 * rows and columns, and a thin spacer between two slots that carries the link that lights
 * when their spells shape each other. `.sb-matrix` (menu.css) sizes the spacers at 10 px,
 * so a grid built without them squeezes the slots in between into strips.
 *
 * `cells` are the nine slots' markup, in slot order; `link` draws the spacer between
 * slots `a` and `b` ('h' beside, 'v' below).
 */
export function grimoireGridHtml(cells: string[], link: (a: number, b: number, axis: 'h' | 'v') => string): string {
  const grid: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      grid.push(cells[i]);
      if (col < 2) grid.push(link(i, i + 1, 'h'));
    }
    if (row < 2) {
      for (let col = 0; col < 3; col++) {
        grid.push(link(row * 3 + col, row * 3 + col + 3, 'v'));
        if (col < 2) grid.push('<i class="sb-link"></i>');
      }
    }
  }
  return grid.join('');
}
