import { describe, it, expect, beforeEach } from 'vitest';
import { FlightRecorder } from '../flightRecorder';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import type { CharacterProfile } from '../../storage/types';
import { cotwManifest } from '../../../content/cotw';

describe('Developer Diagnostic Flight Recorder', () => {
  let recorder: FlightRecorder;

  beforeEach(() => {
    recorder = new FlightRecorder(150);
  });

  it('enforces circular 150-event rolling window buffer', () => {
    expect(recorder.capacity).toBe(150);
    expect(recorder.getEvents()).toHaveLength(0);

    // Push 200 events
    for (let i = 1; i <= 200; i++) {
      recorder.recordInput(`Key${i}`, `Action${i}`, { index: i });
    }

    const events = recorder.getEvents();
    expect(events).toHaveLength(150);

    // The oldest 50 events (1..50) must have been discarded
    expect(events[0].summary).toBe("Key 'Key51' -> Action51");
    expect(events[0].details?.index).toBe(51);

    // The latest event (200) must be at the tail
    expect(events[149].summary).toBe("Key 'Key200' -> Action200");
    expect(events[149].details?.index).toBe(200);
  });

  it('correctly records all specialized telemetry event types', () => {
    recorder.recordInput('ArrowUp', 'MovementAction', { dx: 0, dy: -1 });
    recorder.recordScheduler('monster_orc', 100, 5);
    recorder.recordCombat('Hero', 'Goblin', 8, false, { weapon: 'Broadsword' });
    recorder.recordCombat('Hero', 'Goblin', 12, true, { weapon: 'Broadsword' });
    recorder.recordSpell('Hero', 'Firebolt', { x: 5, y: 8 }, 'fire');
    recorder.recordState('quest', 'Relic retrieved', { relicId: 'sunstone' });
    recorder.recordWarning('Low memory condition', { memoryMb: 12 });
    recorder.recordError(new Error('Synthetic spell misfire'), { spellId: 'teleport' });

    const events = recorder.getEvents();
    expect(events).toHaveLength(8);

    expect(events[0].type).toBe('input');
    expect(events[0].summary).toContain("Key 'ArrowUp' -> MovementAction");

    expect(events[1].type).toBe('scheduler');
    expect(events[1].summary).toContain("Actor 'monster_orc' spent 100 energy");

    expect(events[2].type).toBe('combat');
    expect(events[2].summary).toBe('Hero dealt 8 dmg to Goblin');

    expect(events[3].type).toBe('combat');
    expect(events[3].summary).toBe('Hero dealt 12 dmg to Goblin (FATAL)');

    expect(events[4].type).toBe('spell');
    expect(events[4].summary).toBe("Hero cast 'Firebolt' at (5, 8) [fire]");

    expect(events[5].type).toBe('state');
    expect(events[5].summary).toBe('[quest] Relic retrieved');

    expect(events[6].type).toBe('warning');
    expect(events[6].summary).toBe('WARN: Low memory condition');

    expect(events[7].type).toBe('error');
    expect(events[7].summary).toBe('ERROR: Synthetic spell misfire');
    expect(events[7].details?.stack).toBeDefined();
    expect(events[7].details?.spellId).toBe('teleport');
  });

  it('generates a comprehensive Antigravity Markdown diagnostic report', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({
      id: 'p_test',
      name: 'Ragnar',
      position: { x: 4, y: 7 },
      stats: { hp: 45, maxHp: 50, attack: 14, defense: 6 },
      strength: 16,
      dexterity: 14,
      constitution: 15,
      intelligence: 12,
      mana: 20,
      maxMana: 30,
    });
    const engine = new GameEngine({ map, player, manifest: cotwManifest });

    const orc = new Monster({
      id: 'orc_1',
      name: 'Orc Warrior',
      position: { x: 6, y: 7 },
      stats: { hp: 18, maxHp: 18, attack: 8, defense: 2 },
    });
    engine.addEntity(orc);

    const profile: CharacterProfile = {
      id: 'ragnar_save',
      name: 'Ragnar',
      gender: 'male',
      level: 2,
      floor: 1,
      lastSaved: Date.now(),
      hp: 45,
      maxHp: 50,
      strength: 16,
    };

    recorder.recordInput('ArrowRight', 'MovementAction');
    recorder.recordCombat('Ragnar', 'Orc Warrior', 9, false);

    const report = recorder.generateReport(engine, profile, { includeSnapshot: true, appVersion: '1.0.0' });

    // Header & Section Verifications
    expect(report).toContain('# Castle of the Winds - Diagnostic Flight Report');
    expect(report).toContain('## 1. System Telemetry');
    expect(report).toContain('cotw');
    expect(report).toContain('1.0.0');

    // Player State
    expect(report).toContain('## 2. Player State');
    expect(report).toContain('**Ragnar**');
    expect(report).toContain('HP `45/50`');
    expect(report).toContain('MP `20/30`');
    expect(report).toContain('STR `16`');
    expect(report).toContain('Location');

    // Map Telemetry
    expect(report).toContain('## 3. Active Floor Telemetry');
    expect(report).toContain('20 x 20');
    expect(report).toContain('Orc Warrior');

    // Flight Log
    expect(report).toContain('## 4. Chronological Flight Log');
    expect(report).toContain('| ID | +Time | Type | Summary | Details |');
    expect(report).toContain('ArrowRight');
    expect(report).toContain('Ragnar dealt 9 dmg to Orc Warrior');

    // State Snapshot JSON
    expect(report).toContain('## 5. State Snapshot (at report time)');
    expect(report).toContain('```json');
    expect(report).toContain('"name":"Ragnar"');
  });

  it('can clear the buffer', () => {
    recorder.recordInput('KeyW');
    recorder.recordInput('KeyS');
    expect(recorder.getEvents()).toHaveLength(2);

    recorder.clear();
    expect(recorder.getEvents()).toHaveLength(0);
  });
});
