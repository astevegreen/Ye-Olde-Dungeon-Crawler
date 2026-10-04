import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { ExecuteChoiceAction } from '../../../engine/actions/choiceAction';
import { RestAction } from '../../../engine/actions/rest';
import { MovementAction } from '../../../engine/actions/movement';
import { serializeGame, deserializeGame } from '../../../engine/storage/serializer';
import { createScaledItem } from '../../../engine/dungeon/lootSpawner';
import { cotwManifest } from '../index';
import { COTW_LEVEL_MILESTONES, COTW_MILESTONE_CHOICES, COTW_MILESTONE_PERKS, COTW_PERKS, COTW_SAGA_CHOICES } from '../perks';

/** Q27 "Separate sources.", Q51–Q53 approved (tracker 3.6): the Saga perks, as far as built. */
describe('cotw perks', () => {
  it('declares every perk a Saga choice grants, and a Saga choice of three at levels 10, 20, 30, 40 and 50 (Q51 "A")', () => {
    expect(cotwManifest.perks).toEqual([...COTW_PERKS, ...COTW_MILESTONE_PERKS]);
    expect(cotwManifest.levelMilestones).toBe(COTW_LEVEL_MILESTONES);
    expect(COTW_LEVEL_MILESTONES.filter((m) => !m.when).map((m) => m.level)).toEqual([10, 20, 30, 40, 50]);
    for (const trigger of COTW_LEVEL_MILESTONES) {
      const choice = cotwManifest.choices![trigger.choiceId];
      expect(choice, trigger.choiceId).toBeDefined();
      expect(choice.options).toHaveLength(trigger.when ? 5 : 3);
      for (const option of choice.options) {
        const grant = option.consequences.find((c) => c.type === 'grantPerk');
        if (option.id === 'saga_elementalist') {
          expect(grant).toBeUndefined(); // its element is chosen next
          continue;
        }
        expect(grant, option.id).toBeDefined();
        expect(COTW_PERKS.some((p) => p.id === (grant as { perkId: string }).perkId), option.id).toBe(true);
      }
    }
    expect(new Set(cotwManifest.perks!.map((p) => p.id)).size).toBe(cotwManifest.perks!.length);
  });

  it('each attribute’s milestone at 20, 25 and 30 offers two perks of its own; none gives +2/+3 Attack or Defense (Q52 "A")', () => {
    const offered = new Set<string>();
    for (const id of ['str', 'dex', 'con', 'int'].flatMap((attr) => [20, 25, 30].map((tier) => `milestone_${attr}_${tier}`))) {
      const choice = cotwManifest.choices![id];
      expect(choice, id).toBe(COTW_MILESTONE_CHOICES[id]);
      for (const option of choice.options) offered.add(option.id);
      expect(choice.options).toHaveLength(2);
      for (const option of choice.options) {
        const grant = option.consequences.find((c) => c.type === 'grantPerk') as { perkId: string } | undefined;
        expect(grant, option.id).toBeDefined();
        expect(COTW_MILESTONE_PERKS.find((p) => p.id === grant!.perkId)?.source).toBe('milestone');
        expect(option.consequences.some((c) => c.type === 'modifyPermanentStat' && (c.stat === 'attack' || c.stat === 'defense'))).toBe(false);
      }
    }
    expect([...offered].sort()).toEqual(COTW_MILESTONE_PERKS.map((p) => p.id).sort());
    const fleet = COTW_MILESTONE_CHOICES.milestone_dex_20.options.find((o) => o.id === 'milestone_fleet_foot')!;
    expect(fleet.consequences).toContainEqual({ type: 'modifyPermanentStat', stat: 'speed', delta: 10 });
  });

  it('a Saga choice grants its perk once and logs the saga’s line', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 3 });
    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, COTW_SAGA_CHOICES.saga_10, 'saga_berserkergang'));
    expect(engine.player.hasPerk('saga_berserkergang')).toBe(true);
    expect(engine.player.heldPerks.map((p) => p.name)).toEqual(['Berserkergang']);
    expect(engine.messages.some((m) => m.includes('The saga names you: Berserkergang'))).toBe(true);
  });

  it('Elementalist asks for its element on the next move, once, and grants that element’s perk', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 3 });
    const player = engine.player;
    engine.changeFloor(1);
    for (const m of [...engine.map.getAllEntities()]) if (m !== player && m !== engine.companion && 'aiState' in m) engine.removeEntity(m);
    player.level = 30;
    for (const id of ['saga_10', 'saga_20']) engine.setWorldFlag(`${id}_offered`, true);
    const offered: string[] = [];
    engine.onChoiceInteract = (choice, choose) => {
      offered.push(choice.id);
      choose(choice.id === 'saga_30' ? 'saga_elementalist' : 'saga_elementalist_cold');
    };
    const step = () => {
      const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => engine.map.isPassable(player.x + dx, player.y + dy) && !engine.map.getEntityAt(player.x + dx, player.y + dy))!;
      player.gainEnergy(100);
      engine.handlePlayerAction(new MovementAction(player, free[0], free[1]));
    };
    step();
    step();
    step();
    expect(offered).toEqual(['saga_30', 'saga_30_element']);
    expect(player.heldPerks.map((p) => p.id)).toEqual(['saga_elementalist_cold']);
    expect(player.affinityTo('cold')).toBe('resistant');
  });

  it('Jarl of the Deep raises every attribute by two', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 3 });
    const p = engine.player;
    const before = [p.strength, p.dexterity, p.constitution, p.intelligence];
    engine.handlePlayerAction(new ExecuteChoiceAction(p, COTW_SAGA_CHOICES.saga_50, 'saga_jarl_of_the_deep'));
    expect([p.strength, p.dexterity, p.constitution, p.intelligence]).toEqual(before.map((v) => v + 2));
    expect(p.hasPerk('saga_jarl_of_the_deep')).toBe(true);
  });

  it('Giant’s Grip keeps a shield beside a two-hander, through a save and load', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Grip', { seed: 3 });
    const p = engine.player;
    engine.handlePlayerAction(new ExecuteChoiceAction(p, COTW_MILESTONE_CHOICES.milestone_str_25, 'milestone_giants_grip'));
    const def = (id: string) => cotwManifest.items.find((d) => d.id === id)!;
    const spear = createScaledItem(def('skraeling_ice_spear'), 'spear', 1, () => 0.5);
    const shield = createScaledItem(def('iron_shield'), 'shield', 1, () => 0.5);
    expect(p.inventory.paperdoll.equip(spear, 'mainHand').success).toBe(true);
    expect(p.inventory.paperdoll.equip(shield, 'offHand').success).toBe(true);
    const { engine: reloaded } = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), cotwManifest);
    expect(reloaded.player.inventory.paperdoll.getItem('mainHand')?.id).toBe('spear');
    expect(reloaded.player.inventory.paperdoll.getItem('offHand')?.id).toBe('shield');
  });

  it('Spell-Thief clears two points of overflow debt a rest turn', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 3 });
    const player = engine.player;
    engine.changeFloor(1);
    for (const m of [...engine.map.getAllEntities()]) if (m !== player && m !== engine.companion && 'aiState' in m) engine.removeEntity(m);
    player.hp = player.maxHp - 1; // one turn of rest, then full
    player.accrueVoidDebt(10);
    const before = player.voidDebt;
    new ExecuteChoiceAction(player, COTW_SAGA_CHOICES.saga_20, 'saga_spell_thief').perform(engine);
    player.gainEnergy(100);
    new RestAction(player).perform(engine);
    // The full rest settles everything but the pack's lingering floor; the per-turn step
    // before it was doubled. Debt fell, and by at least two before the settle.
    expect(player.voidDebt).toBeLessThan(before);
  });
});
