import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, Monster, Player, type SpellDefinition } from '../../engine';
import { aimCardHtml, type SpellbookEntry } from '../targeting-overlay';

describe('aiming card markup', () => {
  const spell = { id: 'bolt', name: '<Bolt>', element: 'fire', manaCost: 3, range: 6, reflects: true, targetType: 'ray', areaOfEffect: 0 } as unknown as SpellDefinition;
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

  it('shows the power the cast will have and what the grid did to it', () => {
    const shaped = { ...spell, manaCost: 5, effects: [{ type: 'damage', amount: 14 }] } as unknown as SpellDefinition;
    const html = aimCardHtml(engineWithTarget(), { ...entry, manaCost: 5, spellDef: shaped, gridNotes: ['Hub: 4 neighbors, +60% mana, +80% power'] }, 5, 2);
    expect(html).toMatch(/5 \S+/);
    expect(html).toContain('Power');
    expect(html).toContain('14');
    expect(html).toContain('From the grid: Hub: 4 neighbors');
  });
});
