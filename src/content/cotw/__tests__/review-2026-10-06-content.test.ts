import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../index';
import { createScaledItem } from '../../../engine/dungeon/lootSpawner';
import { scaleMonsterStats } from '../../../engine/dungeon/spawner';
import type { MonsterDefinition } from '../../../engine';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { ExecuteChoiceAction } from '../../../engine/actions/choiceAction';
import { DrinkPotionAction, CastSpellAction } from '../../../engine/actions/spell-actions';

/**
 * Whole-codebase review, 2026-10-06, area 6 (the cotw pack). Each test reproduces one finding
 * from `.prompts/codebase-review-2026-10-06/areas/06-cotw-content.md` and is marked `it.fails`
 * so the suite stays green until the bug is fixed.
 */

type ItemDef = { id: string; category?: string; wandConfig?: { spellId: string }; containerConfig?: { containerType: string } };
const items = cotwManifest.items as ItemDef[];
const spellIds = new Set((cotwManifest.spells as Array<{ id: string }>).map((s) => s.id));
const def = (id: string) => items.find((i) => i.id === id)!;

describe('R-cotw-1 · the Wand of the Ironwood Bough casts an undefined spell', () => {
  it('every wand in the pack names a spell the pack defines', () => {
    const dangling = items.filter((i) => i.wandConfig && !spellIds.has(i.wandConfig.spellId)).map((i) => `${i.id} -> ${i.wandConfig!.spellId}`);
    expect(dangling).toEqual([]);
  });
});

describe('R-cotw-4 · the legacy "Wand & Potion Utility Belt" accepts no wand, potion or scroll', () => {
  it('the legacy utility belt can hold a potion', () => {
    const belt = createScaledItem(def('utility_belt') as never, 'belt', 1, () => 0.5) as unknown as { canContain(i: unknown): { allowed: boolean } };
    const potion = createScaledItem(def('hearth_broth_flask') as never, 'pot', 1, () => 0.5);
    expect(belt.canContain(potion).allowed).toBe(true);
  });
});

describe('R-cotw-2 · the Oath grants no companion when the hero already has one, but says it did', () => {
  it('honouring the Oath with a hound already bonded attaches the Frost-Ward Hound', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Oath', { seed: 3, difficulty: 'medium' } as never);
    engine.setWorldFlag('companion_bonded', true);
    engine.summonCompanion('battle_hound');
    expect(engine.companion?.companionDefinitionId).toBe('battle_hound'); // (passes today)

    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, (cotwManifest.choices as Record<string, unknown>).oath_hearth as never, 'honor'));

    expect(engine.getWorldFlag('blood_oath_honored')).toBe(true); // the oath resolved (passes today)
    expect(engine.companion?.companionDefinitionId).toBe('hearth_frost_hound');
    expect(engine.dismissedCompanion?.companionDefinitionId).toBe('battle_hound'); // waits to be called
  });

  it('breaking the Oath while the old companion lies fallen still brings the wolf, and keeps the fallen one for the trainer', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Oath2', { seed: 4, difficulty: 'medium' } as never);
    engine.setWorldFlag('companion_bonded', true);
    const hound = engine.summonCompanion('battle_hound')!;
    hound.takeDamage(9999);
    engine.companion = null;
    engine.deadCompanionRecord = hound;

    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, (cotwManifest.choices as Record<string, unknown>).oath_hearth as never, 'break'));

    const current = () => engine.companion; // read after the choice, not narrowed to null
    expect(current()?.companionDefinitionId).toBe('ember_fang_wolf');
    expect(engine.deadCompanionRecord).toBe(hound);
  });
});

// The owner chose classic friendly fire (2026-10-07): a flask hits allies too, like a spell
// burst, so I3's "spare the user's side" is reverted. The drinker alone is spared.
describe('R-cotw-3 · a "monster"-tagged radial consumable afflicts the hero’s own companion', () => {
  it('Zealot’s Sun-Flare sets the companion burning too, and spares the hero who drank it', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Pet', { seed: 2, difficulty: 'medium' } as never);
    const p = engine.player;
    engine.setWorldFlag('companion_bonded', true);
    const wolf = engine.summonCompanion('ember_fang_wolf') ?? engine.companion!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (engine.map.isPassable(p.x + dx, p.y + dy) && !engine.map.getEntityAt(p.x + dx, p.y + dy)) {
        engine.map.moveEntity(wolf, p.x + dx, p.y + dy);
        break;
      }
    }
    const flare = createScaledItem(def('zealots_sun_flare') as never, 'flare', 20, () => 0.5);
    p.inventory.primaryPack.addItem(flare);

    new DrinkPotionAction(p, flare as never).perform(engine);

    expect(wolf.statusManager.hasStatus('burning')).toBe(true);
    expect(p.statusManager.hasStatus('burning')).toBe(false);
  });
});

