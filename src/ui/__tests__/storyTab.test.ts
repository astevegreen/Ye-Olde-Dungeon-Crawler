import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, Player, type GameContentManifest } from '../../engine';
import { StoryTab } from '../characterMenu/storyTab';
import { MAX_RIDDLES, buildDescent, buildSaga, buildStanding, buildVerses, deepestFloor } from '../characterMenu/storyModel';

function makeEngine(manifest: Partial<GameContentManifest>, floor = 3): GameEngine {
  return new GameEngine({
    map: new GameMap(10, 10),
    player: new Player({ position: { x: 1, y: 1 } }),
    floor,
    manifest: { id: 'test', name: 'Test', monsters: [], items: [], spells: [], ...manifest } as GameContentManifest,
  });
}

const milestone = (n: number, riddle?: string) => ({ flag: `deed_${n}`, label: `Deed ${n}`, description: `Did deed ${n}.`, riddle });

describe('Story model', () => {
  it('shows locked milestones as riddles, at most six, then counts the rest as untold', () => {
    const engine = makeEngine({
      trackedMilestones: [milestone(1, 'First riddle'), milestone(2), ...[3, 4, 5, 6, 7, 8, 9].map((n) => milestone(n, `Riddle ${n}`))],
    });
    engine.worldState.flags.deed_1 = true;
    const saga = buildSaga(engine);
    expect(saga.achieved.map((m) => m.label)).toEqual(['Deed 1']);
    expect(saga.riddles).toHaveLength(MAX_RIDDLES);
    expect(saga.riddles[0]).toBeNull(); // no riddle: shown as "? ? ?"
    expect(saga.riddles[1]).toBe('Riddle 3');
    expect(saga.untold).toBe(8 - MAX_RIDDLES);
  });

  it('hides factions until met: standing moved, a met flag, or met at the start', () => {
    const engine = makeEngine({
      initialWorldState: { flags: {}, counters: {}, factions: { town: 10, temple: 0, clans: -15, guild: 0 } },
      factions: [{ id: 'town', name: 'Townsfolk', metAtStart: true }, { id: 'guild', metFlag: 'met_guild' }],
    });
    let standing = buildStanding(engine.worldState, engine.manifest);
    expect(standing.met.map((f) => f.name)).toEqual(['Townsfolk']);
    expect(standing.unmet).toBe(3);

    engine.worldState.factions.temple = 10; // standing moved
    engine.worldState.flags.met_guild = true;
    standing = buildStanding(engine.worldState, engine.manifest);
    expect(standing.met.map((f) => `${f.name} ${f.label} ${f.value}`)).toEqual([
      'Townsfolk Friendly 10',
      'Temple Friendly 10',
      'Guild Neutral 0',
    ]);
    expect(standing.unmet).toBe(1); // the clans, seeded and untouched
  });

  it('keeps lore entries once their flag is set', () => {
    const engine = makeEngine({
      loreEntries: [
        { flag: 'stone_1', title: 'One', verse: 'v1', lore: 'l1' },
        { flag: 'stone_2', title: 'Two', verse: 'v2', lore: 'l2' },
      ],
    });
    engine.worldState.flags.stone_2 = true;
    const verses = buildVerses(engine.worldState, engine.manifest);
    expect(verses.read.map((v) => v.title)).toEqual(['Two']);
    expect(verses.total).toBe(2);
  });

  it('labels the descent from atlas zone bands, naming only zones reached', () => {
    const engine = makeEngine(
      {
        quest: { maxFloor: 50 } as never,
        atlas: {
          themeId: 't',
          tileZoneBands: [
            { floor: 1, zoneKey: 'a', label: 'Upper' },
            { floor: 10, zoneKey: 'b', label: 'Middle' },
            { floor: 60, zoneKey: 'z', label: 'Past the end' },
          ],
        },
        deepestFloorCounter: 'test:deepest',
      },
      3
    );
    engine.worldState.counters['test:deepest'] = 12;
    expect(deepestFloor(engine)).toBe(12);
    const d = buildDescent(engine);
    expect(d.lastFloor).toBe(50);
    expect(d.currentZone).toBe('Upper');
    expect(d.bands).toEqual([
      { floor: 1, label: 'Upper' },
      { floor: 10, label: 'Middle' },
    ]);
  });
});

describe('StoryTab', () => {
  const container = () =>
    ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }) as unknown as HTMLElement;
  const activate = (tab: StoryTab, engine: GameEngine, el = container()) => {
    tab.mount(el);
    tab.onActivate({
      engine,
      worldState: engine.worldState,
      player: engine.player,
      map: engine.map,
      currentFloor: engine.currentFloor,
      turnCount: engine.turnCount,
      manifest: engine.manifest,
    });
    return el;
  };

  it('renders the descent, saga, chronicle and lore, and pages the side panel with Left/Right', () => {
    const engine = makeEngine({
      branding: { loreTitle: 'Carved Verses' },
      trackedMilestones: [milestone(1, 'A riddle in the dark')],
      loreEntries: [{ flag: 'stone_1', title: 'Lay of Test', verse: 'Line one\nLine two', lore: 'Fire beats ice.' }],
      objectives: [{ id: 'o', text: 'Go down.' }],
    });
    engine.worldState.flags.stone_1 = true;
    engine.emitDiscovery({ type: 'general', text: 'Found a <secret>' });
    const tab = new StoryTab();
    const el = activate(tab, engine);

    expect(el.innerHTML).toContain('The Descent');
    expect(el.innerHTML).toContain('Go down.');
    expect(el.innerHTML).toContain('A riddle in the dark');
    expect(el.innerHTML).toContain('Found a &lt;secret&gt;');
    expect(el.innerHTML).toContain('Carved Verses <span class="ui-num">1/1</span>');
    expect(el.innerHTML).toContain('Fire beats ice.');
    expect(tab.footer().keys?.[0].label).toBe('Carved Verses · Standing · Pacts');

    const arrow = { code: 'ArrowRight', preventDefault: () => {} } as unknown as KeyboardEvent;
    expect(tab.handleKeyDown(arrow)).toBe(true);
    expect(el.innerHTML).toContain('aria-selected="true" class="st-subtab">Standing');
    expect(tab.handleKeyDown({ code: 'KeyI' } as KeyboardEvent)).toBe(false);
  });

  it('a milestone achieved since the last look glows once', () => {
    const engine = makeEngine({ trackedMilestones: [milestone(1, 'r1'), milestone(2, 'r2')] });
    const tab = new StoryTab();
    let el = activate(tab, engine);
    expect(el.innerHTML).not.toContain('ui-glow');

    engine.worldState.flags.deed_2 = true;
    el = activate(tab, engine);
    expect(el.innerHTML).toContain('st-deed is-done ui-glow');

    el = activate(tab, engine);
    expect(el.innerHTML).not.toContain('ui-glow');
  });
});
