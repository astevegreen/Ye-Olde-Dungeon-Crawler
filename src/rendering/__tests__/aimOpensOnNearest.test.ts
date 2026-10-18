import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, Monster, Player, type SpellDefinition } from '../../engine';
import { TargetingOverlay, type SpellbookEntry } from '../targeting-overlay';

// The aim opened on whichever foe the floor listed first, often one across the room, while a
// wolf stood two steps away (playtest, 18 Oct). It opens on the nearest foe in sight.
describe('the aim reticle as it opens', () => {
  const spell = { id: 'bolt', name: 'Bolt', element: 'fire', manaCost: 3, range: 6, reflects: false, targetType: 'ray', targetingMode: 'ray', areaOfEffect: 0, effects: [] } as unknown as SpellDefinition;
  const entry: SpellbookEntry = { key: '1', type: 'spell', id: 'bolt', name: 'Bolt', spellDef: spell };
  const foe = (id: string, x: number, y: number) =>
    new Monster({ id, name: id, position: { x, y }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 } });

  it('sits on the nearest foe in sight, not the first one listed', () => {
    const map = GameMap.createBoxRoom(14, 14);
    const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } }), floor: 1 });
    map.addEntity(foe('far', 6, 2));
    map.addEntity(foe('near', 4, 3));
    engine.updateFov();

    const overlay = new TargetingOverlay();
    overlay.startTargeting(entry, engine);
    expect([overlay.reticleX, overlay.reticleY]).toEqual([4, 3]);
  });
});
