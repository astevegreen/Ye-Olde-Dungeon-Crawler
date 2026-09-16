import type { Action } from './action';
import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';
import type { Monster } from '../entities/monster';
import type { ChoiceDefinition } from '../types/choice';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import { setFlag, incrementCounter, modifyFaction } from '../state/worldState';
import { createScaledItem } from '../dungeon/lootSpawner';
import { Item } from '../items/item';

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

    // Execute consequences
    for (const c of option.consequences) {
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
          const timestamp = Date.now();
          if (itemDef) {
            item = createScaledItem(itemDef, `${c.itemId}-${timestamp}`, engine.currentFloor, engine.rng);
          } else {
            item = new Item({
              id: `${c.itemId}-${timestamp}`,
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
            const canContain = this.player.inventory.primaryPack.canContain(item);
            if (canContain.allowed) {
              this.player.inventory.primaryPack.addItem(item);
              engine.log(`Received ${item.name} (stored in pack).`);
            } else {
              engine.map.addItemAt(this.player.x, this.player.y, item);
              engine.log(`Pack full! ${item.name} dropped at your feet.`);
            }
          } else {
            engine.map.addItemAt(this.player.x, this.player.y, item);
            engine.log(`${item.name} dropped at your feet.`);
          }
          break;
        }
        case 'applyBuff':
        case 'applyStatus': {
          this.player.statusManager.applyStatus({
            type: c.statusType,
            duration: c.duration,
            potency: c.potency,
          });
          break;
        }
        case 'damagePlayer': {
          this.player.takeDamage(c.amount);
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
            const dx = m.x - this.player.x;
            const dy = m.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
              if (m.aiState === 'sleeping') {
                m.aiState = 'hunting';
              }
            }
          }
          break;
        }
      }
    }

    return {
      success: true,
      cost: 0,
      message: `Choice resolved: ${option.label}`,
    };
  }
}
