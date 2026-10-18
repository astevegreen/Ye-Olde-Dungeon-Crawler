import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine, GameMap, Player, TILES, registerSpells, activateRegistries, SpellRegistry, type GameContentManifest } from '../../engine';
import { TargetingOverlay } from '../targeting-overlay';

// Enter on the hero's own tile refused the bolt, and the aim closed with nothing in the log:
// the refusal came back from the command and nothing showed it (playtest, 18 Oct).
describe('a cast the aim fires and the engine refuses', () => {
  const manifest = {
    id: 'test_manifest',
    name: 'Test Realm',
    monsters: [],
    items: [],
    spells: [
      { id: 'magic_arrow', name: 'Magic Arrow', school: 'Combat', manaCost: 3, element: 'arcane', range: 6, basePower: 8, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 8, element: 'arcane' }] },
    ],
  } as unknown as GameContentManifest;

  afterAll(() => {
    activateRegistries(null);
    SpellRegistry.clear();
  });

  it('says why in the log', () => {
    const map = new GameMap(12, 12);
    map.fill(TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Sven', position: { x: 4, y: 4 } });
    player.spellsKnown = ['magic_arrow'];
    player.mana = 20;
    player.maxMana = 20;
    registerSpells(manifest.spells);
    const engine = new GameEngine({ manifest, map, player, floor: 1 });

    const overlay = new TargetingOverlay();
    overlay.startTargeting({ key: '1', type: 'spell', id: 'magic_arrow', name: 'Magic Arrow', spellDef: manifest.spells[0] }, engine);
    overlay.aimAt(4, 4, engine);
    const result = overlay.confirmFire(engine);

    expect(result?.success).toBe(false);
    expect(player.mana).toBe(20);
    expect(engine.messages[engine.messages.length - 1]).toContain('needs a direction');
  });
});
