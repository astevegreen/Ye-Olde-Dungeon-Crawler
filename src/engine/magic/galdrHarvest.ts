import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import type { ElementType } from './elements';
import type { StatusType } from '../status/types';
import { getSpell } from './spellRegistry';
import { getMonsterDefinition } from '../bestiary/monsterDefinitions';

export interface GaldrHarvestConfig {
  rewardSpellId: string;
  hintVerse: string;
  requiredDamageElement?: ElementType;
  requiredSurfaceOrTile?: string;
  requiredVictimStatus?: StatusType;
  requiresOverkillPercent?: number;
  requiresHolyGroundOrStatus?: boolean;
}

export interface GaldrHarvestContext {
  damageElement?: ElementType;
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
      const tileType = engine.map.getTile(victim.x, victim.y)?.type;
      const surfaceType = engine.surfaces?.getCell(victim.x, victim.y)?.surface?.type;
      const matchesTile = tileType === rule.requiredSurfaceOrTile;
      const matchesSurface = surfaceType === rule.requiredSurfaceOrTile;
      if (!matchesTile && !matchesSurface) {
        return { harvested: false };
      }
    }

    // 3. Status affliction criterion
    if (rule.requiredVictimStatus) {
      if (!victim.statusManager.hasStatus(rule.requiredVictimStatus)) {
        return { harvested: false };
      }
    }

    // 4. Overkill criterion
    if (rule.requiresOverkillPercent && context?.damageDealt && context?.remainingHpBeforeBlow) {
      const overkillThreshold = Math.ceil(context.remainingHpBeforeBlow * rule.requiresOverkillPercent);
      if (context.damageDealt < overkillThreshold) {
        return { harvested: false };
      }
    }

    // 5. Holy ground or status criterion
    if (rule.requiresHolyGroundOrStatus) {
      const tileType = engine.map.getTile(victim.x, victim.y)?.type;
      const isHolyStatus =
        victim.statusManager.hasStatus('blessed' as StatusType) ||
        victim.statusManager.hasStatus('holy' as StatusType);
      const isHolyTile = tileType === 'consecrated' || tileType === 'altar';
      if (!isHolyStatus && !isHolyTile) {
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
      engine.player.gainXp(25, engine.manifest?.progressionConfig);
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
