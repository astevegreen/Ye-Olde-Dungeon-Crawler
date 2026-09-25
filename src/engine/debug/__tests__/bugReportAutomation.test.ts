import { describe, it, expect, beforeEach } from 'vitest';
import { FlightRecorder } from '../flightRecorder';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { cotwManifest } from '../../../content/cotw';

describe('Bug Report Scoping & AI Reproduction Automation', () => {
  let recorder: FlightRecorder;
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    recorder = new FlightRecorder(150);
    const map = new GameMap(15, 15, TILES.FLOOR);
    player = new Player({
      id: 'p_test',
      name: 'TesterHero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 15, defense: 8 },
    });
    engine = new GameEngine({ map, player, manifest: cotwManifest });
  });

  it('extracts recent player action sequence for AI reproduction', () => {
    recorder.recordInput('ArrowUp', 'MovementAction', { dx: 0, dy: -1 });
    recorder.recordCombat('TesterHero', 'Goblin', 10, false);
    recorder.recordSpell('TesterHero', 'Firebolt', { x: 5, y: 3 }, 'fire');
    recorder.recordState('action', 'Player performed WaitAction (Success)', { action: 'WaitAction' });

    const sequence = recorder.getRecentActionSequence(10);
    expect(sequence).toHaveLength(4);
    expect(sequence[0]).toContain("Key 'ArrowUp' -> MovementAction");
    expect(sequence[1]).toBe('Combat: TesterHero dealt 10 dmg to Goblin');
    expect(sequence[2]).toContain("Spell: TesterHero cast 'Firebolt'");
    expect(sequence[3]).toBe('WaitAction');
  });

  it('scopes flight log according to selected bug category to prevent bloat', () => {
    recorder.recordInput('ArrowUp', 'MovementAction');
    recorder.recordCombat('TesterHero', 'Goblin', 8, false);
    recorder.recordSpell('TesterHero', 'Lightning', { x: 6, y: 5 });
    recorder.recordState('inventory', 'Picked up Iron Helm', { itemId: 'iron_helm' });
    recorder.recordWarning('Tile render texture delay', { texture: 'wall' });

    // Combat & Spells category: should keep combat and spells, omit inventory pickup and visual warnings
    const combatEvents = recorder.getScopedFlightLog('Combat & Spells');
    const combatTypes = combatEvents.map((e) => e.type);
    expect(combatTypes).toContain('combat');
    expect(combatTypes).toContain('spell');
    expect(combatEvents.some((e) => e.summary.includes('Iron Helm'))).toBe(false);

    // Items & Inventory category: should keep inventory events, omit combat
    const itemEvents = recorder.getScopedFlightLog('Items & Inventory');
    expect(itemEvents.some((e) => e.summary.includes('Iron Helm'))).toBe(true);
    expect(itemEvents.some((e) => e.type === 'combat')).toBe(false);
  });

  it('applies smart lean defaults for Visual & UI bugs without massive data dumps', () => {
    const pkg = recorder.generatePackage(engine, undefined, {
      category: 'Visual & UI',
      subject: 'Button alignment issue',
    });

    // Visual bugs should omit raw save snapshots and ASCII dungeon maps by default
    expect(pkg.stateSnapshot).toBeUndefined();
    expect(pkg.asciiMap).toBeUndefined();
    expect(pkg.metadata.category).toBe('Visual & UI');
    expect(pkg.metadata.subject).toBe('Button alignment issue');
    expect(pkg.reproduction).toBeDefined();
    expect(pkg.markdownReport).toContain('AI Agent Reproduction Context');
  });

  it('includes state snapshot by default for Crash / Freeze bugs for full reproducibility', () => {
    const pkg = recorder.generatePackage(engine, undefined, {
      category: 'Crash / Freeze',
      error: new Error('Simulated null pointer dereference'),
    });

    // Crash reports include the save snapshot to allow exact reconstruction
    expect(pkg.stateSnapshot).toBeDefined();
    expect(pkg.metadata.category).toBe('Crash / Freeze');
    expect(pkg.markdownReport).toContain('Simulated null pointer dereference');
    expect(pkg.markdownReport).toContain('AI Agent Reproduction Context');
  });

  it('embeds clean AI Agent Reproduction Context with PRNG state and coords', () => {
    recorder.recordInput('ArrowDown', 'MovementAction');
    const report = recorder.generateReport(engine, undefined, {
      category: 'Combat & Spells',
      subject: 'Monster counter-attack missed check',
      userNotes: 'Attacked goblin twice and game did not advance turns.',
    });

    expect(report).toContain('AI Agent Reproduction Context (Claude Code & Antigravity)');
    expect(report).toContain('PRNG State');
    expect(report).toContain('**Player Coordinates**: `(5, 5)`');
    expect(report).toContain('Playtester Notes');
    expect(report).toContain('Attacked goblin twice and game did not advance turns.');
    expect(report).toContain('Reproduction Hint');
  });
});
