import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import type { GameEngine } from '../engine';
import { TILES } from '../grid/tile';
import { HookDispatcher } from '../hooks/hookDispatcher';
import { CorpseItemInstance } from '../items/corpse';
import { DeathEnvelopeTracker } from '../analytics/deathEnvelope';

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
              `Vitality surge: +${g.maxHp ?? 5} Max HP, +${g.maxMana ?? 4} Max Mana, +${g.strength ?? 1} Strength, +${g.baseAttack ?? 1} Attack, +${g.baseDefense ?? 1} Defense!`
            );
          } else {
            engine.log('Vitality surge: +5 Max HP, +4 Max Mana, +1 Strength, +1 Attack, +1 Defense!');
          }
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
          const roll = engine ? engine.rng() : Math.random();
          if (roll < effectiveChance) {
            const randSuffix = engine ? engine.prng.nextInt(1000, 9999).toString() : Math.random().toString(36).slice(2, 6);
            const lootId = `drop-${engine ? engine.turnCount : Date.now()}-${randSuffix}`;
            const item = rule.generate(lootId);
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
  }
}
