import type { Action } from './action';
import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';
import type { Monster } from '../entities/monster';
import type { ChoiceDefinition, ChoiceConsequence } from '../types/choice';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import { setFlag, incrementCounter, modifyFaction } from '../state/worldState';
import { createScaledItem } from '../dungeon/lootSpawner';
import { Item } from '../items/item';

/**
 * Applies a list of `ChoiceConsequence`s to `player`/`engine`. Factored out of
 * `ExecuteChoiceAction` (ARCHITECTURE.md §3) so any other content-driven trigger with
 * the same "a list of scalar effects fires" shape — e.g. a timed world event's expiry
 * — can reuse the exact same, tested consequence semantics instead of a second
 * bespoke interpreter.
 */
export function applyConsequences(
  consequences: readonly ChoiceConsequence[],
  engine: GameEngine,
  player: Player
): void {
  for (const c of consequences) {
    switch (c.type) {
      case 'setFlag': {
        setFlag(engine.worldState, c.flag, c.value);
        break;
      }
      case 'modifyCounter': {
        incrementCounter(engine.worldState, c.counter, c.delta);
        break;
      }
      case 'modifyFaction': {
        modifyFaction(engine.worldState, c.faction, c.delta);
        break;
      }
      case 'grantItem': {
        const itemDef = engine.manifest?.items?.find((i) => i.id === c.itemId);
        let item: Item;
        const itemInstanceId = engine.nextSimulationId(c.itemId ?? 'choice');
        if (itemDef) {
          item = createScaledItem(itemDef, itemInstanceId, engine.currentFloor, engine.rng);
        } else {
          item = new Item({
            id: itemInstanceId,
            name: c.itemId.replace(/_/g, ' '),
            unidentifiedName: 'Mysterious Item',
            category: 'weapon',
            weight: 1000,
            bulk: 100,
            quality: 'normal',
            identified: true,
          });
        }

        if (c.toInventory !== false) {
          const canContain = player.inventory.primaryPack.canContain(item);
          if (canContain.allowed) {
            player.inventory.primaryPack.addItem(item);
            engine.log(`Received ${item.name} (stored in pack).`);
          } else {
            engine.map.addItemAt(player.x, player.y, item);
            engine.log(`Pack full! ${item.name} dropped at your feet.`);
          }
        } else {
          engine.map.addItemAt(player.x, player.y, item);
          engine.log(`${item.name} dropped at your feet.`);
        }
        break;
      }
      case 'applyBuff':
      case 'applyStatus': {
        player.statusManager.applyStatus({
          type: c.statusType,
          duration: c.duration,
          potency: c.potency,
        });
        break;
      }
      case 'damagePlayer': {
        player.takeDamage(c.amount);
        break;
      }
      case 'logMessage': {
        engine.log(c.message);
        break;
      }
      case 'alertMonsters': {
        const radius = c.radius ?? 8;
        const monsters = engine.map
          .getAllEntities()
          .filter((e) => e.type === 'monster') as Monster[];
        for (const m of monsters) {
          const dx = m.x - player.x;
          const dy = m.y - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            if (m.aiState === 'sleeping') {
              m.aiState = 'hunting';
            }
          }
        }
        break;
      }
      case 'modifyPermanentStat': {
        // Reads baseAttackValue/baseDefenseValue (the raw base), not the attack/
        // defense getter — that getter is the *computed* total through
        // calculateAttribute, already including equipment/pact bonuses. Reading it
        // back through the setter would bake the current gear's bonus into the
        // permanent base, double-counting it on every future equip/unequip.
        if (c.stat === 'attack') {
          player.attack = player.baseAttackValue + c.delta;
        } else {
          player.defense = player.baseDefenseValue + c.delta;
        }
        break;
      }
      case 'grantCompanion': {
        // Story-granted, so it bypasses the trainer-visit gate rather than requiring
        // it to have been cleared beforehand (GameEngine.summonCompanion). Uses the
        // literal 'companion_bonded' rather than GameEngine.COMPANION_BONDED_FLAG —
        // GameEngine is imported type-only here, so its static value isn't
        // accessible; keep the two in sync if either changes (same tradeoff as
        // TrainerService.bondCompanion in economy/services.ts).
        setFlag(engine.worldState, 'companion_bonded', true);
        engine.summonCompanion(c.companionId);
        break;
      }
    }
  }
}

export class ExecuteChoiceAction implements Action {
  constructor(
    public readonly player: Player,
    public readonly choice: ChoiceDefinition,
    public readonly optionId: string
  ) {}

  public perform(engine: GameEngine): ActionResult {
    const option = this.choice.options.find((opt) => opt.id === this.optionId);
    if (!option) {
      return {
        success: false,
        cost: 0,
        message: `Choice option "${this.optionId}" was not found.`,
      };
    }

    // Evaluate precondition if defined
    if (option.predicate && !evaluatePredicate(option.predicate, engine.worldState)) {
      const failMessage = option.disabledReason ?? `Requirements not met for "${option.label}".`;
      engine.log(failMessage);
      return {
        success: false,
        cost: 0,
        message: failMessage,
      };
    }

    applyConsequences(option.consequences, engine, this.player);

    return {
      success: true,
      cost: 0,
      message: `Choice resolved: ${option.label}`,
    };
  }
}
