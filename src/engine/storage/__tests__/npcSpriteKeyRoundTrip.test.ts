import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame } from '../serializer';
import { NPC } from '../../entities/npc';
import { cotwManifest } from '../../../content/cotw';

describe('an NPC’s worn sprite across save/load', () => {
  it('keeps the sprite of whoever stands in another’s place', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Keeper', { seed: 8 });
    engine.changeFloor(2);
    const free = engine.map.getAllEntities()[0];
    const at = { x: free.x + 1, y: free.y };
    engine.map.addEntity(new NPC({ id: 'stand-in', name: 'Eir', role: 'villager', position: at, spriteKey: 'prologue-eir' }));
    engine.map.addEntity(new NPC({ id: 'plain', name: 'Leif', role: 'villager', position: { x: at.x + 1, y: at.y } }));

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;

    expect((loaded.map.getEntityById('stand-in') as NPC).spriteKey).toBe('prologue-eir');
    expect((loaded.map.getEntityById('plain') as NPC).spriteKey).toBeUndefined();
  });
});
