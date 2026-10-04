import { resolveManaTerms } from '../types/manifest';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { Actor } from '../entities/actor';
// Type-only: erased at compile time, so this does not create a runtime import edge.
// entities/companion.ts's `class Companion extends Monster` sits in a load-order
// cycle reachable from entities/monster.ts (which imports this very file) — a
// *value* import of Companion here would reintroduce that crash. `isCompanion()`
// below duck-types on `companionDefinitionId` instead, so this module never needs
// the runtime class at all.
import type { Companion } from '../entities/companion';
import type { GameEngine } from '../engine';
import { getTileDefinition } from '../grid/tile';
import { HookDispatcher } from '../hooks/hookDispatcher';
import { BASE_ACTION_COST } from '../types';
import { createMonsterTrophy } from '../compendium/trophies';
import { hasMasteryPerk, recordMasteryKill } from '../compendium/compendiumManager';
import { DeathEnvelopeTracker } from '../analytics/deathEnvelope';
import { KillRiteManager, type KillContext } from '../magic/killRites';
import { CoinItem } from '../economy/currency';
import type { Item } from '../items/item';
import { sumWorn } from '../items/wornModifiers';
import { refusesDeath } from './lastStand';
import { productAgainst } from '../compendium/familyPerks';

/** Pact and Plunderer gold multipliers: a coin pile's worth is its count. */
function applyGoldMultiplier(item: Item, goldMult: number): void {
  if (item instanceof CoinItem && goldMult !== 1.0) {
    item.setCount(Math.round(item.count * goldMult));
  }
}

/** Duck-typed check avoiding a value import of Companion (see import comment above). */
function isCompanion(entity: Entity): entity is Companion {
  return entity instanceof Monster && 'companionDefinitionId' in entity && typeof entity.companionDefinitionId === 'string';
}

export class DeathResolver {
  public static resolveDeath(
    engine: GameEngine,
    killer: Entity | undefined,
    victim: Entity,
    context?: KillContext
  ): void {
    // A last stand (Einherjar) or a companion's bond (Beast-Friend) may refuse this death.
    if (refusesDeath(engine, victim)) return;
    victim.hp = 0;

    if (killer && killer.isAlive()) {
      HookDispatcher.dispatch('onKill', {
        engine,
        attacker: killer,
        defender: victim,
        position: { x: victim.x, y: victim.y },
      });
    }

    if (victim instanceof Actor && victim.onDestroyed) {
      victim.onDestroyed(engine, killer);
    }

    // Companions & Pet Progression, Phase 2 (docs/architecture/content-companions.md): a dying
    // companion skips the generic Monster death pipeline entirely (no XP award,
    // no loot, no compendium kill-tracking) and is kept — not discarded —
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
        // The hero's family perk against the victim's family may pay more (Iron Will).
        const xp = Math.round(xpBase * (rewards?.xpMultiplier ?? 1.0) * productAgainst(engine, engine.player, victim, 'xpMultiplier'));
        engine.log(`${victim.name} is slain! (+${xp} ${engine.manifest?.branding?.xpName ?? 'XP'})`);
        awardPlayerXp(engine, xp);
      } else {
        engine.log(`${victim.name} is slain!`);
      }
      engine.emitGameEvent({
        type: 'entity_killed',
        turn: engine.turnCount,
        actorId: killer?.id,
        targetId: victim.id,
        data: { victimName: victim.name },
      });

      // Record kill in Slayer's Compendium (species and category mastery)
      recordMasteryKill(engine, victim.definitionId, victim.name);

      // Kill rites: a death that meets the victim's rite yields its magic
      KillRiteManager.evaluate(engine, killer, victim, context);

