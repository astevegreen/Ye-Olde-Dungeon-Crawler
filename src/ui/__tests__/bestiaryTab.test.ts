import { describe, it, expect } from 'vitest';
import { BestiaryTab } from '../characterMenu/bestiaryTab';
import { GameEngine, GameMap, Player, MonsterRegistry } from '../../engine';

/** Opens the Bestiary tab on a stub container and returns it. */
function openBestiary(engine: GameEngine): { tab: BestiaryTab; el: { innerHTML: string } } {
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const tab = new BestiaryTab();
  tab.mount(el as unknown as HTMLElement);
  tab.onActivate({
    engine,
    worldState: engine.worldState,
    player: engine.player,
    map: engine.map,
    currentFloor: engine.currentFloor,
    turnCount: engine.turnCount,
    manifest: engine.manifest,
  });
  return { tab, el };
}

describe('Bestiary tab: mastery and perks', () => {
  it('renders progress toward mastery for unmastered monster', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const engine = new GameEngine({ map, player });

    MonsterRegistry.register({
      id: 'kobold',
      name: 'Kobold Slinker',
      stats: { hp: 10, maxHp: 10, attack: 4, defense: 1 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 10,
      lootTable: [],
    });

    engine.compendium.recordKill('kobold', 'Kobold Slinker');
    engine.compendium.recordKill('kobold', 'Kobold Slinker');

    const { el: overlay } = openBestiary(engine);
    expect(overlay.innerHTML).toContain('2/15 Kills');
    expect(overlay.innerHTML).toContain('Kobold Slinker Mastery');
    expect(overlay.innerHTML).toContain('Slay 13 more');
    expect(overlay.innerHTML).toContain('Anatomist');
    expect(overlay.innerHTML).toContain('Survivor');
    expect(overlay.innerHTML).toContain('Trophy Hunter');
    expect(overlay.innerHTML).toContain('Essence Siphon');
    expect(overlay.innerHTML).toContain('Plunderer');
  });

  it('renders all 5 specializations and allows selection in town', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    // Floor 0 = Town
    const engine = new GameEngine({ map, player, floor: 0 });

    MonsterRegistry.register({
      id: 'giant_rat',
      name: 'Giant Rat',
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 0 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: [],
    });

    for (let i = 0; i < 15; i++) {
      engine.compendium.recordKill('giant_rat', 'Giant Rat');
    }

    const { tab, el: overlay } = openBestiary(engine);
    expect(overlay.innerHTML).toContain('★ Giant Rat Mastery');
    expect(overlay.innerHTML).toContain('In town: you may freely choose or switch perks');
    expect(overlay.innerHTML).toContain('Anatomist');
    expect(overlay.innerHTML).toContain('Survivor');
    expect(overlay.innerHTML).toContain('Trophy Hunter');
    expect(overlay.innerHTML).toContain('Essence Siphon');
    expect(overlay.innerHTML).toContain('Plunderer');

    // Select Anatomist
    const selectRes = engine.compendium.selectPerk('giant_rat', 'anatomist', true);
    expect(selectRes.success).toBe(true);
    expect(engine.compendium.getPerk('giant_rat')).toBe('anatomist');

    tab.render();
    expect(overlay.innerHTML).toContain('<span class="bs-tag is-t3">Active</span>');

    // Respec in town to Essence Siphon
    const respecRes = engine.compendium.selectPerk('giant_rat', 'essence_siphon', true);
    expect(respecRes.success).toBe(true);
    expect(engine.compendium.getPerk('giant_rat')).toBe('essence_siphon');

    tab.render();
    expect(engine.compendium.getPerk('giant_rat')).toBe('essence_siphon');
  });

  it('locks respec while in dungeon after perk is chosen', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    // Floor 1 = Dungeon
    const engine = new GameEngine({ map, player, floor: 1 });

    MonsterRegistry.register({
      id: 'giant_rat',
      name: 'Giant Rat',
      stats: { hp: 15, maxHp: 15, attack: 5, defense: 2 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 15,
      lootTable: [],
    });

    for (let i = 0; i < 15; i++) {
      engine.compendium.recordKill('giant_rat', 'Giant Rat');
    }

    // In dungeon, initial perk selection is allowed
    const initialPick = engine.compendium.selectPerk('giant_rat', 'survivor', false);
    expect(initialPick.success).toBe(true);
    expect(engine.compendium.getPerk('giant_rat')).toBe('survivor');

    const { el: overlay } = openBestiary(engine);
    // Once survivor is chosen, switching in dungeon is locked
    expect(overlay.innerHTML).toContain('Return to Town to change it');
    expect(overlay.innerHTML).toContain('Locked in the dungeon');

    // Trying to respec in dungeon fails
    const invalidRespec = engine.compendium.selectPerk('giant_rat', 'anatomist', false);
    expect(invalidRespec.success).toBe(false);
    expect(invalidRespec.reason).toContain('Town');
    expect(engine.compendium.getPerk('giant_rat')).toBe('survivor');
  });

  it('shows the category mastery panel for a monster in a category', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const monster = (id: string, name: string) => ({
      id, name, stats: { hp: 5, maxHp: 5, attack: 2, defense: 0 }, speed: 100, aiType: 'melee', fleeHealthPercent: 0, xpValue: 1, lootTable: [],
    });
    const manifest = {
      id: 'test',
      name: 'Test',
      monsters: [monster('skeleton', 'Skeleton'), monster('draugr', 'Draugr')],
      items: [],
      spells: [],
      monsterCategories: [
        { id: 'undead', name: 'The Restless Dead', members: ['skeleton', 'draugr'], masteryKills: 40 },
      ],
    } as any;
    const engine = new GameEngine({ map, player, floor: 1, manifest });
    for (let i = 0; i < 12; i++) engine.compendium.recordKill('skeleton', 'Skeleton');
    for (let i = 0; i < 30; i++) engine.compendium.recordKill('draugr', 'Draugr');

    const { tab } = openBestiary(engine);
    (tab as any).selectedId = 'skeleton';
    tab.render();

    const html = (tab as any).container.innerHTML as string;
    expect(html).toContain('12/15 Kills'); // species not yet mastered
    expect(html).toContain('The Restless Dead (Category)');
    expect(html).toContain('42/40 Kills');
    expect(html).toContain('data-scope="category"');
    expect(html).not.toContain('data-scope="species"');
  });
});

