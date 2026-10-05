import type { GameContentManifest, SpellDefinition } from '../engine';

/**
 * Spell runes and tones (N5, tracker 4.6): how a spell looks on the belt, from pack data.
 *
 * A pack draws a spell's rune as a sprite recipe keyed `spell~<spellId>`, or one for all
 * the spells of an element keyed `spell~<elementId>`; the spell's own wins. At startup
 * `installUiIcons()` (src/rendering/uiIcons.ts) bakes them into the same stylesheet as the
 * `ui~` icons, so `<i class="spell-rune" data-rune="<key>">` shows one anywhere.
 */
export const SPELL_RUNE_PREFIX = 'spell~';

/** The rune a spell shows (a `data-rune` value), or undefined where the pack draws none. */
export function spellRuneKey(manifest: GameContentManifest | undefined, spell: SpellDefinition): string | undefined {
  const recipes = manifest?.spriteRecipes ?? {};
  if (recipes[SPELL_RUNE_PREFIX + spell.id]) return spell.id;
  if (spell.element && recipes[SPELL_RUNE_PREFIX + spell.element]) return spell.element;
  return undefined;
}

/** The rune's markup, or '' without one. */
export function spellRuneHtml(manifest: GameContentManifest | undefined, spell: SpellDefinition): string {
  const key = spellRuneKey(manifest, spell);
  return key ? `<i class="spell-rune" data-rune="${key.replace(/"/g, '&quot;')}" aria-hidden="true"></i>` : '';
}

/**
 * A spell's color: its element's in the pack (`affinityMatrix.elements[].color`), else the
 * spell's own (`visual.color`); undefined leaves the presentation's role default.
 */
export function spellTone(manifest: GameContentManifest | undefined, spell: SpellDefinition): string | undefined {
  const element = manifest?.affinityMatrix?.elements?.find((e) => e.id === spell.element);
  return element?.color ?? spell.visual?.color;
}