describe('R-cotw-18 · companions grow with the hero’s level (owner, 2026-10-07)', () => {
  it('every cotw companion declares its growth, and at level 25 the Oath’s wolf outlasts a floor-25 blow', () => {
    const companions = cotwManifest.companions!;
    expect(companions.every((c) => c.growthPerLevel)).toBe(true);
    const at = (id: string, level: number) => {
      const c = companions.find((d) => d.id === id)!;
      const g = c.growthPerLevel!;
      return {
        maxHp: Math.round(c.stats.maxHp + (g.hp ?? 0) * (level - 1)),
        attack: Math.round(c.stats.attack + (g.attack ?? 0) * (level - 1)),
        defense: Math.round(c.stats.defense + (g.defense ?? 0) * (level - 1)),
      };
    };
    expect(at('battle_hound', 25)).toEqual({ maxHp: 150, attack: 20, defense: 9 });
    expect(at('hearth_frost_hound', 25)).toEqual({ maxHp: 146, attack: 14, defense: 17 });
    expect(at('ember_fang_wolf', 25)).toEqual({ maxHp: 118, attack: 28, defense: 8 });
    // The review's floor-25 attackers hit for up to 53: the wolf survives two such blows, not none.
    expect(Math.floor(at('ember_fang_wolf', 25).maxHp / (53 - at('ember_fang_wolf', 25).defense))).toBeGreaterThanOrEqual(2);

    // In play: a level-25 hero calls the wolf, and it comes grown.
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Pack', { seed: 4, difficulty: 'medium' } as never);
    engine.setWorldFlag('companion_bonded', true);
    while (engine.player.level < 25) engine.diagnostics.grantLevel();
    expect(engine.commandBus.dispatch({ type: 'summon_companion', payload: { companionId: 'ember_fang_wolf' } }).success).toBe(true);
    const wolf = engine.companion!;
    expect({ maxHp: wolf.maxHp, attack: wolf.attack, defense: wolf.defense }).toEqual(at('ember_fang_wolf', 25));
    expect(wolf.hp).toBe(wolf.maxHp);
  });
});

describe('R-cotw-15 · the Charm of the Watchful Eye and the Scroll of Identify are not random loot', () => {
  it('no floor draw from 1 to 50 gives either, over many rolls', async () => {
    const { selectFloorItemDefinition } = await import('../../../engine/dungeon/lootSpawner');
    const drawn = new Set<string>();
    for (let floor = 1; floor <= 50; floor += 7) {
      for (let i = 0; i < 400; i++) {
        let n = i * 7919 + floor;
        const rng = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
        const pick = selectFloorItemDefinition(cotwManifest.items as never, floor, rng, cotwManifest.loot);
        if (pick) drawn.add(pick.id);
      }
    }
    expect(drawn.has('charm_watchful_eye')).toBe(false);
    expect(drawn.has('scroll_identify')).toBe(false);
    expect(drawn.size).toBeGreaterThan(20); // the rest still drop
  });

  it('each is defined once', () => {
    expect(items.filter((i) => i.id === 'charm_watchful_eye')).toHaveLength(1);
    expect(items.filter((i) => i.id === 'scroll_identify')).toHaveLength(1);
  });
});

describe('R-cotw-14 · the Wrists slot can be filled', () => {
  it('the Root-Wound Bracers are bracers for the wrists, and fit the slot', () => {
    const bracers = items.find((i) => i.id === 'root_wound_bracers') as ItemDef & { slot?: string };
    expect(bracers.category).toBe('bracers');
    expect(bracers.slot).toBe('wrists');
  });
});

