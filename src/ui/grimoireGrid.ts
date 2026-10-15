/**
 * The grimoire's grid as the Spellbook draws it: slots on the even rows and columns, and a
 * thin spacer between two slots that carries the link that lights when their spells shape
 * each other. `.sb-matrix` (menu.css) sizes a 3×3 grid's spacers at 10 px, so a grid built
 * without them squeezes the slots in between into strips; a grimoire grown past the 3×3
 * outline carries its own template (`grimoireGridStyle`).
 *
 * `cells` are the slots' markup, row by row, `cols` to a row; `link` draws the spacer between
 * slots `a` and `b` ('h' beside, 'v' below).
 */
export function grimoireGridHtml(cells: string[], link: (a: number, b: number, axis: 'h' | 'v') => string, cols = 3): string {
  const rows = Math.ceil(cells.length / cols);
  const grid: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      grid.push(cells[i]);
      if (col < cols - 1) grid.push(link(i, i + 1, 'h'));
    }
    if (row < rows - 1) {
      for (let col = 0; col < cols; col++) {
        grid.push(link(row * cols + col, row * cols + col + cols, 'v'));
        if (col < cols - 1) grid.push('<i class="sb-link"></i>');
      }
    }
  }
  return grid.join('');
}

/** The `style` attribute for a grid that is not 3×3; empty for one that is. */
export function grimoireGridStyle(cols: number, rows: number): string {
  if (cols === 3 && rows === 3) return '';
  const track = (n: number, size: string): string => Array.from({ length: n }, () => size).join(' 10px ');
  return ` style="grid-template-columns: ${track(cols, '1fr')}; grid-template-rows: ${track(rows, 'auto')}"`;
}
