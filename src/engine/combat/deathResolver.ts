import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
// Type-only: erased at compile time, so this does not create a runtime import edge.
// entities/companion.ts's `class Companion extends Monster` sits in a load-order
// cycle reachable from entities/monster.ts (which imports this very file) — a
// *value* import of Companion here would reintroduce that crash. `isCompanion()`
// below duck-types on `companionDefinitionId` instead, so this module never needs
// the runtime class at all.
import type { Companion } from '../entities/companion';
import type { GameEngine } from '../engine';
import { TILES } from '../grid/tile';
import { HookDispatcher } from '../hooks/hookDispatcher';
import { CorpseItemInstance } from '../items/corpse';
import { DeathEnvelopeTracker } from '../analytics/deathEnvelope';

/** Duck-typed check avoiding a value import of Companion (see import comment above). */
function isCompanion(entity: Entity): entity is Companion {
  return entity instanceof Monster && typeof (entity as any).companionDefinitionId === 'string';
}

export class DeathResolver {
  public static resolveDeath(
    engine: GameEngine,
    killer: Entity | undefined,
    victim: Entity
  ): void {
    victim.hp = 0;

    if (killer && killer.isAlive()) {
      HookDispatcher.dispatch('onKill', {
        engine,
        attacker: killer,
        defender: victim,
        position: { x: victim.x, y: victim.y },
      });
    }

    if ((victim as any).onDestroyed) {
      (victim as any).onDestroyed(engine, killer);
    }

    // Companions & Pet Progression, Phase 2 (ARCHITECTURE.md P-14): a dying
    // companion skips the generic Monster death pipeline entirely (no XP award,
    // no loot/corpse, no compendium kill-tracking) and is kept — not discarded —
    // as `engine.deadCompanionRecord` so a trainer can revive it (heal + reattach
    // the same instance, pack contents intact) rather than replace it.
    if (isCompanion(victim)) {
      engine.log(`${victim.name} falls in battle and can no longer fight by your side!`);
      if (engine.companion === victim) {
        engine.companion = null;
      }
      engine.deadCompanionRecord = victim;
      engine.removeEntity(victim);
      return;
    }

    if (victim instanceof Monster) {
      const isPlayerKill =
        !killer || killer instanceof Player || killer.faction === 'player';

      if (isPlayerKill && engine.player.isAlive()) {
        const xpBase = victim.xpValue ?? 15;
        const rewards = engine.pacts?.getAggregatedRewards();
        const xp = Math.round(xpBase * (rewards?.xpMultiplier ?? 1.0));
        const levelUpRes = engine.player.gainXp(xp, engine.manifest?.progressionConfig);
        engine.log(`${victim.name} is slain! (+${xp} XP)`);

        if (levelUpRes.leveledUp) {
          engine.log(`*** LEVEL UP! Welcome to Level ${levelUpRes.newLevel}! ***`);
          const g = levelUpRes.statGains;
          if (g) {
            engine.log(
              `Vitality surge: +${g.maxHp ?? 5} Max HP, +${g.maxMana ?? 4} Max Mana${g.strength ? `, +${g.strength} Strength` : ''}, +${g.baseAttack ?? 1} Attack, +${g.baseDefense ?? 1} Defense!`
            );
          } else {
            engine.log('Vitality surge: +5 Max HP, +4 Max Mana, +1 Attack, +1 Defense!');
          }
          if (levelUpRes.statPointsAwarded && levelUpRes.statPointsAwarded > 0) {
            engine.log(`You have gained ${levelUpRes.statPointsAwarded} attribute point${levelUpRes.statPointsAwarded > 1 ? 's' : ''}! (${engine.player.unspentStatPoints} total unspent)`);
          }
          engine.emitGameEvent({
            type: 'player_leveled_up',
            player: engine.player,
            level: levelUpRes.newLevel,
            newLevel: levelUpRes.newLevel,
            statPointsAwarded: levelUpRes.statPointsAwarded ?? 3,
            unspentStatPoints: engine.player.unspentStatPoints,
            statGains: levelUpRes.statGains,
          });
        }
      } else {
        engine.log(`${victim.name} is slain!`);
      }

      // Record kill in Slayer's Compendium
      if (engine.compendium) {
        const killRes = engine.compendium.recordKill(victim.definitionId, victim.name);
        if (killRes.tierAdvanced) {
          if (killRes.tier === 2) {
            engine.log(`*** Slayer's Compendium: You uncovered the affinities and weaknesses of ${victim.name}! ***`);
          } else if (killRes.tier === 3) {
            engine.log(`*** MASTERED! You have mastered ${victim.name} (5+ kills)! (+1 ATK damage, +5% evasion unlocked) ***`);
          }
        }
      }

      // Record kill in game state manager
      const bossId = engine.manifest?.quest?.bossMonsterId ?? 'boss_hrungnir';
      const isBoss = victim.definitionId === bossId || victim.definitionId === 'boss_hrungnir';
      if (isBoss) {
        const bossDeathMsg = engine.manifest?.quest?.bossEntryMessage
          ? `*** ${victim.name.toUpperCase()} HAS FALLEN! ***`
          : `*** ${victim.name.toUpperCase()} HAS FALLEN! The mighty foe collapses! ***`;
        engine.log(bossDeathMsg);
        const relicMsg = engine.manifest?.quest?.relicDropMessage ?? 'The ancient relic glows brightly amidst the dust! Retrieve it and return to town!';
        engine.log(relicMsg);

        // Spawn victory portal at boss death coordinate
        engine.map.setTile(victim.x, victim.y, TILES.GATEWAY_VALHALLA);
        engine.log('*** A shimmering VICTORY PORTAL opens where the boss fell! Step through to claim victory! ***');

        engine.emitDiscovery({
          type: 'boss_slain',
          text: `${victim.name} has fallen in battle!`,
          icon: '⚔️',
        });
      } else if (victim.definitionId.includes('boss') || victim.definitionId.includes('champion') || victim.maxHp >= 100) {
        engine.emitDiscovery({
          type: 'boss_slain',
          text: `Defeated the formidable ${victim.name}!`,
          icon: '⚔️',
        });
      }

      // Generate loot drops on victim's position
      if (victim.lootTable && victim.lootTable.length > 0) {
        const rewards = engine.pacts?.getAggregatedRewards();
        const mf = rewards?.magicFindBonus ?? 0;
        const goldMult = rewards?.goldMultiplier ?? 1.0;
        let dropCount = 0;
        for (const rule of victim.lootTable) {
          const effectiveChance = Math.min(1.0, rule.chance + (rule.chance * mf));
          const roll = engine.rng();
          if (roll < effectiveChance) {
            const randSuffix = engine.prng.nextInt(1000, 9999).toString();
            const lootId = `drop-${engine ? engine.turnCount : Date.now()}-${randSuffix}`;
            const item = rule.generate(lootId, engine.rng);
            if (item.category === 'coin' && goldMult !== 1.0) {
              item.value = Math.round(item.value * goldMult);
            }
            engine.map.addItemAt(victim.x, victim.y, item);
            engine.log(`${victim.name} dropped ${item.displayName}!`);
            dropCount += 1;
          }
        }
      }

      // Drop any carried items in inventory onto the ground
      if (victim.inventory) {
        const carried = victim.getItems();
        for (const item of carried) {
          engine.map.addItemAt(victim.x, victim.y, item);
          engine.log(`${victim.name} dropped ${item.displayName}!`);
        }
      }

      // Drop organic corpse on monster defeat
      const corpse = new CorpseItemInstance({
        archetypeId: victim.definitionId ?? victim.name,
      });
      engine.map.addItemAt(victim.x, victim.y, corpse);
    } else if (victim instanceof Player) {
      DeathEnvelopeTracker.recordPlayerDeath(engine, killer);
      engine.gameState?.triggerDeath(engine, killer);
    }

    // Remove entity from map and scheduler
    engine.removeEntity(victim);

    if (victim instanceof Monster && engine.currentFloor >= 1) {
      // Exclude the companion: it's player-aligned, not a hostile the floor needs
      // cleared of. Without this, an alive companion permanently blocks floor-clear.
      const remainingLiving = engine.map.getAllEntities().filter(
        (e) => e instanceof Monster && e.isAlive() && !isCompanion(e)
      );
      if (remainingLiving.length === 0 && !engine.map.isCleared) {
        engine.map.isCleared = true;
        engine.map.lastRespawnTurn = engine.map.floorTurnCount;
        engine.log('The floor is clear of monsters... for now.');
      }
    }
  }
}
