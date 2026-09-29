import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import type { ElementType } from './elements';
import type { StatusType } from '../status/types';
import { getSpell } from './spellRegistry';
import { getMonsterDefinition } from '../bestiary/monsterDefinitions';
import { awardPlayerXp } from '../combat/deathResolver';

export interface GaldrHarvestConfig {
  rewardSpellId: string;
  hintVerse: string;
  requiredDamageElement?: ElementType;
  /** The victim must die on one of these tile types or surfaces (e.g. a pack's hallowed tiles). */
  requiredSurfaceOrTile?: string | string[];
  requiredVictimStatus?: StatusType;
  /** The killing blow's damage beyond the victim's remaining HP must reach this % of its max HP. */
  requiresOverkillPercent?: number;
}

/** How the killing blow landed, as reported by the spell pipeline. */
export interface GaldrHarvestContext {
  damageElement?: ElementType;
  /** Full damage of the killing blow, before it was capped at the victim's remaining HP. */
  damageDealt?: number;
  remainingHpBeforeBlow?: number;
}

export interface GaldrHarvestResult {
  harvested: boolean;
  rewardSpellId?: string;
  rewardSpellName?: string;
  isDuplicate?: boolean;
  message?: string;
}

export class GaldrHarvestManager {
  public static evaluateHarvest(
    engine: GameEngine,
    killer: Entity | undefined,
    victim: Entity,
    context?: GaldrHarvestContext
  ): GaldrHarvestResult {
    if (!(victim instanceof Monster)) {
      return { harvested: false };
    }

    const isPlayerKill =
      killer instanceof Player ||
      (killer && 'faction' in killer && killer.faction === 'player');

    if (!isPlayerKill) {
      return { harvested: false };
    }

    const def = getMonsterDefinition(victim.definitionId);
    const rule = def?.galdrHarvest;
    if (!rule) {
      return { harvested: false };
    }

    // 1. Element criterion
    if (rule.requiredDamageElement && context?.damageElement !== rule.requiredDamageElement) {
      return { harvested: false };
    }

    // 2. Surface / Tile criterion
    if (rule.requiredSurfaceOrTile) {
      const allowed = Array.isArray(rule.requiredSurfaceOrTile) ? rule.requiredSurfaceOrTile : [rule.requiredSurfaceOrTile];
      const tileType = engine.map.getTile(victim.x, victim.y)?.type;
      const surfaceType = engine.surfaces?.getCell(victim.x, victim.y)?.surface?.type;
      const matches = allowed.some((t) => t === tileType || t === surfaceType);
      if (!matches) {
        return { harvested: false };
      }
    }

    // 3. Status affliction criterion
    if (rule.requiredVictimStatus) {
      if (!victim.statusManager.hasStatus(rule.requiredVictimStatus)) {
        return { harvested: false };
      }
    }

    // 4. Overkill criterion (a kill with no reported blow, e.g. melee or a surface, can't prove it)
    if (rule.requiresOverkillPercent) {
      if (context?.damageDealt === undefined || context.remainingHpBeforeBlow === undefined) {
        return { harvested: false };
      }
      const overkill = context.damageDealt - context.remainingHpBeforeBlow;
      if (overkill < Math.ceil(victim.maxHp * (rule.requiresOverkillPercent / 100))) {
        return { harvested: false };
      }
    }

    // The rite is fulfilled!
    const spell = engine.manifest?.spells?.find((s) => s.id === rule.rewardSpellId) ?? getSpell(rule.rewardSpellId);
    const spellName = spell?.name ?? rule.rewardSpellId;

    if (engine.compendium) {
      engine.compendium.recordGaldrHarvest(victim.definitionId);
    }

    const isDuplicate = engine.player.spellsKnown.includes(rule.rewardSpellId);
    let message = '';

    if (isDuplicate) {
      message = `*** GALDR RESONANCE! ${victim.name}'s spirit echoes with familiar power (+25 Megin)! ***`;
    } else {
      engine.player.learnSpell(rule.rewardSpellId);
      message = `*** GALDR OF THE SLAIN! You sever ${victim.name}'s spirit thread and claim ${spellName}! ***`;
      engine.recordVisualEffects([
        {
          type: 'screen_flash',
          color: '#38bdf8',
          durationMs: 250,
        },
      ]);
    }

    engine.log(message);
    if (isDuplicate) {
      awardPlayerXp(engine, 25);
    }
    engine.emitGameEvent({
      type: 'galdr_harvested',
      turn: engine.turnCount,
      actorId: killer?.id,
      targetId: victim.id,
      data: {
        monsterDefinitionId: victim.definitionId,
        spellId: rule.rewardSpellId,
        spellName,
        isDuplicate,
      },
    });

    return {
      harvested: true,
      rewardSpellId: rule.rewardSpellId,
      rewardSpellName: spellName,
      isDuplicate,
      message,
    };
  }
}
