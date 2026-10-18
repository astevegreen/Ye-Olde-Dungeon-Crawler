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
import { carriesShard, getLearningStoneConfig, grantEssenceRune, takeShortcut } from './learningStones';

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
  /** The victim must die in its sleep: struck down asleep, before it could act (`Monster.killedInItsSleep`). */
  requiresVictimAsleep?: boolean;
}

/** How the killing blow landed, as reported by whatever dealt it. */
export interface KillContext {
  /** The element the killing blow landed as. */
  damageElement?: ElementType;
  /** Every element the killing blow carried (a forged spell's): a rite asking for any of them is met. */
  damageElements?: ElementType[];
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
  const required = rite.requiredDamageElement;
  if (required && context?.damageElement !== required && !context?.damageElements?.includes(required)) return false;
  if (rite.requiredVictimStatus && !victim.statusManager.hasStatus(rite.requiredVictimStatus)) return false;
  if (rite.requiresVictimAsleep && !(victim instanceof Monster && victim.killedInItsSleep())) return false;

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
   * spell (first time) or drops an essence of its element at the victim's feet. Under
   * learning stones a rite teaches only as their shortcut: on a shard's carrier, it opens
   * the stone's card on the spot, and a kind's first gives an Essence-Rune of its element.
   */
  public static evaluate(engine: GameEngine, killer: Entity | undefined, victim: Entity, context?: KillContext): KillRiteResult {
    const config = getKillRiteConfig(engine);
    if (!config || !(victim instanceof Monster)) return { performed: false };

    // One of the hero's own falling is no kill of theirs (deathResolver's ally rule).
    const isPlayerKill = victim.faction !== 'player' && (killer instanceof Player || killer?.faction === 'player');
    if (!isPlayerKill) return { performed: false };

    const rite = getMonsterDefinition(victim.definitionId)?.killRite;
    if (!rite || !killRiteConditionsMet(engine, rite, victim, context)) return { performed: false };

    const stones = getLearningStoneConfig(engine);
    if (stones && !carriesShard(engine, victim)) return { performed: false };
    const firstOfKind = !engine.compendium?.isKillRitePerformed(victim.definitionId);
    engine.compendium?.recordKillRite(victim.definitionId);
    const player = engine.player;

    let result: KillRiteResult;
    if (stones) {
      const essence = firstOfKind ? grantEssenceRune(engine, rite.essenceElement) : undefined;
      const message = essence
        ? formatMagicMessage(config.essenceMessage, { monster: victim.name, essence: essence.displayName })
        : undefined;
      takeShortcut(engine, victim);
      result = { performed: true, essenceItemId: essence?.id, message };
    } else if (rite.teachesSpellId && !player.spellsKnown.includes(rite.teachesSpellId)) {
      const learned = player.learnSpellResult(rite.teachesSpellId);
      const spell = engine.manifest?.spells?.find((s) => s.id === rite.teachesSpellId) ?? getSpell(rite.teachesSpellId);
      const waiting = learned.outcome === 'full' ? ' Every slot in your grimoires is full: it waits in your spellbook until you make room.' : '';
      const message =
        formatMagicMessage(config.learnMessage, {
          monster: victim.name,
          spell: spell?.name ?? rite.teachesSpellId,
        }) + waiting;
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
  const chance = config.essenceDropChanceByElement?.[element] ?? config.essenceDropChance ?? 1;
  if (chance < 1 && engine.prng.next() >= chance) return undefined;
  const instanceId = `essence-${engine.turnCount}-${engine.prng.nextInt(1000, 9999)}`;
  const item = createScaledItem(def, instanceId, 1, engine.rng);
  engine.map.addItemAt(victim.x, victim.y, item);
  return item;
}
