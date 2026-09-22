import { describe, it, expect } from 'vitest';
import {
  warcraftManifest,
  WARCRAFT_MONSTERS,
  WARCRAFT_ITEMS,
  WARCRAFT_SPELLS,
  WARCRAFT_TOWN,
  WARCRAFT_QUEST,
  WARCRAFT_STARTER_KIT,
  WARCRAFT_AFFINITY_MATRIX,
  WARCRAFT_THEME_TOKENS,
  WARCRAFT_AI_BEHAVIORS,
  WARCRAFT_ACTION_HOOKS,
  WARCRAFT_STATUS_HANDLERS,
  WARCRAFT_COMBAT_CONFIG,
  WARCRAFT_PROGRESSION_CONFIG,
} from '../index';
import { validateManifest } from '../../../engine';

describe('Warcraft Content Pack: Manifest & Data Validation', () => {
  describe('validateManifest contract', () => {
    it('passes engine core manifest validation without throwing', () => {
      expect(() => validateManifest(warcraftManifest)).not.toThrow();
    });

    it('defines standard metadata and iconic hero preset names', () => {
      expect(warcraftManifest.id).toBe('warcraft');
      expect(warcraftManifest.name).toBe('Warcraft: Orcs & Humans');
      expect(warcraftManifest.presetNames).toContain('Lothar');
      expect(warcraftManifest.presetNames).toContain('Garona');
      expect(warcraftManifest.presetNames).toContain('Khadgar');
      expect(warcraftManifest.presetNames).toContain('Medivh');
    });
  });

  describe('Monsters Catalogue (WARCRAFT_MONSTERS)', () => {
    it('defines non-empty monster roster with valid combat statistics', () => {
      expect(WARCRAFT_MONSTERS.length).toBeGreaterThan(0);

      for (const monster of WARCRAFT_MONSTERS) {
        expect(monster.id).toBeDefined();
        expect(monster.name).toBeDefined();
        expect(monster.minFloor).toBeGreaterThanOrEqual(1);
        expect(monster.stats.hp).toBeGreaterThan(0);
        expect(monster.stats.maxHp).toBe(monster.stats.hp);
        expect(monster.stats.attack).toBeGreaterThan(0);
        expect(monster.stats.defense).toBeGreaterThanOrEqual(0);
        expect(monster.speed).toBeGreaterThan(0);
        expect(monster.aiType).toBeDefined();
        expect(monster.fleeHealthPercent).toBeGreaterThanOrEqual(0);
        expect(monster.fleeHealthPercent).toBeLessThanOrEqual(1);
        expect(monster.xpValue).toBeGreaterThan(0);

        if (monster.lootTable) {
          for (const entry of monster.lootTable) {
            expect(entry.chance).toBeGreaterThan(0);
            expect(entry.chance).toBeLessThanOrEqual(1);
            expect(typeof entry.generate).toBe('function');
          }
        }
      }
    });

    it('contains iconic Warcraft enemy definitions including Peon, Grunt, Raider, Ogre Mage, and Warchief', () => {
      const ids = WARCRAFT_MONSTERS.map((m) => m.id);
      expect(ids).toContain('peon');
      expect(ids).toContain('grunt');
      expect(ids).toContain('raider');
      expect(ids).toContain('ogre_mage');
      expect(ids).toContain('warchief_blackhand');
    });
  });

  describe('Items Catalogue (WARCRAFT_ITEMS)', () => {
    it('defines valid equipment and consumables with weight and value', () => {
      expect(WARCRAFT_ITEMS.length).toBeGreaterThan(0);

      for (const item of WARCRAFT_ITEMS) {
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.category).toBeDefined();
        expect(item.weight).toBeGreaterThanOrEqual(0);
        expect(item.value).toBeGreaterThanOrEqual(0);
      }

      const itemIds = WARCRAFT_ITEMS.map((i) => i.id);
      expect(itemIds).toContain('warhammer');
      expect(itemIds).toContain('greatsword');
      expect(itemIds).toContain('alliance_shield');
    });
  });

  describe('Spells Catalogue (WARCRAFT_SPELLS)', () => {
    it('defines valid spells with damage, healing, and enchantment capabilities', () => {
      expect(WARCRAFT_SPELLS.length).toBeGreaterThan(0);

      for (const spell of WARCRAFT_SPELLS) {
        expect(spell.id).toBeDefined();
        expect(spell.name).toBeDefined();
        expect(spell.school).toBeDefined();
        expect(spell.manaCost).toBeGreaterThanOrEqual(0);
        expect(spell.range).toBeGreaterThanOrEqual(0);
        expect(spell.targetType).toBeDefined();
        expect(spell.effects?.length).toBeGreaterThan(0);
      }

      const spellIds = WARCRAFT_SPELLS.map((s) => s.id);
      expect(spellIds).toContain('chain_lightning');
      expect(spellIds).toContain('holy_light');
      expect(spellIds).toContain('bloodlust');
      expect(spellIds).toContain('fel_fireball');
    });
  });

  describe('Town & Quest Definitions', () => {
    it('defines Stormwind Outpost town layout with buildings and within-bounds player spawn', () => {
      expect(WARCRAFT_TOWN.name).toBe('Stormwind Outpost');
      expect(WARCRAFT_TOWN.width).toBeGreaterThan(0);
      expect(WARCRAFT_TOWN.height).toBeGreaterThan(0);
      expect(WARCRAFT_TOWN.playerSpawn.x).toBeGreaterThanOrEqual(0);
      expect(WARCRAFT_TOWN.playerSpawn.x).toBeLessThan(WARCRAFT_TOWN.width);
      expect(WARCRAFT_TOWN.playerSpawn.y).toBeGreaterThanOrEqual(0);
      expect(WARCRAFT_TOWN.playerSpawn.y).toBeLessThan(WARCRAFT_TOWN.height);
      expect(WARCRAFT_TOWN.buildings.length).toBeGreaterThan(0);
    });

    it('defines dungeon campaign quest ending with Blackhand boss', () => {
      expect(WARCRAFT_QUEST.name).toContain('Blackrock Spire');
      expect(WARCRAFT_QUEST.bossMonsterId).toBe('warchief_blackhand');
      expect(WARCRAFT_QUEST.maxFloor).toBe(5);
      expect(Object.keys(WARCRAFT_QUEST.floorEncounters).length).toBeGreaterThan(0);
    });
  });

  describe('Theme, Affinities & Config', () => {
    it('provides affinity matrix covering elemental interactions without NaN', () => {
      expect(WARCRAFT_AFFINITY_MATRIX).toBeDefined();
      expect(Object.keys(WARCRAFT_AFFINITY_MATRIX).length).toBeGreaterThan(0);
    });

    it('provides UI and CRT theme styling tokens', () => {
      expect(WARCRAFT_THEME_TOKENS.bg).toBeDefined();
      expect(WARCRAFT_THEME_TOKENS.panel).toBeDefined();
      expect(WARCRAFT_THEME_TOKENS.text).toBeDefined();
      expect(WARCRAFT_THEME_TOKENS.accent).toBeDefined();
    });

    it('wires behavioral extensions: Warchief AI, battle cry hook, and burning status', () => {
      expect(WARCRAFT_AI_BEHAVIORS).toBeDefined();
      expect(WARCRAFT_AI_BEHAVIORS.warchief).toBeDefined();
      expect(WARCRAFT_AI_BEHAVIORS.warchief.id).toBe('warchief');

      expect(WARCRAFT_ACTION_HOOKS).toBeDefined();
      expect(WARCRAFT_ACTION_HOOKS.some((h) => h.id === 'warcraft-battle-cry')).toBe(true);

      expect(WARCRAFT_STATUS_HANDLERS['burning']).toBeDefined();
    });

    it('provides combat, progression, and starter kit configs', () => {
      expect(WARCRAFT_COMBAT_CONFIG.critMultiplier).toBeGreaterThan(1);
      expect(WARCRAFT_PROGRESSION_CONFIG.baseXp).toBeGreaterThan(0);
      expect(WARCRAFT_STARTER_KIT.weaponItemId).toBe('warhammer');
      expect(WARCRAFT_STARTER_KIT.packItemIds?.length).toBeGreaterThan(0);
    });
  });
});
