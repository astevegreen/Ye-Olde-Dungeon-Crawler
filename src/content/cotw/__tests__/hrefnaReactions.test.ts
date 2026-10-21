import { describe, it, expect } from 'vitest';
import { cotwManifest, COTW_CHOICES } from '../index';
import {
  HREFNA_ALTAR_CHOICE_ID,
  HREFNA_CHOICE_ID,
  HREFNA_FIRST_SPELL_CHOICE_ID,
  HREFNA_ID,
  HREFNA_POSITION,
  HREFNA_REACTION_CHOICES,
  HREFNA_VOID_DEBT_CHOICE_ID,
  hrefnaChoiceId,
} from '../hrefna';
import { FIRST_ALTAR_RITE_FLAG, FIRST_STONE_READ_FLAG, FIRST_VOID_DEBT_FLAG } from '../firstSpell';
import { COTW_GRIMOIRES } from '../grimoires';
import { COTW_MAGIC } from '../magic';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { serializeGame, deserializeGame } from '../../../engine/storage/serializer';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { NPC } from '../../../engine/entities/npc';
import { WaitAction } from '../../../engine/actions/wait';
import { MovementAction } from '../../../engine/actions/movement';
import { CastSpellAction } from '../../../engine/actions/spell-actions';
import { PerformAltarRiteAction } from '../../../engine/magic/altars';
import { createWorldState, setFlag } from '../../../engine/state/worldState';
import type { Action } from '../../../engine/actions/action';
import type { Entity } from '../../../engine/entities/entity';
import type { GameContentManifest } from '../../../engine/types/manifest';

function smallEngine(manifest: GameContentManifest = cotwManifest) {
  const map = new GameMap(15, 9, TILES.FLOOR);
  const hero = new Player({
    id: 'hero', name: 'Hero', position: { x: 2, y: 4 }, stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    mana: 30, maxMana: 30, spellsKnown: ['magic_arrow'], grimoireSystem: COTW_GRIMOIRES,
  });
  map.addEntity(hero);
  const engine = new GameEngine({ map, player: hero, seed: 7, manifest });
  const dummy = new Monster({ id: 'dummy', name: 'Dummy', position: { x: 7, y: 4 }, stats: { hp: 500, maxHp: 500, attack: 0, defense: 0 } });
  engine.addEntity(dummy);
  return { engine, hero, dummy };
}

/** An action that puts the hero into debt, done by whoever `actor` is. */
function debtAction(actor: Entity, hero: Player): Action {
  return { actor, perform: () => (hero.accrueVoidDebt(4), { success: true, cost: 100 }) };
}

describe('the first Void Debt flag', () => {
  it('is set the first time the hero casts short, and not by a cast the well can pay', () => {
    const { engine, hero, dummy } = smallEngine();
    hero.energy = 100;
    engine.handlePlayerAction(new CastSpellAction(hero, 'magic_arrow', dummy.x, dummy.y));
    expect(hero.voidDebt).toBe(0);
    expect(engine.getWorldFlag(FIRST_VOID_DEBT_FLAG)).toBe(false);

    hero.mana = 1;
    hero.energy = 100;
    const result = engine.handlePlayerAction(new CastSpellAction(hero, 'magic_arrow', dummy.x, dummy.y));
    expect(result.events?.some((e) => e.type === 'void_debt_accrued')).toBe(true);
    expect(engine.getWorldFlag(FIRST_VOID_DEBT_FLAG)).toBe(true);
  });

  it('is never set by a monster’s action, and is by the hero’s', () => {
    const { engine, hero, dummy } = smallEngine();
    engine.actionPipeline.executeWithHooks(debtAction(dummy, hero), engine);
    expect(hero.voidDebt).toBe(4);
    expect(engine.getWorldFlag(FIRST_VOID_DEBT_FLAG)).toBe(false);

    engine.actionPipeline.executeWithHooks(debtAction(hero, hero), engine);
    expect(engine.getWorldFlag(FIRST_VOID_DEBT_FLAG)).toBe(true);
  });
});

describe('the first altar rite flag', () => {
  const ALTAR = { x: 6, y: 2 };

  it('is set by the hero’s first completed rite', () => {
    const { engine, hero } = smallEngine();
    engine.currentFloor = 7;
    hero.assignGrimoireStat('mani', 'x', 'power');
    const result = engine.handlePlayerAction(
      new PerformAltarRiteAction(hero, 'galdr_altar_hel', ALTAR.x, ALTAR.y, { restat: { grimoireId: 'mani', stats: { x: 'swift' } } })
    );
    expect(result.success).toBe(true);
    expect(engine.getWorldFlag(FIRST_ALTAR_RITE_FLAG)).toBe(true);
  });

  it('is not set by a silent altar', () => {
    const silent = { id: 'galdr_altar_silent', name: 'Silent Stone', rite: 'gamble', free: true, performedMessage: '', spentMessage: '{altar} is silent.' };
    const manifest = { ...cotwManifest, magic: { ...COTW_MAGIC, altars: [...(COTW_MAGIC.altars ?? []), silent] } } as GameContentManifest;
    const { engine, hero } = smallEngine(manifest);
    const result = engine.handlePlayerAction(new PerformAltarRiteAction(hero, 'galdr_altar_silent', ALTAR.x, ALTAR.y, {}));
    expect(result).toMatchObject({ success: false, message: 'This altar is silent.' });
    expect(engine.getWorldFlag(FIRST_ALTAR_RITE_FLAG)).toBe(false);
  });
});