      // Bloodthirst and Blood-Drinker: each kill heals the killer a share of max HP;
      // Spell-Thief: a share of max mana.
      if (killer instanceof Actor && killer.isAlive()) {
        const share = sumWorn(killer, 'killHealPercent');
        if (share > 0) {
          const drawn = killer.heal(Math.round(killer.maxHp * share));
          if (drawn > 0) engine.log(`${killer.name} drinks the kill: +${drawn} HP.`);
        }
        const manaShare = sumWorn(killer, 'killManaPercent');
        if (manaShare > 0 && killer instanceof Player) {
          const restored = killer.restoreMana(Math.round(killer.maxMana * manaShare));
          if (restored > 0) engine.log(`${killer.name} steals the dying breath: +${restored} ${resolveManaTerms(engine.manifest).name}.`);
        }
      }

      // Slayer's Compendium Slay Perks (Essence Siphon & Trophy Hunter), from species or category mastery
      if (killer instanceof Player && victim instanceof Monster && engine.compendium) {
        // 1. Essence Siphon: Restores 10% Max HP, 10% Max Mana, and refunds 50% energy
        if (hasMasteryPerk(engine, victim.definitionId, 'essence_siphon')) {
          const hpGain = Math.max(2, Math.round(killer.maxHp * 0.10));
          const manaGain = Math.max(2, Math.round((killer.maxMana ?? 20) * 0.10));
          killer.heal(hpGain);
          if (typeof killer.mana === 'number' && typeof killer.maxMana === 'number') {
            killer.mana = Math.min(killer.maxMana, killer.mana + manaGain);
          }
          killer.gainEnergy(Math.round(BASE_ACTION_COST * 0.5));
          engine.recordVisualEffects([
            {
              type: 'screen_flash',
              color: '#38bdf8',
              durationMs: 150,
            },
          ]);
          engine.log(`*** ESSENCE SIPHON! You draw in ${victim.name}'s vitality (+${hpGain} HP, +${manaGain} ${resolveManaTerms(engine.manifest).name}, +Energy refund)! ***`);
        }

        // 2. Trophy Hunter: 35% chance to harvest rare anatomical trophy/reagent
        if (hasMasteryPerk(engine, victim.definitionId, 'trophy_hunter')) {
          if (engine.rng() < 0.35) {
            const trophy = createMonsterTrophy(victim, engine);
            engine.map.addItemAt(victim.x, victim.y, trophy);
            engine.log(`*** TROPHY HARVEST! You carefully salvage a ${trophy.name} from ${victim.name}! ***`);
          }
        }
      }

