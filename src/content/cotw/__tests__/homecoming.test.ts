import { describe, it, expect } from 'vitest';
import { cotwManifest, COTW_CHOICES } from '../index';
import { populateHomecoming, RETURNED_CAPTIVE_POSITIONS } from '../homecoming';
import { COTW_DEEPEST_FLOOR_COUNTER } from '../spellTablets';
import { RELIC_RECOVERED_FLAG } from '../relic';
import { TOWN_BUILDINGS } from '../townLayout';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { WaitAction } from '../../../engine/actions/wait';
import { GameMap, NPC, Player, createWorldState, incrementCounter, setFlag, type EngineContext } from '../../../engine';

function fakeTown() {
  const worldState = createWorldState();
  const player = new Player({ name: 'Sven', position: { x: 0, y: 0 } });
  const map = new GameMap(50, 50);
  const logs: string[] = [];
  const ctx: EngineContext = {
    player,
    map,
    surfaces: null as any,
    worldState,
    rng: () => 0.5,
    log: (m) => logs.push(m),
    getWorldFlag: (f) => Boolean(worldState.flags[f]),
    setWorldFlag: (f, v) => setFlag(worldState, f, v),
    currentFloor: 0,
    removeEntity: (e) => map.removeEntity(e),
    addEntity: (e) => map.addEntity(e),
    compendium: null as never,
  };
  const npc = (id: string) => map.getEntityById(id) as NPC | null;
  return { ctx, map, logs, worldState, npc };
}

