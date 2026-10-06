import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import type { ElementType } from './elements';
import type { StatusType } from '../status/types';
import { getSpell } from './spellRegistry';
import { getMonsterDefinition } from '../bestiary/monsterDefinitions';
import { createScaledItem } from '../dungeon/lootSpawner';
import { formatMagicMessage, type KillRiteConfig } from './magicConfig';

/**
 * A monster's kill rite: the way it must die to yield its magic. Every condition is
 * something the player's own killing blow or state controls (never the monster's
 * position), and all listed conditions must hold.
 */
export interface KillRiteDefinition {
  /** Cryptic hint shown in the bestiary before the rite is performed. */
  hintVerse: string;
  /** Spell taught the first time the rite is performed, if the player doesn't know it yet. */
  teachesSpellId?: string;
  /** Element of the essence yielded whenever the rite teaches no new spell. */
  essenceElement: string;
  requiredDamageElement?: ElementType;
  requiredVictimStatus?: StatusType;
  /** The killing blow's damage beyond the victim's remaining HP must reach this % of its max HP. */
  requiresOverkillPercent?: number;
  /** The player must be carrying overflow debt when the victim dies. */
  requiresCasterDebt?: boolean;
  /** The player's HP must be at or below this % of max when the victim dies. */
  maxCasterHpPercent?: number;
}

/** How the killing blow landed, as reported by whatever dealt it. */
export interface KillContext {
  damageElement?: ElementType;
  /** Full damage of the killing blow, before it was capped at the victim's remaining HP. */
  damageDealt?: number;
  remainingHpBeforeBlow?: number;
  /** What killed the victim when no creature did ("searing fire", "a pit trap"): the death screen's "Slain by …". */
  cause?: string;
}

export interface KillRiteResult {
  performed: boolean;
  taughtSpellId?: string;
  essenceItemId?: string;
  message?: string;
}

/** The pack's kill-rite config; without one, rites are off. */
export function getKillRiteConfig(engine: GameEngine): KillRiteConfig | undefined {
  return engine.manifest?.magic?.killRites;
}

/** True when every condition of `rite` holds for this death. */
export function killRiteConditionsMet(
  engine: GameEngine,
  rite: KillRiteDefinition,
  victim: Entity,
  context?: KillContext
): boolean {
  if (rite.requiredDamageElement && context?.damageElement !== rite.requiredDamageElement) return false;
  if (rite.requiredVictimStatus && !victim.statusManager.hasStatus(rite.requiredVictimStatus)) return false;

  // A kill with no reported blow (e.g. a surface or status) can't prove an overkill.
  if (rite.requiresOverkillPercent) {
    if (context?.damageDealt === undefined || context.remainingHpBeforeBlow === undefined) return false;
    const overkill = context.damageDealt - context.remainingHpBeforeBlow;
    if (overkill < Math.ceil(victim.maxHp * (rite.requiresOverkillPercent / 100))) return false;
  }

  const player = engine.player;
  if (rite.requiresCasterDebt && !(player.voidDebt > 0)) return false;
  if (rite.maxCasterHpPercent !== undefined && player.hp > player.maxHp * (rite.maxCasterHpPercent / 100)) {
    return false;
  }
  return true;
}

export class KillRiteManager {
  /**
   * Called for every death. When a player-side kill meets the victim's rite, teaches its
   * spell (first time) or drops an essence of its element at the victim's feet.
   */
  public static evaluate(engine: GameEngine, killer: Entity | undefined, victim: Entity, context?: KillContext): KillRiteResult {
    const config = getKillRiteConfig(engine);
    if (!config || !(victim instanceof Monster)) return { performed: false };

    const isPlayerKill = killer instanceof Player || killer?.faction === 'player';
    if (!isPlayerKill) return { performed: false };

    const rite = getMonsterDefinition(victim.definitionId)?.killRite;
    if (!rite || !killRiteConditionsMet(engine, rite, victim, context)) return { performed: false };

    engine.compendium?.recordKillRite(victim.definitionId);
    const player = engine.player;

    let result: KillRiteResult;
    if (rite.teachesSpellId && !player.spellsKnown.includes(rite.teachesSpellId)) {
      player.learnSpell(rite.teachesSpellId);
      const spell = engine.manifest?.spells?.find((s) => s.id === rite.teachesSpellId) ?? getSpell(rite.teachesSpellId);
      const message = formatMagicMessage(config.learnMessage, {
        monster: victim.name,
        spell: spell?.name ?? rite.teachesSpellId,
      });
      engine.recordVisualEffects([{ type: 'screen_flash', color: '#38bdf8', durationMs: 250 }]);
      result = { performed: true, taughtSpellId: rite.teachesSpellId, message };
    } else {
      const essence = dropEssence(engine, config, rite.essenceElement, victim);
      const message = essence
        ? formatMagicMessage(config.essenceMessage, { monster: victim.name, essence: essence.displayName })
        : undefined;
      result = { performed: true, essenceItemId: essence?.id, message };
    }

    if (result.message) engine.log(result.message);
    engine.emitGameEvent({
      type: 'kill_rite_performed',
      turn: engine.turnCount,
      actorId: killer?.id,
      targetId: victim.id,
      data: {
        monsterDefinitionId: victim.definitionId,
        taughtSpellId: result.taughtSpellId,
        essenceItemId: result.essenceItemId,
      },
    });
    return result;
  }
}

function dropEssence(engine: GameEngine, config: KillRiteConfig, element: string, victim: Entity) {
  const itemId = config.essenceItems[element];
  const def = itemId ? engine.manifest?.items?.find((i) => i.id === itemId) : undefined;
  if (!def) return undefined;
  const instanceId = `essence-${engine.turnCount}-${engine.prng.nextInt(1000, 9999)}`;
  const item = createScaledItem(def, instanceId, 1, engine.rng);
  engine.map.addItemAt(victim.x, victim.y, item);
  return item;
}
