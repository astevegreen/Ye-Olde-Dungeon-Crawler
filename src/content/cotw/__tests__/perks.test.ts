import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { ExecuteChoiceAction } from '../../../engine/actions/choiceAction';
import { RestAction } from '../../../engine/actions/rest';
import { cotwManifest } from '../index';
import { COTW_LEVEL_MILESTONES, COTW_MILESTONE_CHOICES, COTW_MILESTONE_PERKS, COTW_PERKS, COTW_SAGA_CHOICES } from '../perks';

/** Q27 "Separate sources.", Q51–Q53 approved (tracker 3.6): the Saga perks, as far as built. */
describe('cotw perks', () => {
  it('declares every perk a Saga choice grants, and a Saga choice at levels 10 and 20', () => {
    expect(cotwManifest.perks).toEqual([...COTW_PERKS, ...COTW_MILESTONE_PERKS]);
    expect(cotwManifest.levelMilestones).toBe(COTW_LEVEL_MILESTONES);
    expect(COTW_LEVEL_MILESTONES.map((m) => m.level)).toEqual([10, 20]);
    for (const trigger of COTW_LEVEL_MILESTONES) {
      const choice = cotwManifest.choices![trigger.choiceId];
      expect(choice, trigger.choiceId).toBeDefined();
      expect(choice.options).toHaveLength(3);
      for (const option of choice.options) {
        const grant = option.consequences.find((c) => c.type === 'grantPerk');
        expect(grant, option.id).toBeDefined();
        expect(COTW_PERKS.some((p) => p.id === (grant as { perkId: string }).perkId), option.id).toBe(true);
      }
    }
    expect(new Set(cotwManifest.perks!.map((p) => p.id)).size).toBe(cotwManifest.perks!.length);
  });

  it('each attribute’s 20 milestone offers two perks of its own instead of +2/+3 Attack or Defense (Q52 "A")', () => {
    for (const attr of ['str', 'dex', 'con', 'int']) {
      const choice = cotwManifest.choices![`milestone_${attr}_20`];
      expect(choice, attr).toBe(COTW_MILESTONE_CHOICES[`milestone_${attr}_20`]);
      expect(choice.options).toHaveLength(2);
      for (const option of choice.options) {
        const grant = option.consequences.find((c) => c.type === 'grantPerk') as { perkId: string } | undefined;
        expect(grant, option.id).toBeDefined();
        expect(COTW_MILESTONE_PERKS.find((p) => p.id === grant!.perkId)?.source).toBe('milestone');
        expect(option.consequences.some((c) => c.type === 'modifyPermanentStat' && (c.stat === 'attack' || c.stat === 'defense'))).toBe(false);
      }
    }
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
