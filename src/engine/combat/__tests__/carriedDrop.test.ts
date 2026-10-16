import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { Item } from '../../items/item';
import { MeleeAttackAction } from '../../actions/combat';
import { RangedAttackAction } from '../../actions/rangedAttack';
import { CastSpellAction } from '../../actions/spell-actions';
import { TrapInstance } from '../../dungeon/traps';
import { applyImpulse } from '../impulse';
import { DeathResolver } from '../deathResolver';
import { killRiteConditionsMet } from '../../magic/killRites';
import { deserializeMapObject, serializeMapObject } from '../../storage/serializer';
import { useTestSpells } from '../../__fixtures__/testHelpers';

/**
 * P-34's carrier: what a monster carries drops however it dies (risk 8 of the magic plan: deaths
 * by poison, fire, chasm and trap pass no killer), is saved with it, and a deep sleeper wakes
 * only when struck or alarmed.
 */
describe('A carried item and a deep sleep (P-34)', () => {
  useTestSpells([
    { id: 'firebolt', name: 'Firebolt', school: 'Combat', manaCost: 5, element: 'fire', range: 7, basePower: 12, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 12, element: 'fire' }] },
  ]);

  let engine: GameEngine;
  let player: Player;

  const shard = () => new Item({ id: 'shard-1', name: 'Rune Shard', category: 'quest', weight: 1, bulk: 1 });

  const carrier = (x: number, y: number, hp = 1, faction?: 'player') => {
    const m = new Monster({
      id: faction ? 'ally' : 'carrier',
      name: faction ? 'Ally' : 'Carrier',
      position: { x, y },
      stats: { hp, maxHp: 40, attack: faction ? 50 : 1, defense: 0 },
      speed: 100,
      aiType: 'melee',
      xpValue: 0,
      faction,
    });
    if (!faction) m.addItem(shard());
    engine.addEntity(m);
    return m;
  };

  /** The shard lies on the death tile or beside it (a drop steps off doors, stairs and water). */
  const shardNear = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (engine.map.getItemsAt(x + dx, y + dy).some((i) => i.id === 'shard-1')) return true;
      }
    }
    return false;
  };

  beforeEach(() => {
    player = new Player({
      position: { x: 2, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 30, defense: 2 },
      mana: 50,
      maxMana: 50,
      spellsKnown: ['firebolt'],
    });
    engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player, seed: 7 });
    engine.rng = () => 0;
  });

  describe('drops however it dies', () => {
    it('by a melee blow', () => {
      const m = carrier(3, 5);
      new MeleeAttackAction(player, m).perform(engine);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(3, 5)).toBe(true);
    });

    it('by an arrow', () => {
      const m = carrier(6, 5);
      player.inventory.paperdoll.equip(
        new Item({ id: 'bow', name: 'Bow', category: 'weapon', slot: 'mainHand', weight: 1200, bulk: 3000, rangedConfig: { range: 8, ammoType: 'arrow', baseDamage: 8 } }),
        'mainHand'
      );
      player.inventory.primaryPack.addItem(new Item({ id: 'arrows', name: 'Arrows', category: 'misc', weight: 500, bulk: 500 }));
      new RangedAttackAction(player, m.x, m.y).perform(engine);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(6, 5)).toBe(true);
    });

    it('by a spell', () => {
      const m = carrier(5, 5);
      new CastSpellAction(player, 'firebolt', m.x, m.y).perform(engine);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(5, 5)).toBe(true);
    });

    it('by poison, with no killer', () => {
      const m = carrier(8, 8);
      m.statusManager.applyStatus('poison', 5, 4);
      m.takeTurn(engine);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(8, 8)).toBe(true);
    });

    it('by burning ground', () => {
      const m = carrier(8, 8);
      engine.surfaces.setSurface(8, 8, 'fire', 8, 5);
      engine.surfaces.handleEntityStep(m, 8, 8, 0, 0, engine);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(8, 8)).toBe(true);
    });

    it('by a pit trap', () => {
      const m = carrier(8, 8);
      new TrapInstance({ id: 'pit', type: 'pit', x: 8, y: 8, damage: 30 }).trigger(m, engine);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(8, 8)).toBe(true);
    });

    it('by a fall into the chasm', () => {
      const m = carrier(3, 5, 40);
      engine.map.setTile(4, 5, TILES.CHASM);
      applyImpulse(engine, player, m, 1, 0, 2);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(m.x, m.y)).toBe(true);
    });

    it("by an ally's blow", () => {
      const m = carrier(8, 8);
      const ally = carrier(7, 8, 40, 'player');
      new MeleeAttackAction(ally, m).perform(engine);
      expect(m.isAlive()).toBe(false);
      expect(shardNear(8, 8)).toBe(true);
    });
  });

  it('saves what it carries, and its deep sleep', () => {
    const m = carrier(8, 8, 40);
    m.deepSleep = true;
    const loaded = deserializeMapObject(JSON.parse(JSON.stringify(serializeMapObject(engine.map))));
    const again = loaded.getAllEntities().find((e) => e.id === m.id) as Monster;
    expect(again.getItems().map((i) => i.id)).toEqual(['shard-1']);
    expect(again.deepSleep).toBe(true);
  });

  it('saves nothing extra for a plain monster', () => {
    const m = new Monster({ id: 'plain', name: 'Plain', position: { x: 8, y: 8 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } });
    engine.addEntity(m);
    const saved = serializeMapObject(engine.map).monsters?.find((s) => s.id === 'plain');
    expect(saved?.carried).toBeUndefined();
    expect(saved?.deepSleep).toBeUndefined();
  });

  describe('deep sleep', () => {
    it('does not wake on sight, where a light sleeper does', () => {
      const deep = carrier(4, 5, 40);
      deep.deepSleep = true;
      const light = new Monster({ id: 'light', name: 'Light', position: { x: 4, y: 6 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } });
      engine.addEntity(light);
      engine.updateFov();
      deep.takeTurn(engine);
      expect(deep.aiState).toBe('sleeping');
      expect(light.aiState).toBe('hunting');
    });

    it('wakes when struck or alarmed', () => {
      const struck = carrier(4, 5, 40);
      struck.deepSleep = true;
      struck.takeDamage(1);
      expect(struck.aiState).toBe('hunting');
      const alarmed = carrier(8, 8, 40);
      alarmed.deepSleep = true;
      alarmed.alert();
      expect(alarmed.aiState).toBe('hunting');
    });
  });

  describe('the sleep kill', () => {
    const rite = { hintVerse: '', essenceElement: 'fire', requiresVictimAsleep: true };

    it('counts a sleeper slain by the blow that woke it', () => {
      const m = carrier(3, 5);
      new MeleeAttackAction(player, m).perform(engine);
      expect(killRiteConditionsMet(engine, rite, m)).toBe(true);
    });

    it('counts a sleeper struck twice before it could act', () => {
      const m = carrier(3, 5, 40);
      m.takeDamage(5);
      expect(killRiteConditionsMet(engine, rite, m)).toBe(true);
    });

    it('does not count once it has had a turn since the blow', () => {
      const m = carrier(3, 5, 40);
      m.takeDamage(5);
      m.takeTurn(engine);
      expect(killRiteConditionsMet(engine, rite, m)).toBe(false);
    });

    it('does not count a monster that was awake', () => {
      const m = carrier(3, 5, 40);
      m.aiState = 'hunting';
      m.takeDamage(5);
      expect(killRiteConditionsMet(engine, rite, m)).toBe(false);
    });

    it('teaches nothing through a death no blow dealt, as before', () => {
      const m = carrier(8, 8);
      m.statusManager.applyStatus('poison', 5, 4);
      expect(m.killedInItsSleep()).toBe(true);
      // The rite itself only ever looks at a player-side kill (`KillRiteManager.evaluate`).
      DeathResolver.resolveDeath(engine, undefined, m);
      expect(player.spellsKnown).toEqual(['firebolt']);
    });
  });
});
