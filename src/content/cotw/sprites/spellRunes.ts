import type { SpriteRecipe } from '../../../engine';

/**
 * Spell runes (N5, tracker 4.6): one Elder Futhark rune for each element a spell can carry,
 * keyed `spell~<element>` (src/ui/spellRunes.ts), shown beside the spell's key on the belt.
 * A spell given its own rune later is keyed `spell~<spellId>` and wins over its element's.
 * Carved pale on a dark outline, so each reads on any element's frame.
 */

const INK = '#1e293b';
const CARVE = '#f8fafc';

/** The canvas a recipe draws on, as `SpriteRecipe` types it. */
type Ctx = Parameters<SpriteRecipe>[0];

/** A rune from its strokes (polylines on the 32-unit grid): a dark edge, then the carving. */
function rune(strokes: Array<Array<[number, number]>>): SpriteRecipe {
  return (ctx: Ctx, ox: number, oy: number) => {
    ctx.save();
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    for (const [color, width] of [[INK, 7], [CARVE, 3.5]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (const line of strokes) {
        ctx.beginPath();
        line.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(ox + x, oy + y) : ctx.lineTo(ox + x, oy + y)));
        ctx.stroke();
      }
    }
    ctx.restore();
  };
}

export const COTW_SPELL_RUNES: Record<string, SpriteRecipe> = {
  // Kenaz, the torch.
  'spell~fire': rune([[[21, 6], [11, 16], [21, 26]]]),
  // Isa, ice.
  'spell~cold': rune([[[16, 5], [16, 27]]]),
  // Thurisaz, Thor's thorn.
  'spell~lightning': rune([[[11, 5], [11, 27]], [[11, 10], [21, 16], [11, 22]]]),
  // Ansuz, the god's word.
  'spell~arcane': rune([[[11, 5], [11, 27]], [[11, 6], [21, 12]], [[11, 13], [21, 19]]]),
  // Berkano, the birch of healing.
  'spell~healing': rune([[[11, 5], [11, 27]], [[11, 5], [20, 10], [11, 16], [20, 21], [11, 27]]]),
  // Hagalaz, hail and ruin.
  'spell~shadow': rune([[[10, 5], [10, 27]], [[22, 5], [22, 27]], [[10, 12], [22, 20]]]),
  // Uruz, the aurochs' strength.
  'spell~physical': rune([[[10, 27], [10, 6], [22, 13], [22, 27]]]),
};