describe('the saved come home to Bjarnarhaven', () => {
  it('a savior finds the four captives freed on floor 22 home, as who they were, and the first keeps a kettle on', () => {
    const { ctx, map, logs, worldState, npc } = fakeTown();
    populateHomecoming(ctx);
    expect(npc('npc-returned-1')).toBeNull();

    for (let i = 1; i <= 4; i++) setFlag(worldState, `captive_villager_${i}_rescued`, true);
    setFlag(worldState, 'siphon_ritual_resolved', true);
    setFlag(worldState, 'savior_of_jarnvidr', true);
    populateHomecoming(ctx);
    populateHomecoming(ctx);

    // With no one taken in the raid, the captives were Ingrid, Torstein, Sigrid and Leif.
    const names = [1, 2, 3, 4].map((i) => npc(`npc-returned-${i}`)?.name);
    expect(names).toEqual(['Ingrid of the Mill', 'Torstein the Cooper', 'Sigrid the Weaver', 'Young Leif']);
    expect([1, 2, 3, 4].map((i) => npc(`npc-returned-${i}`)?.spriteKey)).toEqual([
      'captive_villager_1',
      'captive_villager_2',
      'captive_villager_3',
      'captive_villager_4',
    ]);
    RETURNED_CAPTIVE_POSITIONS.forEach((pos, i) => expect(npc(`npc-returned-${i + 1}`)).toMatchObject(pos));
    expect(logs.filter((l) => l.includes('home from the Siphon Altar'))).toHaveLength(1);

    // The flask is on offer once a delve; taken, she talks like the rest.
    expect(npc('npc-returned-1')?.choiceId).toBe('choice_returned_broth');
    setFlag(worldState, 'returned_broth_claimed', true);
    populateHomecoming(ctx);
    expect(npc('npc-returned-1')?.choiceId).toBeUndefined();
    expect(npc('npc-returned-1')?.dialogText).toContain('warmth');

    // Their talk follows the descent, and no one is seated twice.
    const before = npc('npc-returned-2')?.dialogText;
    setFlag(worldState, 'vidnir_slain', true);
    populateHomecoming(ctx);
    expect(npc('npc-returned-2')?.dialogText).not.toBe(before);
    expect(map.getAllEntities().filter((e) => e.id.startsWith('npc-returned-'))).toHaveLength(4);
    expect(logs.filter((l) => l.includes('home from the Siphon Altar'))).toHaveLength(1);

    const broth = COTW_CHOICES['choice_returned_broth'];
    expect(broth.options[0].consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'hearth_broth_flask')).toBe(true);
  });

  it('each captive cut loose comes home, even when others were lost, and a raid villager freed there goes back to their own place', () => {
    const { ctx, logs, worldState, npc } = fakeTown();
    setFlag(worldState, 'prologue-eir_taken', true);
    setFlag(worldState, 'captive_villager_1_rescued', true);
    setFlag(worldState, 'captive_villager_4_rescued', true);
    populateHomecoming(ctx);
    expect(logs).toContain('Word spreads through Bjarnarhaven: Eir and Leif are home from the Siphon Altar, safe and whole.');

    // Eir stood in for the first captive: she wears her own drawing, at the temple.
    expect(npc('npc-returned-1')).toMatchObject({ name: 'Eir the Acolyte', spriteKey: 'prologue-eir', x: 30, y: 29 });
    expect(npc('npc-returned-4')?.name).toBe('Young Leif');
    expect(npc('npc-returned-2')).toBeNull();
    expect(npc('npc-eir')).toBeNull();
    const homecoming = npc('npc-returned-4')?.dialogText;

    for (const i of [2, 3]) {
      setFlag(worldState, `captive_villager_${i}_sacrificed`, true);
      incrementCounter(worldState, 'hostages_sacrificed', 1);
    }
    setFlag(worldState, 'siphon_ritual_resolved', true);
    populateHomecoming(ctx);
    expect(npc('npc-returned-1')?.choiceId).toBeUndefined();
    expect(npc('npc-returned-4')?.dialogText).not.toBe(homecoming);
    expect(npc('npc-returned-2')).toBeNull();
  });

  it('the raid’s villagers are home from the dawn after it, and what they say follows the descent', () => {
    const { ctx, logs, worldState, npc } = fakeTown();
    setFlag(worldState, 'prologue-eir_saved', true);
    setFlag(worldState, 'prologue-brandr_saved', true);
    setFlag(worldState, 'prologue-sigrun_taken', true);
    populateHomecoming(ctx);
    expect(logs).toContain('Eir is back at the temple and Brandr is back at Gunther’s forge.');
    expect(npc('npc-eir')).toMatchObject({ spriteKey: 'prologue-eir', x: 30, y: 29 });
    expect(npc('npc-brandr')).toMatchObject({ spriteKey: 'prologue-brandr', x: 44, y: 8 });
    expect(npc('npc-sigrun')).toBeNull();

    const said = new Set<string>([npc('npc-eir')!.dialogText]);
    const descend = (to: number) => incrementCounter(worldState, COTW_DEEPEST_FLOOR_COUNTER, to - (worldState.counters[COTW_DEEPEST_FLOOR_COUNTER] ?? 0));
    const steps: Array<() => void> = [
      () => descend(10),
      () => descend(18),
      () => setFlag(worldState, 'siphon_ritual_resolved', true),
      () => setFlag(worldState, RELIC_RECOVERED_FLAG, true),
      () => descend(34),
      () => setFlag(worldState, 'vidnir_slain', true),
    ];
    for (const step of steps) {
      step();
      populateHomecoming(ctx);
      said.add(npc('npc-eir')!.dialogText);
    }
    expect(said.size).toBe(steps.length + 1);
    expect(logs.filter((l) => l.includes('back at the temple'))).toHaveLength(1);
  });

  it('in the real town, everyone who can come home stands on open floor and blocks no door, stair or neighbour', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Home', { seed: 2, prologue: true });
    for (const id of ['prologue-eir', 'prologue-sigrun', 'prologue-brandr']) engine.worldState.flags[`${id}_saved`] = true;
    engine.handlePlayerAction(new WaitAction(engine.player));
    expect(engine.map.getEntityById('npc-eir'), 'not while the raid lasts').toBeNull();

    engine.diagnostics.endPrologue?.();
    for (let i = 1; i <= 4; i++) engine.worldState.flags[`captive_villager_${i}_rescued`] = true;
    engine.handlePlayerAction(new WaitAction(engine.player));

    const homecomers = ['npc-eir', 'npc-sigrun', 'npc-brandr', 'npc-returned-1', 'npc-returned-2', 'npc-returned-3', 'npc-returned-4'];
    for (const id of homecomers) expect(engine.map.getEntityById(id), id).toBeInstanceOf(NPC);

    const map = engine.map;
    const open = (x: number, y: number) => {
      const t = map.inBounds(x, y) ? map.getTile(x, y) : undefined;
      const occupant = map.getEntityAt(x, y);
      return !!t && (t.passable || t.type === 'door_closed') && (!occupant || occupant === engine.player);
    };
    const reach = new Set<string>([`${engine.player.x},${engine.player.y}`]);
    const queue = [{ x: engine.player.x, y: engine.player.y }];
    while (queue.length > 0) {
      const p = queue.shift()!;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (reach.has(`${x},${y}`) || !open(x, y)) continue;
        reach.add(`${x},${y}`);
        queue.push({ x, y });
      }
    }
    const reachable = (x: number, y: number) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => reach.has(`${x + dx},${y + dy}`));
    for (const e of map.getAllEntities()) {
      if (!(e instanceof NPC)) continue;
      expect(map.getTile(e.x, e.y)?.passable, e.name).toBe(true);
      expect(reachable(e.x, e.y), e.name).toBe(true);
    }
    for (const b of TOWN_BUILDINGS) expect(reach.has(`${b.door.x},${b.door.y}`), b.name).toBe(true);
    const stairs = cotwManifest.town!.stairsDown;
    expect(reach.has(`${stairs.x},${stairs.y}`) || reachable(stairs.x, stairs.y)).toBe(true);
  }, 30_000);
});
