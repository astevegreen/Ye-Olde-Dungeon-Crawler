import { describe, it, expect } from 'vitest';
import {
  getTerrainSpriteKey,
  getEntitySpriteKey,
  getItemSpriteKey,
  DEFAULT_TAG_SPRITE_ORDER,
} from '../sprite-mapper';
import { Player } from '../../../engine';
import { Monster } from '../../../engine';
import { NPC } from '../../../engine';
import type { Item } from '../../../engine';
import { COTW_TILE_ZONE_BANDS } from '../../../content/cotw/tileZones';
import { COTW_TOWN } from '../../../content/cotw/town';
import { COTW_SPRITE_RECIPES } from '../../../content/cotw/sprites';
import { WARCRAFT_SPRITE_RECIPES } from '../../../content/warcraft/sprites';
import { cotwManifest } from '../../../content/cotw';
import { ATLAS_MAP } from '../sprite-atlas';

describe('sprite-mapper — Tag-Priority Monster, Item, and Zone-Themed Terrain Resolvers', () => {
  describe('getEntitySpriteKey', () => {
    it('resolves male and female player sprites with blue tint', () => {
      const malePlayer = new Player({
        id: 'p1',
        name: 'Hero',
        position: { x: 0, y: 0 },
        stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
        gender: 'male',
      });
      const femalePlayer = new Player({
        id: 'p2',
        name: 'Heroine',
        position: { x: 0, y: 0 },
        stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
        gender: 'female',
      });

      expect(getEntitySpriteKey(malePlayer)).toBe('player');
      expect(getEntitySpriteKey(femalePlayer)).toBe('player_female');
    });

    it('resolves NPC roles to dedicated sprites', () => {
      const merchant = new NPC({ id: 'npc-1', name: 'Olaf', role: 'merchant', position: { x: 0, y: 0 } });
      const priest = new NPC({ id: 'npc-2', name: 'Torvald', role: 'priest', position: { x: 0, y: 0 } });
      const sage = new NPC({ id: 'npc-3', name: 'Mimir', role: 'sage', position: { x: 0, y: 0 } });
      const banker = new NPC({ id: 'npc-4', name: 'Haakon', role: 'banker', position: { x: 0, y: 0 } });
      const guard = new NPC({ id: 'npc-5', name: 'Bjorn', role: 'guard', position: { x: 0, y: 0 } });

      expect(getEntitySpriteKey(merchant)).toBe('shopkeeper');
      expect(getEntitySpriteKey(priest)).toBe('priest');
      expect(getEntitySpriteKey(sage)).toBe('sage');
      expect(getEntitySpriteKey(banker)).toBe('banker');
      expect(getEntitySpriteKey(guard)).toBe('guard');
    });

    it('draws an NPC from a pack recipe keyed by its id, ahead of its role', () => {
      const smith = new NPC({ id: 'npc-smith', name: 'Smith', role: 'villager', position: { x: 0, y: 0 } });
      expect(getEntitySpriteKey(smith, (k) => k === 'npc-smith')).toBe('npc-smith');
      expect(getEntitySpriteKey(smith, () => false)).toBe('townsperson');
    });

    it('resolves monsters using tag specificity order (boss > dragon > undead > beast > humanoid)', () => {
      const dragon = new Monster({
        id: 'm1',
        name: 'Frost Drake',
        position: { x: 0, y: 0 },
        stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
        speed: 100,
        definitionId: 'frost_drake',
        aiType: 'melee',
        xpValue: 100,
        lootTable: [],
        tags: ['beast', 'dragon'], // dragon should take priority over beast
      });

      const bossMonster = new Monster({
        id: 'm2',
        name: 'Hill Giant King',
        position: { x: 0, y: 0 },
        stats: { hp: 200, maxHp: 200, attack: 20, defense: 10 },
        speed: 100,
        definitionId: 'giant_king',
        aiType: 'melee',
        xpValue: 500,
        lootTable: [],
        tags: ['humanoid', 'boss'], // boss takes priority over humanoid
      });

      const slimeMonster = new Monster({
        id: 'm3',
        name: 'Slag Globule',
        position: { x: 0, y: 0 },
        stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
        speed: 80,
        definitionId: 'slag_globule',
        aiType: 'melee',
        xpValue: 30,
        lootTable: [],
        tags: ['amorphous'],
      });

      const skeletonMonster = new Monster({
        id: 'm4',
        name: 'Ancient Remains',
        position: { x: 0, y: 0 },
        stats: { hp: 15, maxHp: 15, attack: 3, defense: 1 },
        speed: 100,
        definitionId: 'ancient_remains',
        aiType: 'melee',
        xpValue: 20,
        lootTable: [],
        tags: ['undead'],
      });

      expect(getEntitySpriteKey(dragon)).toBe('dragon');
      expect(getEntitySpriteKey(bossMonster)).toBe('giant_boss');
      expect(getEntitySpriteKey(slimeMonster)).toBe('slime');
      expect(getEntitySpriteKey(skeletonMonster)).toBe('skeleton');
    });

    it('falls back to name substring heuristics when tags are absent or unmapped', () => {
      const wolf = new Monster({
        id: 'm-wolf',
        name: 'Winter Wolf',
        position: { x: 0, y: 0 },
        stats: { hp: 25, maxHp: 25, attack: 5, defense: 2 },
        speed: 110,
        definitionId: 'winter_wolf',
        aiType: 'melee',
        xpValue: 40,
        lootTable: [],
      });

      const troll = new Monster({
        id: 'm-troll',
        name: 'Cave Troll',
        position: { x: 0, y: 0 },
        stats: { hp: 60, maxHp: 60, attack: 12, defense: 4 },
        speed: 90,
        definitionId: 'cave_troll',
        aiType: 'melee',
        xpValue: 90,
        lootTable: [],
      });

      expect(getEntitySpriteKey(wolf)).toBe('wolf');
      expect(getEntitySpriteKey(troll)).toBe('troll');
    });
  });

  describe('getItemSpriteKey', () => {
    it('resolves weapon varieties into distinct sprites', () => {
      const broadsword = { id: 'sword-1', name: 'Iron Broadsword', category: 'weapon' } as Item;
      const battleaxe = { id: 'axe-1', name: 'Double Battleaxe', category: 'weapon' } as Item;
      const mace = { id: 'mace-1', name: 'Spiked War Mace', category: 'weapon' } as Item;
      const warhammer = { id: 'hammer-1', name: 'Iron Warhammer', category: 'weapon' } as Item;
      const bow = { id: 'bow-1', name: 'Hunting Bow', category: 'weapon' } as Item;
      const dagger = { id: 'dagger-1', name: 'Rogue Dirk', category: 'weapon' } as Item;

      expect(getItemSpriteKey(broadsword)).toBe('broadsword');
      expect(getItemSpriteKey(battleaxe)).toBe('battleaxe');
      expect(getItemSpriteKey(mace)).toBe('mace');
      expect(getItemSpriteKey(warhammer)).toBe('warhammer');
      expect(getItemSpriteKey(bow)).toBe('bow');
      expect(getItemSpriteKey(dagger)).toBe('dagger');
    });

    it('resolves armors, shields, and accessories', () => {
      const plate = { id: 'armor-plate', name: 'Steel Plate Armor', category: 'armor' } as Item;
      const leather = { id: 'armor-leather', name: 'Studded Leather Robe', category: 'armor' } as Item;
      const ironShield = { id: 'shield-iron', name: 'Tower Shield', category: 'shield' } as Item;
      const woodShield = { id: 'shield-wood', name: 'Wooden Buckler', category: 'shield' } as Item;
      const ring = { id: 'ring-1', name: 'Ring of Power', category: 'ring' } as Item;
      const amulet = { id: 'amulet-1', name: 'Amulet of Vitality', category: 'amulet' } as Item;

      expect(getItemSpriteKey(plate)).toBe('iron_armor');
      expect(getItemSpriteKey(leather)).toBe('leather_armor');
      expect(getItemSpriteKey(ironShield)).toBe('iron_shield');
      expect(getItemSpriteKey(woodShield)).toBe('wooden_shield');
      expect(getItemSpriteKey(ring)).toBe('ring');
      expect(getItemSpriteKey(amulet)).toBe('amulet');
    });

    it('resolves potions and scrolls', () => {
      const hp = { id: 'hp-1', name: 'Health Potion', category: 'consumable' } as Item;
      const mana = { id: 'mana-1', name: 'Mana Draught', category: 'consumable' } as Item;
      const scroll = { id: 'scroll-1', name: 'Scroll of Teleport', category: 'consumable' } as Item;

      expect(getItemSpriteKey(hp)).toBe('health_potion');
      expect(getItemSpriteKey(mana)).toBe('mana_potion');
      expect(getItemSpriteKey(scroll)).toBe('scroll');
    });

    it('resolves Rune of Return to dedicated rune_stone sprite', () => {
      const rune = { id: 'rune_of_return', name: 'Rune of Return', category: 'misc' } as Item;
      const stone = { id: 'item-1', name: 'Ancient Rune Stone', category: 'misc' } as Item;
      expect(getItemSpriteKey(rune)).toBe('rune_stone');
      expect(getItemSpriteKey(stone)).toBe('rune_stone');
    });

    it("uses a pack recipe keyed by the definition ID, for items and monsters alike", () => {
      // What SpriteAtlas.hasSprite reports for cotw: built-in cells plus every cotw recipe.
      const hasSprite = (key: string) => key in ATLAS_MAP || key in COTW_SPRITE_RECIPES;

      const fang = { id: 'loot-1', definitionId: 'nidhogg_fang', name: "Níðhögg's Fang", category: 'weapon' } as Item;
      const lodestone = { id: 'loot-2', definitionId: 'duergar_lodestone', name: 'Duergar Lodestone', category: 'misc' } as Item;
      expect(getItemSpriteKey(fang, hasSprite)).toBe('nidhogg_fang');
      expect(getItemSpriteKey(lodestone, hasSprite)).toBe('duergar_lodestone');

      const nidhogg = new Monster({ id: 'm-nid', name: 'Níðhögg, the Root-Gnawer', position: { x: 0, y: 0 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 }, definitionId: 'nidhogg', tags: ['boss', 'dragon'] });
      expect(getEntitySpriteKey(nidhogg, hasSprite)).toBe('nidhogg');

      // Without a pack recipe the same entities fall back to shared archetype sprites.
      expect(getItemSpriteKey(fang)).toBe('broadsword');
      expect(getEntitySpriteKey(nidhogg)).toBe('giant_boss');
    });
  });

  describe('pack-owned sprite choice (ARCHITECTURE.md §3)', () => {
    const hasSprite = (key: string) => key in ATLAS_MAP || key in COTW_SPRITE_RECIPES;
    const monster = (tags: string[]) =>
      new Monster({ id: 'm', name: 'Barrow Thing', position: { x: 0, y: 0 }, stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 }, tags });

    it("routes a pack's own creature tags through its spriteTagRules, ahead of generic archetypes", () => {
      const rules = cotwManifest.atlas.spriteTagRules;
      expect(getEntitySpriteKey(monster(['undead', 'draugr']), hasSprite, rules)).toBe('draugr');
      expect(getEntitySpriteKey(monster(['undead', 'dwarf', 'duergar']), hasSprite, rules)).toBe('duergar');
      expect(getEntitySpriteKey(monster(['troll_witch', 'caster']), hasSprite, rules)).toBe('troll_witch');

      // Without the pack's rules the renderer knows only generic archetypes.
      expect(getEntitySpriteKey(monster(['undead', 'draugr']), hasSprite)).toBe('skeleton');
      expect(getEntitySpriteKey(monster(['undead', 'dwarf', 'duergar']), hasSprite)).toBe('dwarf');
    });

    it('draws quest relics from recipes keyed by their definition IDs', () => {
      const hearthTear = { id: 'q-1', definitionId: 'hearth_tear_fragment', name: 'Shard of the Hearth-Tear', category: 'quest' } as Item;
      expect(getItemSpriteKey(hearthTear, hasSprite)).toBe('hearth_tear_fragment');

      const banner = { id: 'q-2', definitionId: 'horde_war_banner', name: 'Horde War Banner', category: 'misc' } as Item;
      expect(getItemSpriteKey(banner, (key) => key in WARCRAFT_SPRITE_RECIPES)).toBe('horde_war_banner');
    });

    it('builds in no zone, creature, or relic art that only one pack uses', () => {
      const packOnly = [
        ...COTW_TILE_ZONE_BANDS.flatMap((band) => [`wall_${band.zoneKey}`, `floor_${band.zoneKey}`]),
        'floor_town_snow', 'draugr', 'duergar', 'troll_witch', 'sun_stone',
      ];
      expect(packOnly.filter((key) => key in ATLAS_MAP)).toEqual([]);
      expect(DEFAULT_TAG_SPRITE_ORDER.map((rule) => rule.tag)).not.toEqual(
        expect.arrayContaining(['draugr'])
      );
    });
  });

  describe('getTerrainSpriteKey — Town and Zone Theming', () => {
    // What SpriteAtlas.hasRecipe reports for cotw: zone and town art are the pack's recipes.
    const cotwHas = (key: string) => key in COTW_SPRITE_RECIPES;

    it("falls back to the pack's base floor and wall when it draws no town or zone variant", () => {
      const baseOnly = (key: string) => key === 'floor' || key === 'wall';
      expect(getTerrainSpriteKey('floor', 0, COTW_TILE_ZONE_BANDS, 'shop', baseOnly)).toBe('floor');
      expect(getTerrainSpriteKey('wall', 0, undefined, undefined, baseOnly)).toBe('wall');
      expect(getTerrainSpriteKey('floor', 12, COTW_TILE_ZONE_BANDS, undefined, baseOnly)).toBe('floor');
    });

    it('resolves distinct town building floor and wall tiles when inside buildings on floor 0', () => {
      expect(getTerrainSpriteKey('floor', 0, COTW_TILE_ZONE_BANDS, 'shop', cotwHas)).toBe('floor_town_shop');
      expect(getTerrainSpriteKey('wall', 0, COTW_TILE_ZONE_BANDS, 'shop', cotwHas)).toBe('wall_town_shop');

      expect(getTerrainSpriteKey('floor', 0, COTW_TILE_ZONE_BANDS, 'smithy', cotwHas)).toBe('floor_town_smithy');
      expect(getTerrainSpriteKey('wall', 0, COTW_TILE_ZONE_BANDS, 'smithy', cotwHas)).toBe('wall_town_smithy');

      expect(getTerrainSpriteKey('floor', 0, COTW_TILE_ZONE_BANDS, 'temple', cotwHas)).toBe('floor_town_temple');
      expect(getTerrainSpriteKey('wall', 0, COTW_TILE_ZONE_BANDS, 'temple', cotwHas)).toBe('wall_town_temple');

      expect(getTerrainSpriteKey('floor', 0, COTW_TILE_ZONE_BANDS, 'bank', cotwHas)).toBe('floor_town_bank');
      expect(getTerrainSpriteKey('wall', 0, COTW_TILE_ZONE_BANDS, 'bank', cotwHas)).toBe('wall_town_bank');
    });

    it('resolves town exterior ground to snowy floor and perimeter walls to town timber', () => {
      expect(getTerrainSpriteKey('floor', 0, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_town_outdoor');
      expect(getTerrainSpriteKey('wall', 0, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_town');
    });

    it('resolves all 7 dungeon floor bands to their respective themed wall and floor sprites', () => {
      // Zone 1: Rime Hollows (Floors 1-9)
      expect(getTerrainSpriteKey('wall', 1, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_rime_hollows');
      expect(getTerrainSpriteKey('floor', 5, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_rime_hollows');

      // Zone 2: Dwarven Works (Floors 10-17)
      expect(getTerrainSpriteKey('wall', 10, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_dwarven_works');
      expect(getTerrainSpriteKey('floor', 15, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_dwarven_works');

      // Zone 3: Obsidian Siphon (Floors 18-25)
      expect(getTerrainSpriteKey('wall', 18, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_obsidian_siphon');
      expect(getTerrainSpriteKey('floor', 22, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_obsidian_siphon');

      // Zone 4: Tarnished Silver Veins (Floors 26-33)
      expect(getTerrainSpriteKey('wall', 26, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_tarnished_silver');
      expect(getTerrainSpriteKey('floor', 30, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_tarnished_silver');

      // Zone 5: World Bark Descent (Floors 34-42)
      expect(getTerrainSpriteKey('wall', 34, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_world_bark');
      expect(getTerrainSpriteKey('floor', 40, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_world_bark');

      // Zone 6: Maw of Malice (Floors 43-49)
      expect(getTerrainSpriteKey('wall', 43, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_maw_of_malice');
      expect(getTerrainSpriteKey('floor', 48, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_maw_of_malice');

      // Zone 7: The Rotting Root (Floors 50+)
      expect(getTerrainSpriteKey('wall', 50, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('wall_rotting_root');
      expect(getTerrainSpriteKey('floor', 55, COTW_TILE_ZONE_BANDS, undefined, cotwHas)).toBe('floor_rotting_root');
    });

    it('falls back to default wall and floor when no zone bands or floor number are provided', () => {
      expect(getTerrainSpriteKey('wall')).toBe('wall');
      expect(getTerrainSpriteKey('floor')).toBe('floor');
    });
  });

  describe('COTW_TOWN Building Definitions', () => {
    it('has buildingType configured on each Bjarnarhaven building', () => {
      const olaf = COTW_TOWN.buildings.find((b) => b.name.includes('Olaf'));
      const gunther = COTW_TOWN.buildings.find((b) => b.name.includes('Gunther'));
      const astrid = COTW_TOWN.buildings.find((b) => b.name.includes('Astrid'));
      const thor = COTW_TOWN.buildings.find((b) => b.name.includes('Thor'));
      const vault = COTW_TOWN.buildings.find((b) => b.name.includes('Vault'));

      expect(olaf?.buildingType).toBe('shop');
      expect(gunther?.buildingType).toBe('smithy');
      expect(astrid?.buildingType).toBe('shop');
      expect(thor?.buildingType).toBe('temple');
      expect(vault?.buildingType).toBe('bank');
    });
  });
});