describe('Bestiary tab: list', () => {
  const monster = (id: string, name: string) => ({
    id, name, stats: { hp: 5, maxHp: 5, attack: 2, defense: 0 }, speed: 100, aiType: 'melee', fleeHealthPercent: 0, xpValue: 1, lootTable: [],
  });
  const makeEngine = () =>
    new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } }),
      manifest: { id: 'test', name: 'Test', monsters: [monster('a', 'Alpha'), monster('b', 'Beta'), monster('c', 'Gamma')], items: [], spells: [] } as any,
    });

  it('lists known creatures first and unknown ones last, with a legend for the rank tags', () => {
    const engine = makeEngine();
    engine.compendium.recordKill('c', 'Gamma');
    const { el } = openBestiary(engine);
    const order = [...el.innerHTML.matchAll(/class="bs-name">([^<]+)</g)].map((m) => m[1]);
    expect(order).toEqual(['Gamma', 'Unknown creature', 'Unknown creature']);
    expect(el.innerHTML).toContain('<span class="bs-tag is-t2">Slain 1</span>');
    expect(el.innerHTML).toContain('bs-legend');
    expect(el.innerHTML).not.toContain('[SILVER');
  });

  it('pages filters with Left/Right and leaves Escape, Tab and B to the menu', () => {
    const engine = makeEngine();
    const { tab, el } = openBestiary(engine);
    const key = (code: string) => ({ code, preventDefault: () => {} }) as unknown as KeyboardEvent;
    expect(tab.handleKeyDown(key('ArrowRight'))).toBe(true);
    expect(el.innerHTML).toContain('data-filter="discovered" aria-selected="true"');
    for (const code of ['Escape', 'Tab', 'KeyB', 'KeyI']) expect(tab.handleKeyDown(key(code))).toBe(false);
  });
});
