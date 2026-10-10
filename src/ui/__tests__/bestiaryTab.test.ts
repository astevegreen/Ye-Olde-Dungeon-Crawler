import { describe, it, expect } from 'vitest';
import { BestiaryTab } from '../characterMenu/bestiaryTab';
import { GameEngine, GameMap, Player, MonsterRegistry, SPECIES_MASTERY_KILLS, scaleMonsterStats } from '../../engine';
import { cotwManifest } from '../../content/cotw';

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

/** A manifest with `monsters` and one family holding them all, mastered at `masteryKills`. */
function familyManifest(monsters: Array<{ id: string; name: string }>, familyName: string, masteryKills: number) {
  return {
    id: 'test',
    name: 'Test',
    items: [],
    spells: [],
    monsters: monsters.map((m) => ({ ...m, stats: { hp: 10, maxHp: 10, attack: 3, defense: 0 }, speed: 100, aiType: 'melee', fleeHealthPercent: 0, xpValue: 5, lootTable: [] })),
    monsterCategories: [{ id: 'family', name: familyName, members: monsters.map((m) => m.id), masteryKills }],
  } as any;
}

describe('Bestiary tab: knowledge ranks and family perks (Q7 "A")', () => {
  it('renders progress toward a complete page for a creature slain twice, and no perks of its own', () => {
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
    expect(overlay.innerHTML).toContain('Kobold Slinker: knowledge');
    expect(overlay.innerHTML).toContain('Slay 13 more to complete its page');
    expect(overlay.innerHTML).not.toContain('Anatomist');
    expect(overlay.innerHTML).not.toContain('data-scope="species"');
  });

  it('marks a creature slain 15 times as Studied, with its page complete', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const engine = new GameEngine({ map, player, floor: 0 });
    MonsterRegistry.register({ id: 'giant_rat', name: 'Giant Rat', stats: { hp: 10, maxHp: 10, attack: 3, defense: 0 }, speed: 100, aiType: 'melee', fleeHealthPercent: 0, xpValue: 5, lootTable: [] });
    for (let i = 0; i < 15; i++) engine.compendium.recordKill('giant_rat', 'Giant Rat');

    const { el: overlay } = openBestiary(engine);
    expect(overlay.innerHTML).toContain('★ Giant Rat: knowledge');
    expect(overlay.innerHTML).toContain('Studied: its page shows everything');
    expect(overlay.innerHTML).toContain('Studied');
    expect(overlay.innerHTML).not.toContain('Mastered');
  });

  it('renders all 5 perks for a mastered family and allows selection and respec in town', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const manifest = familyManifest([{ id: 'giant_rat', name: 'Giant Rat' }], 'Vermin', 15);
    // Floor 0 = Town
    const engine = new GameEngine({ map, player, floor: 0, manifest });
    for (let i = 0; i < 15; i++) engine.compendium.recordKill('giant_rat', 'Giant Rat');
    const family = manifest.monsterCategories[0];

    const { tab, el: overlay } = openBestiary(engine);
    expect(overlay.innerHTML).toContain('★ Vermin (Family)');
    expect(overlay.innerHTML).toContain('In town: you may freely choose or switch perks');
    for (const perk of ['Anatomist', 'Survivor', 'Trophy Hunter', 'Essence Siphon', 'Plunderer']) expect(overlay.innerHTML).toContain(perk);

    const selectRes = engine.compendium.selectCategoryPerk(family, 'anatomist', true);
    expect(selectRes.success).toBe(true);
    tab.render();
    expect(overlay.innerHTML).toContain('<span class="bs-tag is-t3">Active</span>');

    const respecRes = engine.compendium.selectCategoryPerk(family, 'essence_siphon', true);
    expect(respecRes.success).toBe(true);
    expect(engine.compendium.getCategoryPerk('family')).toBe('essence_siphon');
  });

  it('locks respec while in dungeon after a family perk is chosen', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const manifest = familyManifest([{ id: 'giant_rat', name: 'Giant Rat' }], 'Vermin', 15);
    // Floor 1 = Dungeon
    const engine = new GameEngine({ map, player, floor: 1, manifest });
    for (let i = 0; i < 15; i++) engine.compendium.recordKill('giant_rat', 'Giant Rat');
    const family = manifest.monsterCategories[0];

    // In dungeon, initial perk selection is allowed
    expect(engine.compendium.selectCategoryPerk(family, 'survivor', false).success).toBe(true);

    const { el: overlay } = openBestiary(engine);
    expect(overlay.innerHTML).toContain('Return to Town to change it');
    expect(overlay.innerHTML).toContain('Locked in the dungeon');

    const invalidRespec = engine.compendium.selectCategoryPerk(family, 'anatomist', false);
    expect(invalidRespec.success).toBe(false);
    expect(invalidRespec.reason).toContain('Town');
    expect(engine.compendium.getCategoryPerk('family')).toBe('survivor');
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
    expect(html).toContain('12/15 Kills'); // the creature's page is not complete yet
    expect(html).toContain('The Restless Dead (Family)');
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

  it('names behaviors and spells in words, never their ids', () => {
    const caster = { ...monster('w', 'Warlock'), aiType: 'caster', spells: ['shadow_bolt'] };
    const odd = { ...monster('x', 'Channeler'), aiType: 'pack_channeler' };
    const engine = new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } }),
      manifest: {
        id: 'test', name: 'Test', monsters: [caster, odd], items: [],
        spells: [{ id: 'shadow_bolt', name: 'Shadow Bolt' }],
      } as any,
    });
    for (let i = 0; i < 15; i++) engine.compendium.recordKill('w', 'Warlock');
    engine.compendium.recordKill('x', 'Channeler');
    const { tab } = openBestiary(engine);
    const html = () => (tab as any).container.innerHTML as string;
    (tab as any).selectedId = 'w';
    tab.render();
    expect(html()).toContain('casts from afar');
    expect(html()).toContain('Shadow Bolt');
    expect(html()).not.toMatch(/shadow_bolt|caster behavior/);

    (tab as any).selectedId = 'x';
    tab.render();
    expect(html()).not.toMatch(/pack_channeler|behavior/);
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

