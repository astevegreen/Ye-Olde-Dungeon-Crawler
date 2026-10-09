import type { ContainerStateArt, FixtureArt, PixelSprite } from '../../engine';

/** A ground container's state as the map shows it: by its drawing when the pack has one, else by a badge. */
export type ContainerState = keyof ContainerStateArt;

const CONTAINER_STATES: readonly ContainerState[] = ['unopened', 'opened', 'empty'];

/** A heap of several items: the pack's `FixtureArt.lootPile`, or a `loot_pile` recipe. */
const LOOT_PILE_KEY = 'loot_pile';
const LARGE_LOOT_PILE_KEY = 'loot_pile.large';
const LARGE_LOOT_PILE = 4;

/** The atlas key of a tile type's drawing (`FixtureArt.tiles`). */
export const fixtureTileKey = (type: string): string => `fixture.${type}`;

/** The atlas key of a container's look in `state` (`FixtureArt.containers`). */
export const containerStateKey = (spriteKey: string, state: ContainerState): string => `${spriteKey}.${state}`;

/** The heap drawn for `count` items: the large one from four, when the pack draws it. */
export function lootPileKey(count: number, hasSprite: (key: string) => boolean): string {
  return count >= LARGE_LOOT_PILE && hasSprite(LARGE_LOOT_PILE_KEY) ? LARGE_LOOT_PILE_KEY : LOOT_PILE_KEY;
}

/** `FixtureArt` as atlas figures, under the keys above. */
export function fixtureFigures(art: FixtureArt | undefined): Record<string, PixelSprite> {
  const figures: Record<string, PixelSprite> = {};
  if (!art) return figures;
  for (const [type, sprite] of Object.entries(art.tiles ?? {})) figures[fixtureTileKey(type)] = sprite;
  for (const [key, looks] of Object.entries(art.containers ?? {})) {
    for (const state of CONTAINER_STATES) figures[containerStateKey(key, state)] = looks[state];
  }
  if (art.lootPile) {
    figures[LOOT_PILE_KEY] = art.lootPile.small;
    if (art.lootPile.large) figures[LARGE_LOOT_PILE_KEY] = art.lootPile.large;
  }
  return figures;
}
