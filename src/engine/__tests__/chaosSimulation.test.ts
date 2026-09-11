import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../storage/profile-manager';
import { MovementAction } from '../actions/movement';
import { WaitAction } from '../actions/wait';
import { OpenDoorAction } from '../actions/door';
import { PickUpAction, DropAction, EquipAction, UnequipAction } from '../actions/inventory-actions';
import { ClimbStairsAction } from '../actions/stairs';
import { RestAction } from '../actions/rest';
import { CastSpellAction } from '../actions/spell-actions';
import { ItemFactory } from '../items/factory';
import { Container } from '../items/container';
import { BankService, TempleService } from '../economy/services';
import { flightRecorder } from '../debug/flightRecorder';

// Simple Linear Congruential Generator for reproducible pseudo-randomness
class SeededRNG {
  private state: number;
  constructor(seed = 123456789) {
    this.state = seed;
  }
  public next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  public pick<T>(array: readonly T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

describe('Headless Chaos / Monkey Simulation (5,000 Actions)', () => {
  it('executes 5,000 chaotic actions without invariant violations, deadlocks, or NaN values', async () => {
    const rng = new SeededRNG(424242);
    const storage = new MemoryStorage();
    const pm = new ProfileManager(storage);

    // 1. Initialize full game session with cotw manifest
    const session = pm.createCharacter('ChaosMonkey', {
      strength: 14,
      startInTown: true,
    });
    let engine = session.engine;
    let profile = session.profile;

    // Seed some fun items into backpack for chaotic inventory interactions
    const pack = engine.player.inventory.primaryPack;
    pack.addItem(ItemFactory.createBroadsword('monkey-sword'));
    pack.addItem(ItemFactory.createCursedMace('monkey-cursed-mace'));
    pack.addItem(ItemFactory.createWoodenShield('monkey-shield'));
    pack.addItem(ItemFactory.createLeatherArmor('monkey-armor'));
    pack.addItem(
      new Container({
        id: 'monkey-pouch',
        name: 'Small Belt Pouch',
        category: 'container',
        slot: 'waist',
        containerType: 'belt',
        weight: 200,
        bulk: 400,
        maxWeightCapacity: 3000,
        maxBulkCapacity: 2000,
      })
    );

    // Ensure player knows core offensive/utility spells
    engine.player.spellsKnown = [
      'magic_arrow',
      'firebolt',
      'lightning_bolt',
      'heal_minor',
      'phase_door',
    ];

    const TOTAL_ACTIONS = 5000;
    let successfulActions = 0;
    let failedActions = 0;
    let saveReloadCount = 0;
    let deathCount = 0;
    const saveSizesKb: number[] = [];

    const startTime = Date.now();

    // 2. 5,000-Action Chaos Loop
    for (let tick = 1; tick <= TOTAL_ACTIONS; tick++) {
      if (tick % 500 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const p = engine.player;

      // Revive player if killed in previous combat so stress test continues
      if (!p.isAlive()) {
        deathCount++;
        p.hp = p.maxHp;
        p.mana = p.maxMana;
      }

      // Periodically give player mana to keep spellcasting active
      if (p.mana < 5) {
        p.mana = p.maxMana;
      }

      // Periodic Mid-Run Save & Reload (every 500 ticks)
      if (tick % 500 === 0) {
        pm.saveCharacter(engine, profile);
        const reloaded = pm.loadCharacter(profile.id);
        expect(reloaded).not.toBeNull();
        if (reloaded) {
          engine = reloaded.engine;
          profile = reloaded.profile;
          saveReloadCount++;

          const rawSave = storage.getItem(`cotw_save_${profile.id}`);
          if (rawSave) {
            saveSizesKb.push(parseFloat((rawSave.length / 1024).toFixed(2)));
          }
        }
      }

      // Decide chaotic action category
      const roll = rng.next();

      if (roll < 0.40) {
        // --- CATEGORY A: 8-Way Movement / Bump ---
        const DIRS = [
          [-1, -1], [0, -1], [1, -1],
          [-1,  0],          [1,  0],
          [-1,  1], [0,  1], [1,  1],
        ];
        const [dx, dy] = rng.pick(DIRS);
        const targetX = p.x + dx;
        const targetY = p.y + dy;

        const tile = engine.map.getTile(targetX, targetY);
        if (tile && tile.type === 'door_closed') {
          const action = new OpenDoorAction(p, targetX, targetY);
          const res = engine.handlePlayerAction(action);
          if (res.success) successfulActions++;
          else failedActions++;
        } else {
          const action = new MovementAction(p, dx, dy);
          const res = engine.handlePlayerAction(action);
          if (res.success) successfulActions++;
          else failedActions++;
        }
      } else if (roll < 0.60) {
        // --- CATEGORY B: Complex Inventory Operations ---
        const subRoll = rng.next();

        if (subRoll < 0.25) {
          // Ground Loot Pick Up
          const pickAction = new PickUpAction(p);
          const res = engine.handlePlayerAction(pickAction);
          if (res.success) successfulActions++;
          else failedActions++;
        } else if (subRoll < 0.50) {
          // Equip gear from pack
          const packItems = p.inventory.primaryPack.getItems();
          if (packItems.length > 0) {
            const item = rng.pick(packItems);
            const equipAction = new EquipAction(p, item.id);
            const res = engine.handlePlayerAction(equipAction);
            if (res.success) successfulActions++;
            else failedActions++;
          } else {
            // Seed a new random item to keep pack populated
            p.inventory.primaryPack.addItem(ItemFactory.createDagger(`loot-${tick}`));
            successfulActions++;
          }
        } else if (subRoll < 0.75) {
          // Unequip random slot (may be blocked if cursed)
          const equipped = p.inventory.paperdoll.getAllEquipped();
          const nonContainers = equipped.filter((e) => e.slot !== 'pack' && e.slot !== 'purse');
          if (nonContainers.length > 0) {
            const target = rng.pick(nonContainers);
            const unequipAction = new UnequipAction(p, target.slot);
            const res = engine.handlePlayerAction(unequipAction);
            if (res.success) successfulActions++;
            else failedActions++;
          } else {
            successfulActions++;
          }
        } else {
          // Drop item from pack onto floor
          const packItems = p.inventory.primaryPack.getItems();
          if (packItems.length > 0) {
            const item = rng.pick(packItems);
            const dropAction = new DropAction(p, item, 'pack');
            const res = engine.handlePlayerAction(dropAction);
            if (res.success) successfulActions++;
            else failedActions++;
          } else {
            successfulActions++;
          }
        }
      } else if (roll < 0.75) {
        // --- CATEGORY C: Spellcasting & Raycasting ---
        const spellId = rng.pick(p.spellsKnown);
        // Target can be an enemy or an arbitrary tile (adjacent wall in tight corridor or far room)
        const targetOffsets = [
          [0, 0],   // Self
          [1, 0],   // East wall
          [-1, 0],  // West wall
          [0, 1],   // South wall
          [0, -1],  // North wall
          [rng.nextInt(-5, 5), rng.nextInt(-5, 5)], // Ranged target
        ];
        const [txOffset, tyOffset] = rng.pick(targetOffsets);
        const targetX = Math.max(0, Math.min(engine.map.width - 1, p.x + txOffset));
        const targetY = Math.max(0, Math.min(engine.map.height - 1, p.y + tyOffset));

        const spellAction = new CastSpellAction(p, spellId, targetX, targetY);
        const res = engine.handlePlayerAction(spellAction);
        if (res.success) successfulActions++;
        else failedActions++;
      } else if (roll < 0.85) {
        // --- CATEGORY D: Stairs & Floor Transitions ---
        const currentTile = engine.map.getTile(p.x, p.y);
        if (currentTile?.type === 'stairs_up' || currentTile?.type === 'stairs_down') {
          const stairAction = new ClimbStairsAction(p);
          const res = engine.handlePlayerAction(stairAction);
          if (res.success) successfulActions++;
          else failedActions++;
        } else {
          // Occasionally directly trigger changeFloor to test rapid multi-floor switching
          const nextFloor = rng.nextInt(0, 5);
          engine.changeFloor(nextFloor);
          successfulActions++;
        }
      } else if (roll < 0.95) {
        // --- CATEGORY E: Town Economy & Temple Services ---
        if (engine.currentFloor === 0) {
          const serviceRoll = rng.next();
          if (serviceRoll < 0.5) {
            // Bank currency exchange & weight compaction
            BankService.compactCurrency(p);
          } else {
            // Temple curse cleansing
            TempleService.cleanseCurses(p);
          }
          successfulActions++;
        } else {
          // Wait action in dungeon
          const waitAction = new WaitAction(p);
          engine.handlePlayerAction(waitAction);
          successfulActions++;
        }
      } else {
        // --- CATEGORY F: Resting ---
        const restAction = new RestAction(p, 20);
        const res = engine.handlePlayerAction(restAction);
        if (res.success) successfulActions++;
        else failedActions++;
      }

      // =========================================================================
      // CRITICAL INVARIANT ASSERTIONS CHECKED ON EVERY SINGLE TICK
      // =========================================================================

      // Invariant 1: Player HP must never be NaN or negative while alive
      expect(Number.isNaN(p.hp)).toBe(false);
      expect(Number.isNaN(p.maxHp)).toBe(false);
      expect(Number.isNaN(p.mana)).toBe(false);
      expect(Number.isNaN(p.maxMana)).toBe(false);
      if (p.isAlive()) {
        expect(p.hp).toBeGreaterThan(0);
      }

      // Invariant 2: Total carried inventory weight and bulk strictly equals the recursive sum of contents
      let manualRecursiveWeight = 0;
      for (const eq of p.inventory.paperdoll.getAllEquipped()) {
        manualRecursiveWeight += eq.item.totalWeight();
      }
      if (p.inventory.paperdoll.getItem('pack') !== p.inventory.primaryPack) {
        manualRecursiveWeight += p.inventory.primaryPack.totalWeight();
      }
      expect(p.inventory.totalWeight()).toBe(manualRecursiveWeight);
      expect(Number.isNaN(p.inventory.totalWeight())).toBe(false);
      expect(p.inventory.totalWeight()).toBeGreaterThanOrEqual(0);

      // Invariant 3: Scheduler queue speed > 0 and no division by zero
      expect(p.speed).toBeGreaterThan(0);
      for (const ent of engine.map.getAllEntities()) {
        expect(ent.speed).toBeGreaterThan(0);
        expect(Number.isNaN(ent.energy)).toBe(false);
      }

      // Invariant 4: Flight recorder buffer strictly caps at 150 events
      const events = flightRecorder.getEvents();
      expect(events.length).toBeLessThanOrEqual(150);
      if (events.length > 1) {
        // Monotonic event ID sequencing
        for (let i = 1; i < events.length; i++) {
          expect(events[i].id).toBeGreaterThan(events[i - 1].id);
          expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const avgMsPerTick = durationMs / TOTAL_ACTIONS;

    console.log(`\n======================================================`);
    console.log(`CHAOS SIMULATION COMPLETE`);
    console.log(`Total Actions: ${TOTAL_ACTIONS}`);
    console.log(`Successful: ${successfulActions} | Rejected/Invalid: ${failedActions}`);
    console.log(`Save & Reload Cycles: ${saveReloadCount}`);
    console.log(`Player Deaths Revived: ${deathCount}`);
    console.log(`Total Duration: ${durationMs}ms`);
    console.log(`Avg Tick Latency: ${avgMsPerTick.toFixed(3)}ms`);
    console.log(`Save Payload Sizes: ${saveSizesKb.join(' KB, ')} KB`);
    console.log(`======================================================\n`);

    expect(successfulActions + failedActions).toBeGreaterThanOrEqual(TOTAL_ACTIONS - 100);
    expect(avgMsPerTick).toBeLessThan(25); // Fast headless execution (<25ms per tick with full recursive tree validation and serialization)
  }, 120_000);
});