describe('Bestiary tab: stats as met on the creature\'s home floor (Q11 "A", tracker 4.1)', () => {
  function leechPage(tier: 2 | 3): string {
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 }, difficulty: 'medium' });
    const engine = new GameEngine({ map: new GameMap(10, 10), player, manifest: cotwManifest, floor: 0 });
    engine.compendium.recordEncounter('quicksilver_leech', 'Quicksilver Leech', 26);
    for (let i = 0; i < (tier === 3 ? SPECIES_MASTERY_KILLS : 1); i++) engine.compendium.recordKill('quicksilver_leech', 'Quicksilver Leech');
    const { tab, el } = openBestiary(engine);
    const keys = (code: string) => ({ code, preventDefault: () => {} }) as unknown as KeyboardEvent;
    // Known creatures come first; the leech is the only one.
    tab.handleKeyDown(keys('ArrowUp'));
    return el.innerHTML;
  }

  it('shows the complete page with the floor-26 numbers, not the definition\'s base 58 / 16 / 6', () => {
    const scaled = scaleMonsterStats(cotwManifest.monsters!.find((m) => m.id === 'quicksilver_leech')!, 26, undefined, undefined, cotwManifest.monsterScaling, 'medium');
    const page = leechPage(3);
    expect(page).toContain(`<dd class="ui-num">${scaled.maxHp}</dd>`);
    expect(page).toContain(`${scaled.attack} / ${scaled.defense}`);
    expect(page).not.toContain('<dd class="ui-num">58</dd>');
    expect(page).toContain('on floor <span class="ui-num">26</span>');
  });

  it('gives the Slain rank its health range around the scaled figure', () => {
    const scaled = scaleMonsterStats(cotwManifest.monsters!.find((m) => m.id === 'quicksilver_leech')!, 26, undefined, undefined, cotwManifest.monsterScaling, 'medium');
    expect(leechPage(2)).toContain(`about ${Math.round(scaled.maxHp * 0.8)}–${Math.round(scaled.maxHp * 1.2)}`);
  });
});

describe('Bestiary tab: a picture for each creature seen (N33, tracker 4.2)', () => {
  function open(known: boolean, large = false) {
    const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } }), manifest: cotwManifest, floor: 0 });
    if (known) engine.compendium.recordEncounter('quicksilver_leech', 'Quicksilver Leech', 26);
    const drawn: string[] = [];
    const canvas = {};
    const el = {
      innerHTML: '',
      querySelector: (sel: string) => (sel === 'canvas.bs-portrait' && el.innerHTML.includes('bs-portrait') ? canvas : null),
      querySelectorAll: () => [],
    };
    const tab = new BestiaryTab({ drawMonsterPicture: (c, def) => drawn.push(c === canvas ? def.id : 'elsewhere'), largePicture: () => large });
    tab.mount(el as unknown as HTMLElement);
    tab.onActivate({ engine, worldState: engine.worldState, player: engine.player, map: engine.map, currentFloor: 0, turnCount: 0, manifest: engine.manifest });
    return { drawn, html: el.innerHTML };
  }

  it('paints the selected creature from its definition into the page\'s portrait', () => {
    const { drawn, html } = open(true);
    expect(html).toContain('class="bs-portrait"');
    expect(drawn).toEqual(['quicksilver_leech']);
  });

  it('keeps the 64-pixel picture for a pack without portraits, and gives a portrait pack 192', () => {
    expect(open(true).html).toContain('<canvas class="bs-portrait" width="64" height="64"');
    const { drawn, html } = open(true, true);
    expect(html).toContain('<canvas class="bs-portrait is-large" width="192" height="192"');
    expect(drawn).toEqual(['quicksilver_leech']);
  });

  it('draws nothing for a creature never seen: its page keeps the "?"', () => {
    const { drawn, html } = open(false);
    expect(html).not.toContain('bs-portrait');
    expect(drawn).toEqual([]);
  });
});

describe('Bestiary tab: a page completed by Study (tracker 4.1)', () => {
  it('reads as complete, not "slay 15 more", when the rank was bought', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } }), manifest: cotwManifest, floor: 0 });
    engine.compendium.recordEncounter('quicksilver_leech', 'Quicksilver Leech', 26);
    engine.compendium.raiseKnowledge('quicksilver_leech');
    engine.compendium.raiseKnowledge('quicksilver_leech');
    const { el } = openBestiary(engine);
    expect(el.innerHTML).toContain('Studied: its page shows everything.');
    expect(el.innerHTML).not.toContain('Slay 15 more');
  });
});