describe('what Hrefna says, by what the hero has learned', () => {
  it('keeps her opening lines until a teaching, then the newest wins: altar, then debt, then first spell', () => {
    const state = createWorldState();
    expect(hrefnaChoiceId(state)).toBe(HREFNA_CHOICE_ID);
    setFlag(state, FIRST_STONE_READ_FLAG, true);
    expect(hrefnaChoiceId(state)).toBe(HREFNA_FIRST_SPELL_CHOICE_ID);
    setFlag(state, FIRST_VOID_DEBT_FLAG, true);
    expect(hrefnaChoiceId(state)).toBe(HREFNA_VOID_DEBT_CHOICE_ID);
    setFlag(state, FIRST_ALTAR_RITE_FLAG, true);
    expect(hrefnaChoiceId(state)).toBe(HREFNA_ALTAR_CHOICE_ID);

    const altarOnly = createWorldState();
    setFlag(altarOnly, FIRST_ALTAR_RITE_FLAG, true);
    expect(hrefnaChoiceId(altarOnly)).toBe(HREFNA_ALTAR_CHOICE_ID);
    const debtOnly = createWorldState();
    setFlag(debtOnly, FIRST_VOID_DEBT_FLAG, true);
    expect(hrefnaChoiceId(debtOnly)).toBe(HREFNA_VOID_DEBT_CHOICE_ID);
  });

  it('re-seats her in her place with the new words on the next action in town, once, and a save keeps them', () => {
    const engine = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Seer', { seed: 3, prologue: true }).engine;
    engine.diagnostics.endPrologue?.();
    engine.handlePlayerAction(new WaitAction(engine.player));
    const hrefnas = () => engine.map.getAllEntities().filter((e) => e.id === HREFNA_ID) as NPC[];
    expect(hrefnas().map((h) => h.choiceId)).toEqual([HREFNA_CHOICE_ID]);

    const steps: [string, string][] = [
      [FIRST_STONE_READ_FLAG, HREFNA_FIRST_SPELL_CHOICE_ID],
      [FIRST_VOID_DEBT_FLAG, HREFNA_VOID_DEBT_CHOICE_ID],
      [FIRST_ALTAR_RITE_FLAG, HREFNA_ALTAR_CHOICE_ID],
    ];
    for (const [flag, choiceId] of steps) {
      engine.setWorldFlag(flag, true);
      engine.handlePlayerAction(new WaitAction(engine.player));
      expect(hrefnas()).toHaveLength(1);
      expect(hrefnas()[0]).toMatchObject({ ...HREFNA_POSITION, choiceId });
    }
    expect(engine.messages.filter((m) => m.includes('Hrefna the völva sits by the plaza fountain'))).toHaveLength(1);

    const { engine: loaded } = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), cotwManifest);
    loaded.handlePlayerAction(new WaitAction(loaded.player));
    const after = loaded.map.getAllEntities().filter((e) => e.id === HREFNA_ID) as NPC[];
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ ...HREFNA_POSITION, choiceId: HREFNA_ALTAR_CHOICE_ID });
  }, 30_000);

  it('opens her reaction when the hero walks into her, and the nod only says a line', () => {
    const engine = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Seer', { seed: 3, prologue: true }).engine;
    engine.diagnostics.endPrologue?.();
    engine.setWorldFlag(FIRST_STONE_READ_FLAG, true);
    engine.handlePlayerAction(new WaitAction(engine.player));
    const beside = { x: HREFNA_POSITION.x - 1, y: HREFNA_POSITION.y };
    expect(engine.map.moveEntity(engine.player, beside.x, beside.y)).toBe(true);
    let opened: string | undefined;
    engine.onChoiceInteract = (offered, onSelect) => {
      opened = offered.id;
      onSelect('nod');
    };
    engine.handlePlayerAction(new MovementAction(engine.player, 1, 0));
    expect(opened).toBe(HREFNA_FIRST_SPELL_CHOICE_ID);
    expect(engine.messages.at(-1)).toBe('Hrefna smiles, and turns back to the water.');
  }, 30_000);
});

describe('her reactions', () => {
  it.each(HREFNA_REACTION_CHOICES.map((c) => [c.id]))('%s: registered, one nod that only logs, cancelable, three short lines at most', (id) => {
    const choice = COTW_CHOICES[id];
    expect(choice).toBeDefined();
    expect(cotwManifest.choices?.[id]).toBe(choice);
    expect(choice.cancelable).toBe(true);
    expect(choice.options).toHaveLength(1);
    expect(choice.options[0].id).toBe('nod');
    expect(choice.options[0].consequences?.map((c) => c.type)).toEqual(['logMessage']);
    const lines = choice.description.split('\n\n');
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(100);
  });
});
