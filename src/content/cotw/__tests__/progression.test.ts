import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { Monster } from '../../../engine/entities/monster';
import type { GameDifficulty } from '../../../engine/types';
import { DrinkPotionAction } from '../../../engine/actions/spell-actions';
import { createScaledItem, type PotionItem } from '../../../engine';
import { cotwManifest } from '../index';
import { COTW_LEVEL_CAP, COTW_PROGRESSION } from '../progression';
import { COTW_COMBAT } from '../combat';
import { COTW_ATTRIBUTE_MILESTONES, COTW_MILESTONE_TIERS, attributeMilestones, milestoneChoiceId } from '../milestones';
import { COTW_CHOICES } from '../choices';
import { MAX_ATTRIBUTE } from '../../../engine/character/characterRoller';

/**
 * Q4 "B", Q25 "approved" (tracker 3.1): levels cap at 50; a full clear reaches about 47 on
 * every difficulty, and the last three come from revisiting or the Mead of Suttungr.
 * `npm run balance` measures the same per floor with 20 seeds.
 */
const SEEDS = [8100, 8101, 8102, 8103];
const LAST_FLOOR = 50;

/** XP a full clear offers: the raid and every monster present when floors 1–50 are generated. */
function fullClearXp(seed: number, difficulty: GameDifficulty): number {
  const profiles = new ProfileManager(new MemoryStorage(), cotwManifest);
  const hostileXp = (engine: ReturnType<typeof profiles.createCharacter>['engine']): number =>
    engine.map
      .getAllEntities()
      .filter((e): e is Monster => e instanceof Monster && e.isAlive() && e.faction !== 'player' && e !== engine.companion)
      .reduce((sum, m) => sum + m.xpValue, 0);
  const { engine: raid } = profiles.createCharacter('Saga', { seed, difficulty, prologue: true });
  let xp = hostileXp(raid);
  const { engine } = profiles.createCharacter('Saga', { seed, difficulty });
  engine.onChoiceInteract = undefined;
  for (let floor = 1; floor <= LAST_FLOOR; floor++) {
    engine.changeFloor(floor);
    xp += hostileXp(engine);
  }
  return xp;
}

function levelAfter(xp: number): number {
  const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 1 });
  engine.player.gainXp(xp);
  return engine.player.level;
}