describe('R-cotw-8 · floor 21 stamps only its scripted pylon, not the zone’s ordinary one', () => {
  it('the ordinary Siphon Pylon is never a random vault pick', async () => {
    const { chooseVaults } = await import('../../../engine/dungeon/layout/layoutStrategy');
    let n = 1;
    const rand = () => ((n = (n * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) {
      const picks = chooseVaults({ gen: { vaults: cotwManifest.vaults, floorNumber: 21, forcedVaultId: 'floor21_drinking_pylon' }, rand, params: { bridges: 3 } } as never);
      expect(picks.map((p) => p.blueprint.id)).not.toContain('siphon_pylon');
    }
  });
});

describe('R-cotw-12 · every surface a monster spawns is a surface the engine knows', () => {
  it('no wind-up or hook spawns a tile type (shallow_water) as a surface', async () => {
    const { BUILTIN_SURFACE_TYPES } = await import('../../../engine/surfaces/surfaceGrid');
    const known = new Set<string>(BUILTIN_SURFACE_TYPES);
    const unknown: string[] = [];
    for (const m of cotwManifest.monsters as Array<{ id: string; telegraphedAbility?: { spawnSurface?: string } }>) {
      const s = m.telegraphedAbility?.spawnSurface;
      if (s && !known.has(s)) unknown.push(`${m.id}: ${s}`);
    }
    expect(unknown).toEqual([]);
  });
});

describe('R-cotw-13 · shadow is an element of the pack (DECISIONS Q9: "Add it")', () => {
  const matrixIds = new Set((cotwManifest.affinityMatrix?.elements ?? []).map((e) => e.id));

  it('every element a spell, a monster resistance or a kill-rite essence names is in the affinity matrix', () => {
    const named = new Set<string>();
    for (const s of cotwManifest.spells as Array<{ element?: string; effects?: Array<{ element?: string }> }>) {
      if (s.element) named.add(s.element);
      for (const e of s.effects ?? []) if (e.element) named.add(e.element);
    }
    for (const m of cotwManifest.monsters as Array<{ resistances?: Record<string, string>; killRite?: { essenceElement?: string; requiredDamageElement?: string } }>) {
      for (const el of Object.keys(m.resistances ?? {})) named.add(el);
      if (m.killRite?.essenceElement) named.add(m.killRite.essenceElement);
      if (m.killRite?.requiredDamageElement) named.add(m.killRite.requiredDamageElement);
    }
    expect([...named].filter((el) => !matrixIds.has(el)).sort()).toEqual([]);
    expect(matrixIds.has('shadow')).toBe(true);
  });

  it('the Hel Warden and the Shadow Fiend resist shadow', () => {
    const monsters = cotwManifest.monsters as Array<{ id: string; resistances?: Record<string, string> }>;
    for (const id of ['hel_warden', 'shadow_fiend']) {
      expect(monsters.find((m) => m.id === id)?.resistances?.shadow).toBe('resistant');
    }
  });

  it('Wildfire never turns a spell to shadow, and still picks among the other five', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Wild', { seed: 5, difficulty: 'medium' } as never);
    const p = engine.player;
    (p as unknown as { perkModifiers: unknown[] }).perkModifiers.push({
      id: 'test:wildfire', name: 'Wildfire', alignment: 'positive', category: 'blessed', randomSpellElement: true,
    });
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const before = engine.messages.length;
      new CastSpellAction(p, 'firebolt', p.x + 1, p.y, undefined, true).perform(engine);
      for (const m of engine.messages.slice(before)) {
        const hit = /^Wildfire turns .+ to (\w+)!$/.exec(m);
        if (hit) seen.add(hit[1]);
      }
    }
    expect(seen.has('shadow')).toBe(false);
    expect([...seen].sort()).toEqual(['arcane', 'cold', 'fire', 'lightning', 'poison']);
  });
});

describe('R-cotw-10 · an overkill kill rite can be met by a caster of its element', () => {
  /**
   * The overkill a rite asks for (a share of the victim's scaled max HP, Medium, at the floor
   * it first appears) must not exceed what the pack's strongest spell of the rite's element
   * deals the victim at base power, through the victim's affinity (Gloom-Tarr resists fire,
   * so Fireball's 18 reaches it as 9): a caster at twice base power can then meet it on a foe
   * at that many HP. Sköll asked for 396 from an arcane spell whose base is 8.
   */
  it('no element-gated overkill rite asks for more than the strongest spell of its element deals', () => {
    const strongest: Record<string, number> = {};
    for (const s of cotwManifest.spells as Array<{ effects?: Array<{ type: string; amount?: number; element?: string }> }>) {
      for (const e of s.effects ?? []) {
        if (e.type === 'damage' && typeof e.amount === 'number' && e.element) strongest[e.element] = Math.max(strongest[e.element] ?? 0, e.amount);
      }
    }
    const tooHigh: string[] = [];
    let checked = 0;
    const multipliers = cotwManifest.affinityMatrix?.defaultMultipliers ?? {};
    for (const m of cotwManifest.monsters as Array<MonsterDefinition & { killRite?: { requiredDamageElement?: string; requiresOverkillPercent?: number } }>) {
      const rite = m.killRite;
      if (!rite?.requiresOverkillPercent || !rite.requiredDamageElement) continue;
      checked += 1;
      const { maxHp } = scaleMonsterStats(m, m.minFloor ?? 1, undefined, undefined, cotwManifest.monsterScaling, 'medium');
      const needed = Math.ceil(maxHp * (rite.requiresOverkillPercent / 100));
      const affinity = (m.resistances as Record<string, string> | undefined)?.[rite.requiredDamageElement] ?? 'neutral';
      const best = Math.round((strongest[rite.requiredDamageElement] ?? 0) * (multipliers[affinity] ?? 1));
      if (needed > best) tooHigh.push(`${m.id}: ${needed} ${rite.requiredDamageElement} overkill, strongest spell deals it ${best} (${affinity})`);
    }
    expect(checked).toBeGreaterThanOrEqual(6);
    expect(tooHigh).toEqual([]);
  });
});
