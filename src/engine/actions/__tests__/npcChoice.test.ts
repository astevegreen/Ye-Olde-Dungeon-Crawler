import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { NPC } from '../../entities/npc';
import { MovementAction } from '../movement';
import { MonsterAI } from '../../ai/behaviorTree';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import type { ChoiceDefinition } from '../../types/choice';
import type { GameContentManifest } from '../../types/manifest';

const SMITH_CHOICE: ChoiceDefinition = {
  id: 'smith_talk',
  title: 'The Smith',
  description: 'She looks up from the anvil.',
  options: [
    { id: 'learn', label: 'Learn a spell', consequences: [{ type: 'learnSpell', spellId: 'test_bolt' }, { type: 'setFlag', flag: 'learned', value: true }] },
  ],
  cancelable: true,
};

function setup(): { engine: GameEngine; player: Player; map: GameMap } {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 4, y: 5 } });
  const manifest = { id: 'test', name: 'Test', choices: { smith_talk: SMITH_CHOICE } } as unknown as GameContentManifest;
  const engine = new GameEngine({ map, player, floor: 3, manifest });
  map.addEntity(new NPC({ id: 'smith', name: 'Smith', role: 'villager', position: { x: 5, y: 5 }, choiceId: 'smith_talk' }));
  return { engine, player, map };
}

describe('An NPC that carries a choice', () => {
  it('opens it on every talk, never resolving it, and does not spend a turn', () => {
    const { engine, player } = setup();
    let offers = 0;
    let greeted = 0;
    engine.onNpcInteract = () => greeted++;
    engine.onChoiceInteract = (choice, onSelect) => {
      offers++;
      expect(choice.id).toBe('smith_talk');
      onSelect('learn');
    };
    const turn = engine.turnCount;
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(offers).toBe(2);
    expect(greeted).toBe(0);
    expect(player.x).toBe(4);
    expect(engine.turnCount).toBe(turn);
    expect(engine.getWorldFlag('learned')).toBe(true);
    // learnSpell: known once, however often it is taught
    expect(player.spellsKnown.filter((s) => s === 'test_bolt')).toHaveLength(1);
  });

  it('greets as before when it carries none', () => {
    const { engine, player, map } = setup();
    map.removeEntity(map.getEntityById('smith')!);
    map.addEntity(new NPC({ id: 'plain', name: 'Plain', role: 'villager', position: { x: 5, y: 5 } }));
    let greeted = 0;
    engine.onNpcInteract = () => greeted++;
    engine.onChoiceInteract = () => {
      throw new Error('no choice expected');
    };
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(greeted).toBe(1);
  });

  it('keeps its choice through a save', () => {
    const { engine } = setup();
    const { engine: restored } = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), engine.manifest);
    expect((restored.map.getEntityById('smith') as NPC).choiceId).toBe('smith_talk');
  });
});

describe('A neutral monster', () => {
  it('holds its place instead of closing on the player, and turns hostile again on demand', () => {
    const { engine, map } = setup();
    const wight = new Monster({ id: 'w', name: 'Wight', position: { x: 7, y: 5 }, stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 } });
    map.addEntity(wight);
    wight.setFaction('neutral');
    expect(MonsterAI.decideAction(wight, engine).constructor.name).toBe('WaitAction');
    wight.setFaction('hostile');
    expect(MonsterAI.decideAction(wight, engine).constructor.name).not.toBe('WaitAction');
  });

  it('trades places with the hero in a one-tile corridor, so it never walls it off', () => {
    // A corridor along y = 5: walls everywhere else.
    const map = new GameMap(10, 10, TILES.WALL);
    for (let x = 1; x < 9; x++) map.setTile(x, 5, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 5 } });
    const engine = new GameEngine({ map, player, floor: 3 });
    const wight = new Monster({ id: 'w', name: 'Wight', position: { x: 4, y: 5 }, stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 } });
    map.addEntity(wight);
    wight.setFaction('neutral');

    const result = engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(result.success).toBe(true);
    expect([player.x, player.y]).toEqual([4, 5]);
    expect([wight.x, wight.y]).toEqual([3, 5]);
    expect(map.getEntityAt(3, 5)).toBe(wight);
    expect(engine.messages.some((m) => m.includes('stands aside'))).toBe(true);

    // The hero's companion trades places too.
    const hound = new Monster({ id: 'h', name: 'Hound', position: { x: 5, y: 5 }, stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 }, faction: 'player' });
    map.addEntity(hound);
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect([player.x, hound.x]).toEqual([5, 4]);
    expect(hound.hp).toBe(10);
    expect(engine.messages.some((m) => m.includes('You trade places with Hound'))).toBe(true);
    engine.handlePlayerAction(new MovementAction(player, -1, 0));
    expect([player.x, hound.x]).toEqual([4, 5]);

    // Hostile again, it is a fight, not a swap.
    wight.setFaction('hostile');
    engine.handlePlayerAction(new MovementAction(player, -1, 0));
    expect([player.x, wight.x]).toEqual([4, 3]);
  });
});