      // Record kill in game state manager
      const bossId = engine.manifest?.quest?.bossMonsterId;
      const isBoss = bossId ? victim.definitionId === bossId : false;
      if (isBoss) {
        const bossDeathMsg = engine.manifest?.quest?.bossEntryMessage
          ? `*** ${victim.name.toUpperCase()} HAS FALLEN! ***`
          : `*** ${victim.name.toUpperCase()} HAS FALLEN! The mighty foe collapses! ***`;
        engine.log(bossDeathMsg);
        const bossSlainFlag = engine.manifest?.quest?.bossSlainFlag;
        if (bossSlainFlag) engine.setWorldFlag(bossSlainFlag, true);
        const relicMsg = engine.manifest?.quest?.relicDropMessage;
        if (relicMsg) engine.log(relicMsg);

        // Spawn victory portal at boss death coordinate
        const victoryPortalTileId = engine.manifest?.quest?.victoryPortalTileId;
        if (victoryPortalTileId) {
          const portalDef = getTileDefinition(victoryPortalTileId);
          if (portalDef) {
            engine.map.setTile(victim.x, victim.y, portalDef);
            engine.log(
              engine.manifest?.quest?.victoryPortalMessage ??
                '*** A shimmering VICTORY PORTAL opens where the boss fell! Step through to claim victory! ***'
            );
          }
        }

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
        const isPlunderer = killer instanceof Player && hasMasteryPerk(engine, victim.definitionId, 'plunderer');
        const rewards = engine.pacts?.getAggregatedRewards();
        const mf = rewards?.magicFindBonus ?? 0;
        const goldMult = (rewards?.goldMultiplier ?? 1.0) * (isPlunderer ? 2.0 : 1.0) * (killer instanceof Player ? productAgainst(engine, killer, victim, 'coinMultiplier') : 1);
        let dropCount = 0;
        for (const rule of victim.lootTable) {
          const effectiveChance = Math.min(1.0, rule.chance + (rule.chance * mf));
          const roll = engine.rng();
          if (roll < effectiveChance) {
            const randSuffix = engine.prng.nextInt(1000, 9999).toString();
            const lootId = `drop-${engine.turnCount}-${randSuffix}`;
            const item = rule.generate(lootId, engine.rng, engine.currentFloor);
            if (!item) continue;
            applyGoldMultiplier(item, goldMult);
            engine.map.addItemAt(victim.x, victim.y, item);
            engine.log(`${victim.name} dropped ${item.displayName}!`);
            dropCount += 1;
          }
        }

        // Plunderer guarantee: if no loot dropped from table, guarantee an item drop
        if (isPlunderer && dropCount === 0) {
          const pickRule = victim.lootTable[engine.prng.nextInt(0, victim.lootTable.length - 1)];
          const randSuffix = engine.prng.nextInt(1000, 9999).toString();
          const lootId = `plunder-${engine.turnCount}-${randSuffix}`;
          const item = pickRule.generate(lootId, engine.rng, engine.currentFloor);
          if (item) {
            applyGoldMultiplier(item, goldMult);
            engine.map.addItemAt(victim.x, victim.y, item);
            engine.log(`*** PLUNDERER'S LUCK! You uncover hidden spoils: ${victim.name} dropped ${item.displayName}! ***`);
          }
        } else if (isPlunderer && dropCount > 0) {
          engine.log(`*** PLUNDERER'S BOUNTY! Gold and spoils from ${victim.name} were doubled! ***`);
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

/**
 * Grants the player XP and, on a level-up, logs it and emits `player_leveled_up` — the
 * event the level-up UI listens for. Every XP award that can level the player goes through here.
 */
export function awardPlayerXp(engine: GameEngine, xp: number): void {
  const levelUpRes = engine.player.gainXp(xp, engine.manifest?.progressionConfig);
  if (levelUpRes.leveledUp) {
    engine.log(`*** LEVEL UP! Welcome to Level ${levelUpRes.newLevel}! ***`);
    const mana = resolveManaTerms(engine.manifest).name;
    const g = levelUpRes.statGains ?? { maxHp: 5, maxMana: 4, baseAttack: 1, baseDefense: 1 };
    // Only what the pack's level actually gives: no "+0 Attack".
    const gains = [
      g.maxHp ? `+${g.maxHp} Max HP` : '',
      g.maxMana ? `+${g.maxMana} Max ${mana}` : '',
      g.strength ? `+${g.strength} Strength` : '',
      g.dexterity ? `+${g.dexterity} Dexterity` : '',
      g.constitution ? `+${g.constitution} Constitution` : '',
      g.intelligence ? `+${g.intelligence} Intelligence` : '',
      g.baseAttack ? `+${g.baseAttack} Attack` : '',
      g.baseDefense ? `+${g.baseDefense} Defense` : '',
    ].filter(Boolean);
    const restored = [
      levelUpRes.healed ? `${levelUpRes.healed} HP` : '',
      levelUpRes.manaRestored ? `${levelUpRes.manaRestored} ${mana}` : '',
    ].filter(Boolean);
    engine.log(`Vitality surge: ${gains.join(', ')}${restored.length ? `; you recover ${restored.join(' and ')}` : ''}!`);
    if (levelUpRes.statPointsAwarded && levelUpRes.statPointsAwarded > 0) {
      engine.log(`You have gained ${levelUpRes.statPointsAwarded} attribute point${levelUpRes.statPointsAwarded > 1 ? 's' : ''}! (${engine.player.unspentStatPoints} total unspent)`);
    }
    engine.emitGameEvent({
      type: 'player_leveled_up',
      turn: engine.turnCount,
      actorId: engine.player.id,
      level: levelUpRes.newLevel,
      newLevel: levelUpRes.newLevel,
      statPointsAwarded: levelUpRes.statPointsAwarded ?? 3,
      unspentStatPoints: engine.player.unspentStatPoints,
      statGains: levelUpRes.statGains,
    });
  }
}