describe('cotw progression (Q4 "B", Q25)', () => {
  it('is the pack’s own: cap 50, XP to the next level rising as level^1.5', () => {
    expect(cotwManifest.progressionConfig).toBe(COTW_PROGRESSION);
    expect(COTW_LEVEL_CAP).toBe(50);
    expect(COTW_PROGRESSION.maxLevel).toBe(50);
    const need = COTW_PROGRESSION.getXpForNextLevel!;
    expect(need(1)).toBe(90);
    expect(need(2)).toBe(255);
    expect(need(10)).toBe(2846);
    expect(need(47)).toBe(28999);
    expect(COTW_PROGRESSION.respawnXpShare).toBe(0.25);
  });

  it('gives a level one point, +5 HP and +4 Seiðr, no Attack or Defense, and a heal that grows with Constitution (Q5, Q26, Q28)', () => {
    expect(COTW_PROGRESSION.statPointsPerLevel).toBe(1);
    expect(COTW_PROGRESSION.statGains).toEqual({ maxHp: 5, maxMana: 4, baseAttack: 0, baseDefense: 0 });
    expect(COTW_PROGRESSION.levelUpHeal).toEqual({ percent: 0.3, perConstitutionAbove: 0.03, baseline: 10, cap: 0.9 });
    expect(cotwManifest.combatConfig).toBe(COTW_COMBAT);
    expect(COTW_COMBAT.attributeScaling).toEqual({
      baseline: 10,
      meleeDamagePerStrength: 1,
      meleeBaseHitPercent: 80,
      meleeHitPercentPerDexterity: 2,
      evasionPerDexterity: 0.01,
      spellPowerPerIntelligence: 0.03,
    });
  });

  it('stops at level 50 however much XP comes after', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 1 });
    engine.player.gainXp(10_000_000);
    expect(engine.player.level).toBe(50);
    expect(engine.player.isAtLevelCap).toBe(true);
  });

  it.each<GameDifficulty>(['easy', 'medium', 'hard'])('reaches about level 47 on a full clear (%s)', (difficulty) => {
    const levels = SEEDS.map((seed) => levelAfter(fullClearXp(seed, difficulty)));
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    expect(mean, levels.join(', ')).toBeGreaterThanOrEqual(46);
    expect(mean, levels.join(', ')).toBeLessThanOrEqual(48);
  }, 60_000);

  describe('attribute milestones (Q6 "starting at 20", Q26 "tiers 20, 25 and 30, cap 16")', () => {
    it('offers a choice at 20, 25 and 30 for each attribute, as far as the choices are written', () => {
      expect([...COTW_MILESTONE_TIERS]).toEqual([20, 25, 30]);
      expect(cotwManifest.attributeMilestones).toBe(COTW_ATTRIBUTE_MILESTONES);
      for (const trigger of COTW_ATTRIBUTE_MILESTONES) {
        expect(COTW_MILESTONE_TIERS).toContain(trigger.threshold);
        expect(trigger.choiceId).toBe(milestoneChoiceId(trigger.attribute, trigger.threshold));
        expect(COTW_CHOICES[trigger.choiceId]).toBeDefined();
      }
      // The first tier is built for all four; 25 and 30 wait for the owner's perk lists (3.4, 3.6).
      for (const attribute of ['strength', 'dexterity', 'constitution', 'intelligence'] as const) {
        expect(COTW_ATTRIBUTE_MILESTONES.some((t) => t.attribute === attribute && t.threshold === 20)).toBe(true);
      }
      expect(COTW_ATTRIBUTE_MILESTONES.some((t) => t.threshold < 20)).toBe(false);
    });

    it('opens a tier as soon as its choice exists', () => {
      const withTier25 = { ...COTW_CHOICES, [milestoneChoiceId('strength', 25)]: COTW_CHOICES[milestoneChoiceId('strength', 20)] };
      expect(attributeMilestones(withTier25).filter((t) => t.threshold === 25).map((t) => t.attribute)).toEqual(['strength']);
    });

    it('is never reached by a fresh roll: the starting cap sits below the first tier', () => {
      expect(MAX_ATTRIBUTE).toBeLessThan(COTW_MILESTONE_TIERS[0]);
    });
  });

  describe('the Mead of Suttungr (Q25: a rare level potion)', () => {
    const def = cotwManifest.items.find((d) => d.id === 'mead_of_suttungr')!;
    const brew = (seed = 1) => {
      const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed });
      const mead = createScaledItem(def, 'mead-1', 30, () => 0.5) as PotionItem;
      engine.player.inventory.primaryPack.addItem(mead);
      return { engine, mead };
    };

    it('is a rare Act 2 find that is never sold: from floor 20, at a fraction of an ordinary item’s weight', () => {
      expect(def.minFloor).toBe(20);
      expect(def.lootWeight).toBeLessThanOrEqual(0.5);
      expect(def.potionConfig?.effects).toEqual([{ type: 'gain_level' }]);
      expect(def.identified).toBe(false);
    });

    it('raises the drinker exactly one level, with the level-up log line and event', () => {
      const { engine, mead } = brew();
      engine.player.gainXp(1_000); // mid-level, so the draught must pay the remainder exactly
      const before = engine.player.level;
      const events: string[] = [];
      engine.onGameEvent = (e) => void events.push(e.type);

      const result = new DrinkPotionAction(engine.player, mead).perform(engine);

      expect(result.success).toBe(true);
      expect(engine.player.level).toBe(before + 1);
      expect(engine.player.xp).toBe(0);
      expect(events).toContain('player_leveled_up');
      expect(engine.messages.some((line) => line.includes(`Welcome to Level ${before + 1}`))).toBe(true);
      expect(engine.player.inventory.primaryPack.getItems()).not.toContain(mead);
    });

    it('is refused, and kept, at the level cap', () => {
      const { engine, mead } = brew();
      engine.player.gainXp(10_000_000);
      expect(engine.player.level).toBe(COTW_LEVEL_CAP);

      const result = new DrinkPotionAction(engine.player, mead).perform(engine);

      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(engine.player.inventory.primaryPack.getItems()).toContain(mead);
    });
  });
});
