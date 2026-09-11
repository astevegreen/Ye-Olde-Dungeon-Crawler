import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { ValkyrieSprintGauntlet } from '../valkyrieSprint';

describe('ValkyrieSprintGauntlet Mechanic', () => {
  function createTestEngine(floor = 6) {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
      strength: 14,
      dexterity: 14,
      mana: 20,
    });
    const engine = new GameEngine({ map, player, floor });
    return { engine, player };
  }

  it('initiates gauntlet and loads 12x8 Stage 1 Collapsing Chasm', () => {
    const { engine, player } = createTestEngine();
    const gauntlet = new ValkyrieSprintGauntlet();

    gauntlet.startGauntlet(engine);

    expect(gauntlet.active).toBe(true);
    expect(gauntlet.stage).toBe(1);
    expect(gauntlet.originFloor).toBe(6);
    expect(engine.map.width).toBe(12);
    expect(engine.map.height).toBe(8);
    expect(player.x).toBe(1);
    expect(player.y).toBe(4);
    expect(gauntlet.telegraphedDangerTiles.length).toBeGreaterThan(0);
  });

  it('advances from Stage 1 to Stage 2 upon reaching exit threshold', () => {
    const { engine, player } = createTestEngine();
    const gauntlet = new ValkyrieSprintGauntlet();
    gauntlet.startGauntlet(engine);

    // Player steps on exit threshold (10, 4)
    player.x = 10;
    player.y = 4;
    gauntlet.checkThresholdStep(engine, 10, 4);

    expect(gauntlet.stage).toBe(2);
    expect(player.x).toBe(1);
    expect(player.y).toBe(4);
  });

  it('clears Stage 2 Barricade via Strength bash, Dexterity lockpick, and Spell blast', () => {
    // 1. Strength Bash
    {
      const { engine } = createTestEngine();
      const gauntlet = new ValkyrieSprintGauntlet();
      gauntlet.startGauntlet(engine);
      gauntlet.loadStage2(engine);

      const bashRes = gauntlet.attemptBashBarricade(engine);
      expect(bashRes.success).toBe(true);
      expect(gauntlet.barricadeCleared).toBe(true);
    }

    // 2. Dexterity Pick
    {
      const { engine } = createTestEngine();
      const gauntlet = new ValkyrieSprintGauntlet();
      gauntlet.startGauntlet(engine);
      gauntlet.loadStage2(engine);

      const pickRes = gauntlet.attemptPickBarricade(engine);
      expect(pickRes.success).toBe(true);
      expect(gauntlet.barricadeCleared).toBe(true);
    }

    // 3. Spell Blast
    {
      const { engine, player } = createTestEngine();
      const gauntlet = new ValkyrieSprintGauntlet();
      gauntlet.startGauntlet(engine);
      gauntlet.loadStage2(engine);

      const initialMana = player.mana;
      const spellRes = gauntlet.attemptSpellBlastBarricade(engine, 'firebolt');
      expect(spellRes.success).toBe(true);
      expect(gauntlet.barricadeCleared).toBe(true);
      expect(player.mana).toBe(initialMana - 8);
    }

    // 4. Standard Weapon / Melee Attack (door HP fallback)
    {
      const { engine } = createTestEngine();
      const gauntlet = new ValkyrieSprintGauntlet();
      gauntlet.startGauntlet(engine);
      gauntlet.loadStage2(engine);

      expect(gauntlet.doorHp).toBe(20);

      // Swing 1: 8 damage (20 -> 12)
      const swing1 = gauntlet.attemptAttackBarricade(engine);
      expect(swing1.success).toBe(false);
      expect(swing1.doorHpRemaining).toBe(12);
      expect(gauntlet.doorHp).toBe(12);
      expect(gauntlet.barricadeCleared).toBe(false);

      // Swing 2: 8 damage (12 -> 4)
      const swing2 = gauntlet.attemptAttackBarricade(engine);
      expect(swing2.success).toBe(false);
      expect(swing2.doorHpRemaining).toBe(4);
      expect(gauntlet.doorHp).toBe(4);
      expect(gauntlet.barricadeCleared).toBe(false);

      // Swing 3: 8 damage (4 -> 0, shatters)
      const swing3 = gauntlet.attemptAttackBarricade(engine);
      expect(swing3.success).toBe(true);
      expect(swing3.doorHpRemaining).toBe(0);
      expect(gauntlet.doorHp).toBe(0);
      expect(gauntlet.barricadeCleared).toBe(true);
    }
  });

  it('completes Stage 3 and exits to Bjarnarhaven town gate (Floor 0, x:25, y:15)', () => {
    const { engine, player } = createTestEngine();
    const gauntlet = new ValkyrieSprintGauntlet();
    gauntlet.startGauntlet(engine);

    // Transition to Stage 3
    gauntlet.loadStage3(engine);
    expect(gauntlet.stage).toBe(3);

    // Reaching exit threshold completes gauntlet
    gauntlet.checkThresholdStep(engine, 10, 4);

    expect(gauntlet.active).toBe(false);
    expect(engine.currentFloor).toBe(0);
    expect(player.x).toBe(25);
    expect(player.y).toBe(15);
  });

  it('aborts gauntlet upon failure or timeout and safely ejects player to Floor 6 entrance preserving stairs down', () => {
    const { engine, player } = createTestEngine(6);
    engine.map.setTile(12, 12, TILES.STAIRS_DOWN);

    const gauntlet = new ValkyrieSprintGauntlet();
    gauntlet.startGauntlet(engine);

    expect(gauntlet.active).toBe(true);
    expect(engine.currentFloor).toBe(6);

    const initialHp = player.hp;
    // Abort gauntlet
    gauntlet.abortGauntlet(engine, 'Test timeout');

    expect(gauntlet.active).toBe(false);
    // Player returned to origin floor and position
    expect(engine.currentFloor).toBe(6);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    // Minor attrition damage (10)
    expect(player.hp).toBe(initialHp - 10);

    // Down-stairs to Floor 7 are still intact on Floor 6
    const stairs = engine.map.getTile(12, 12);
    expect(stairs?.type).toBe('stairs_down');
    expect(stairs?.passable).toBe(true);
  });
});
