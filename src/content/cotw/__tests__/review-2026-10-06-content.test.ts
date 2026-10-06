import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../index';
import { createScaledItem } from '../../../engine/dungeon/lootSpawner';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { ExecuteChoiceAction } from '../../../engine/actions/choiceAction';
import { DrinkPotionAction } from '../../../engine/actions/spell-actions';

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

describe('R-cotw-3 · a "monster"-tagged radial consumable afflicts the hero’s own companion', () => {
  it('Zealot’s Sun-Flare does not set the companion burning', () => {
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

    expect(wolf.statusManager.hasStatus('burning')).toBe(false);
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
