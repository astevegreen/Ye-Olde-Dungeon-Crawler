import type { HeroSpriteArt, Player } from '../../engine';
import type { SpriteAtlas } from './sprite-atlas';

/**
 * The hero's sprite key for the gear they wear now, defining that look in the atlas the
 * first time it is worn; null when the pack draws no gear (`manifest.heroSprite`).
 */
export function heroSpriteKey(player: Player, atlas: SpriteAtlas, art: HeroSpriteArt | undefined): string | null {
  if (!art) return null;
  const look = art.lookKey({ gender: player.gender, equipped: (slot) => player.inventory.paperdoll.getItem(slot) });
  const key = `hero:${look}`;
  if (!atlas.hasFigure(key)) atlas.defineFigure(key, art.sprite(look), { transient: true });
  return key;
}
