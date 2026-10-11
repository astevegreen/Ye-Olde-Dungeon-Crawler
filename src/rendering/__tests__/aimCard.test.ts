import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, Monster, Player, type SpellDefinition } from '../../engine';
import { aimCardHtml, type SpellbookEntry } from '../targeting-overlay';

describe('aiming card markup', () => {
  const spell = { id: 'bolt', name: '<Bolt>', element: 'fire', manaCost: 3, range: 6, reflects: true, targetType: 'ray', areaOfEffect: 0, effects: [] } as unknown as SpellDefinition;
  const entry: SpellbookEntry = { key: '1', type: 'spell', id: 'bolt', name: 'Bolt', spellDef: spell };

  function engineWithTarget(): GameEngine {
    const map = GameMap.createBoxRoom(12, 12);
    const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } }), floor: 1 });
    const imp = new Monster({ id: 'imp', name: 'Imp', position: { x: 5, y: 2 }, stats: { hp: 3, maxHp: 12, attack: 1, defense: 0 }, resistances: { fire: 'weak' } });
    map.addEntity(imp);
    return engine;
  }

  it('names the spell, its cost and the target, with the target’s weakness in the good tone', () => {
    const html = aimCardHtml(engineWithTarget(), entry, 5, 2);
    expect(html).toContain('&lt;Bolt&gt;');
    expect(html).toMatch(/3 \S+/);
    expect(html).toContain('Imp');
    expect(html).toContain('width: 25%');
    expect(html).toContain('mc-intent is-good');
    expect(html).toContain('Weak to fire');
    expect(html).toContain('Bounces off walls');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });

  it('says so when the reticle is on empty ground, and counts a wand’s charges', () => {
    const html = aimCardHtml(engineWithTarget(), { ...entry, type: 'wand', charges: 2, maxCharges: 5 }, 8, 8);
    expect(html).toContain('Empty space');
    expect(html).toContain('2 / 5 charges');
  });

  it('says why a thrown burst stops short of the tile aimed at, and says nothing when it lands there', () => {
    const ball = { id: 'ball', name: 'Ball', element: 'fire', manaCost: 5, range: 6, targetType: 'area_burst', areaOfEffect: 1, effects: [], visual: { archetype: 'projectile_burst' } } as unknown as SpellDefinition;
    const throwBall: SpellbookEntry = { ...entry, id: 'ball', name: 'Ball', spellDef: ball };
    const engine = engineWithTarget(); // the hero at (2, 2), an imp at (5, 2), walls round a 12 by 12 room
    expect(aimCardHtml(engine, throwBall, 7, 2)).toContain('Bursts short: Imp is in the way');
    expect(aimCardHtml(engine, throwBall, 5, 2)).not.toContain('Bursts short');
    expect(aimCardHtml(engine, throwBall, 2, 0)).toContain('Bursts short: a wall is in the way');
    expect(aimCardHtml(engine, { ...throwBall, spellDef: { ...ball, range: 3 } }, 2, 8)).toContain('Bursts short: out of range');

    // With nothing in the way, it lands on every tile in range.
    const open = new GameEngine({ map: GameMap.createBoxRoom(12, 12), player: new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } }), floor: 1 });
    for (let y = 1; y < 11; y++) {
      for (let x = 1; x < 11; x++) {
        if (Math.hypot(x - 2, y - 2) > ball.range) continue;
        expect(aimCardHtml(open, throwBall, x, y), `aimed at ${x},${y}`).not.toContain('Bursts short');
      }
    }
  });

  it('shows the power the cast will have and what the grid did to it', () => {
    const shaped = { ...spell, manaCost: 5, effects: [{ type: 'damage', amount: 14 }] } as unknown as SpellDefinition;
    const html = aimCardHtml(engineWithTarget(), { ...entry, manaCost: 5, spellDef: shaped, gridNotes: ['Hub: 4 neighbors, +60% mana, +80% power'] }, 5, 2);
    expect(html).toMatch(/5 \S+/);
    expect(html).toContain('Power');
    expect(html).toContain('14');
    expect(html).toContain('From the grid: Hub: 4 neighbors');
  });
});
