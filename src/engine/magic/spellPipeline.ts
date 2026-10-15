import type { ActionResult, Position, VisualEffectDescriptor } from '../types';
import { lowestWorn, sumWorn } from '../items/wornModifiers';
import { spendOncePerFloor } from '../combat/lastStand';
import { productAgainst, shrugsAffliction } from '../compendium/familyPerks';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import type {
  SpellDefinition,
  EffectPrimitive,
  DamageEffect,
  StatusEffectPrimitive,
  ChainEffect,
  TeleportEffect,
  PushEffect,
  PullEffect,
  SwapEffect,
  HealEffect,
  RevealEffect,
  IdentifyEffect,
  UncurseEffect,
  CleanseEffect,
  HandOverEffect,
  SummonEffect,
  LearnSpellEffect,
  TargetingMode,
} from './types';
import { getAreaOfEffectTiles } from './targeting';
import { DeathResolver } from '../combat/deathResolver';
import type { StatusType } from '../status/types';
import { findSafeSpawnPosition } from '../spatial/collisionSolver';
import { EffectPrimitiveRegistry, type EffectContext } from './effectRegistry';
import { scaleSpellDamage, scaleSpellHeal } from './castNumbers';
import { castGeometry } from './castTrace';
import type { LendDelivery } from './neighbourLending';
import { EnergyModel } from '../actors/energyModel';
import { dispatchDamageHooks } from '../hooks/damageHooks';
import { Actor } from '../entities/actor';
import { breakCurses } from '../items/breakCurses';
import { applyImpulse } from '../combat/impulse';
import { hasLineOfSight } from '../ai/perception';
import { leastResistedElement } from './elements';
import { StatusHandlerRegistry } from '../status/statusHandlers';

function getElementDefaultColor(element?: string): string {
  switch (element) {
    case 'fire':
      return '#f97316';
    case 'cold':
    case 'ice':
      return '#38bdf8';
    case 'lightning':
      return '#facc15';
    case 'healing':
      return '#4ade80';
    case 'arcane':
    default:
      return '#818cf8';
  }
}

/** The drawn art a spell's effects play: its own (`visual.fx`), else its element's. */
function spellFxOf(spell: SpellDefinition): string | undefined {
  return spell.visual?.fx ?? spell.element;
}

/**
 * Spell damage after the hero's ward (Warding Glyph, `firstSpellPerFloorMultiplier`): the
 * first spell another caster lands on the hero each floor visit is scaled.
 */
function wardFirstSpell(engine: GameEngine, caster: Entity, target: Entity, damage: number): number {
  if (target !== engine.player || caster === target || damage <= 0) return damage;
  const ward = lowestWorn(target, 'firstSpellPerFloorMultiplier');
  if (ward === undefined || !spendOncePerFloor(engine, 'spell_ward')) return damage;
  engine.log(`A glyph flares on ${target.name}'s skin and takes the edge off the spell!`);
  return Math.max(1, Math.round(damage * ward));
}

/** What killed a caster caught in its own spell, for the death screen: "their own Fireball". */
function ownSpellCause(caster: Entity, target: Entity, spell: SpellDefinition): string | undefined {
  return caster === target ? `their own ${spell.name}` : undefined;
}

/** Spell damage scaled by the target's family perk against the caster's family (Grave-Warden). */
/** The element a damage effect's hit lands as on `target`: its own, or of several the one least resisted. */
function strikeElement(engine: GameEngine, target: Entity, effect: Pick<DamageEffect, 'element' | 'elements' | 'pierce'>): string {
  if (!effect.elements?.length) return effect.element;
  return leastResistedElement(engine.affinityMatrix, (e) => target.affinityTo(e), [effect.element, ...effect.elements], effect.pierce);
}

/** Every element a damage effect carries, for kill rites, or nothing when it has only its own. */
function carriedElements(effect: Pick<DamageEffect, 'element' | 'elements'>): string[] | undefined {
  return effect.elements?.length ? [effect.element, ...effect.elements] : undefined;
}

/** The afflictions (`StatusHandler.affliction`) an entity bears, longest-lasting first. */
function afflictionsOf(entity: Entity): StatusType[] {
  return entity.statusManager
    .getAll()
    .filter((s) => StatusHandlerRegistry.get(s.type)?.affliction)
    .sort((a, b) => b.duration - a.duration)
    .map((s) => s.type);
}

function scaleByTargetFamily(engine: GameEngine, caster: Entity, target: Entity, damage: number): number {
  const taken = productAgainst(engine, target, caster, 'damageTakenMultiplier');
  return taken === 1 ? damage : Math.max(1, Math.round(damage * taken));
}

export function parseAndRollDice(amount: string | number, rng: () => number): number {
  if (typeof amount === 'number') return Math.max(0, Math.floor(amount));
  const str = amount.trim();
  const diceMatch = str.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (diceMatch) {
    const count = parseInt(diceMatch[1], 10);
    const sides = parseInt(diceMatch[2], 10);
    const sign = diceMatch[3] === '-' ? -1 : 1;
    const mod = diceMatch[4] ? parseInt(diceMatch[4], 10) * sign : 0;
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const roll = rng();
      sum += Math.floor(roll * sides) + 1;
    }
    return Math.max(1, sum + mod);
  }
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/** A rolled amount times the cast's power (slot stats and borrowing), never below 1 while it rolled any. */
function scaleByPower(rolled: number, multiplier: number): number {
  return multiplier === 1 || rolled <= 0 ? rolled : Math.max(1, Math.round(rolled * multiplier));
}

/** What borrowing hands a cast to deliver, and where its spell type delivers it. */
export interface CastLends {
  delivery: LendDelivery;
  effects: EffectPrimitive[];
}

/** How a hero's grimoire shapes one cast beyond its definition (P-30): own power, and what it borrowed. */
export interface CastShaping {
  powerMultiplier?: number;
  lends?: CastLends;
}

export class SpellPipeline {
  public static registerBuiltinEffects(): void {
    EffectPrimitiveRegistry.register<DamageEffect>('damage', (effect, ctx) => {
      ctx.lastDamageEffect = effect;
      for (const target of ctx.targets) {
        SpellPipeline.applyDamageEffect(ctx.engine, ctx.spell, ctx.caster, target, effect, ctx.powerMultiplier);
      }
    });

    EffectPrimitiveRegistry.register<StatusEffectPrimitive>('applyStatus', (effect, ctx) => {
      for (const target of ctx.targets) {
        SpellPipeline.applyStatusEffect(ctx.engine, ctx.caster, target, effect);
      }
    });

    EffectPrimitiveRegistry.register<HealEffect>('heal', (effect, ctx) => {
      if (effect.target === 'caster') {
        SpellPipeline.applyHealEffect(ctx.engine, ctx.caster, ctx.caster, effect, ctx.powerMultiplier);
      } else {
        for (const target of ctx.targets) {
          SpellPipeline.applyHealEffect(ctx.engine, ctx.caster, target, effect, ctx.powerMultiplier);
        }
      }
    });

    EffectPrimitiveRegistry.register<TeleportEffect>('teleport', (effect, ctx) => {
      if (effect.aimed) {
        SpellPipeline.teleportToAim(ctx.engine, ctx.caster, ctx.aim, effect.range);
        return;
      }
      for (const target of ctx.targets) {
        SpellPipeline.teleportEntity(ctx.engine, target, effect.range, effect.random);
      }
    });

    EffectPrimitiveRegistry.register<PushEffect>('push', (effect, ctx) => {
      // The farthest first, so a near foe isn't slammed into one about to be thrown clear.
      for (const target of SpellPipeline.othersByDistance(ctx).reverse()) {
        const { dx, dy } = SpellPipeline.offset(ctx.caster, target);
        applyImpulse(ctx.engine, ctx.caster, target, Math.sign(dx), Math.sign(dy), effect.distance);
      }
    });

    EffectPrimitiveRegistry.register<PullEffect>('pull', (effect, ctx) => {
      for (const target of SpellPipeline.othersByDistance(ctx)) {
        SpellPipeline.pullToward(ctx.engine, ctx.caster, target, effect.distance);
      }
    });

    EffectPrimitiveRegistry.register<SwapEffect>('swap', (_effect, ctx) => {
      const target = ctx.targets.find((t) => t !== ctx.caster && t.isAlive());
      if (target) SpellPipeline.swapPlaces(ctx.engine, ctx.caster, target);
    });

    EffectPrimitiveRegistry.register<RevealEffect>('reveal', (effect, ctx) => {
      SpellPipeline.executeRevealEffect(ctx.engine, ctx.caster, effect);
    });

    EffectPrimitiveRegistry.register<IdentifyEffect>('identify', (_effect, ctx) => {
      SpellPipeline.executeInventorySpell(ctx.engine, ctx.spell, ctx.caster, undefined, 100);
    });

    EffectPrimitiveRegistry.register<UncurseEffect>('uncurse', (_effect, ctx) => {
      breakCurses(ctx.engine, ctx.caster);
    });

    EffectPrimitiveRegistry.register<CleanseEffect>('cleanse', (effect, ctx) => {
      const targets = effect.target === 'caster' ? [ctx.caster] : ctx.targets;
      for (const target of targets) SpellPipeline.cleanse(ctx.engine, target, effect.all ?? false);
    });

    EffectPrimitiveRegistry.register<HandOverEffect>('handOver', (_effect, ctx) => {
      for (const target of ctx.targets) SpellPipeline.handOver(ctx.engine, ctx.caster, target);
    });

    EffectPrimitiveRegistry.register<ChainEffect>('chain', (effect, ctx) => {
      SpellPipeline.executeChainEffect(
        ctx.engine,
        ctx.spell,
        ctx.caster,
        ctx.targets,
        effect,
        ctx.lastDamageEffect as DamageEffect | undefined,
        ctx.effects,
        ctx.powerMultiplier
      );
    });

    EffectPrimitiveRegistry.register<SummonEffect>('summon', (effect, ctx) => {
      SpellPipeline.executeSummonEffect(ctx.engine, ctx.caster, effect);
    });

    EffectPrimitiveRegistry.register<LearnSpellEffect>('learn_spell', (effect, ctx) => {
      if (!(ctx.caster instanceof Player)) return;
      const spell = ctx.engine.manifest?.spells?.find((s) => s.id === effect.spellId);
      const name = spell?.name ?? effect.spellId;
      const outcome = ctx.caster.learnSpellResult(effect.spellId).outcome;
      if (outcome === 'learned') {
        ctx.engine.log(`You have learned ${name}!`);
      } else if (outcome === 'full') {
        ctx.engine.log(`Every slot in your grimoires is full. ${name} waits in your spellbook until you make room.`);
      } else {
        ctx.engine.log(`You already know ${name}; the runes teach you nothing new.`);
      }
    });
  }

  public static ensureBuiltinEffects(): void {
    if (!EffectPrimitiveRegistry.has('damage')) {
      SpellPipeline.registerBuiltinEffects();
    }
  }

  public static executeSpell(
    engine: GameEngine,
    spell: SpellDefinition,
    caster: Entity,
    targetPos: Position,
    itemTargetId?: string,
    actionCost = 100,
    shaping: CastShaping = {}
  ): ActionResult {
    const mode: TargetingMode = spell.targetingMode ?? (spell.targetType as TargetingMode);

    if (mode === 'inventory_item') {
      return this.executeInventorySpell(engine, spell, caster, itemTargetId, actionCost);
    }

    if (mode === 'self') {
      return this.executeSelfSpell(engine, spell, caster, actionCost, shaping);
    }

    // Targeted / Ray / Area / Burst spells
    return this.executeTargetedSpell(engine, spell, caster, targetPos, mode, actionCost, shaping);
  }

  /**
   * What a cast borrowed from its neighbours (P-30), where its spell type delivers it: on what
   * it hit, its held target or the ground it laid; on the foes beside the caster (a heal); or
   * on those beside the tile it left (a movement). A summon's hits wait for allies that fight (P-31).
   */
  private static deliverLends(ctx: EffectContext, lends: CastLends, hit: Entity[], departure: Position): void {
    const { engine, caster } = ctx;
    const foesBeside = (p: Position) =>
      engine.map
        .getAllEntities()
        .filter((e) => e !== caster && e.isAlive() && e.isHostileTo(caster) && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) === 1);
    let targets: Entity[];
    switch (lends.delivery) {
      case 'adjacentFoes':
        targets = foesBeside(caster);
        break;
      case 'departure':
        targets = foesBeside(departure);
        break;
      case 'summonHits':
        return;
      default:
        targets = hit.filter((t) => t !== caster && t.isAlive());
    }
    const lent: EffectContext = { ...ctx, targets };
    for (const effect of lends.effects) EffectPrimitiveRegistry.dispatch(effect, lent);
  }

  private static executeInventorySpell(
    engine: GameEngine,
    _spell: SpellDefinition | undefined,
    caster: Entity,
    itemTargetId: string | undefined,
    actionCost: number
  ): ActionResult {
    if (!(caster instanceof Player)) {
      return { success: false, cost: 0, message: 'Only players can manipulate inventory items.' };
    }

    const player = caster;
    let targetItem = itemTargetId
      ? player.inventory.findItemById(itemTargetId)
      : player.inventory.primaryPack.getItems().find((i) => !i.identified) ??
        player.inventory.paperdoll.getAllEquipped().map((e) => e.item).find((i) => !i.identified);

    if (!targetItem) {
      const msg = 'You have no unidentified items to decipher.';
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    targetItem.identified = true;
    const msg = `Runic revelation: The item is identified as ${targetItem.displayName}!`;
    engine.log(msg);
    return { success: true, cost: actionCost, message: msg };
  }

  private static executeSelfSpell(
    engine: GameEngine,
    spell: SpellDefinition,
    caster: Entity,
    actionCost: number,
    shaping: CastShaping
  ): ActionResult {
    const effects: VisualEffectDescriptor[] = [];
    const color = spell.visual?.color ?? getElementDefaultColor(spell.element);
    const fx = spellFxOf(spell);
    const startPos = { x: caster.x, y: caster.y };

    if (spell.effects.length > 0) {
      SpellPipeline.ensureBuiltinEffects();
      const ctx: EffectContext = {
        engine,
        spell,
        caster,
        targets: [caster],
        effects,
        color,
        powerMultiplier: shaping.powerMultiplier,
      };

      for (const effect of spell.effects) {
        if (effect.type === 'damage') {
          ctx.lastDamageEffect = effect;
        }
        EffectPrimitiveRegistry.dispatch(effect, ctx);
      }
      if (shaping.lends) SpellPipeline.deliverLends(ctx, shaping.lends, [], startPos);

      if (spell.effects.some((e) => e.type === 'heal')) {
        effects.push({
          type: 'burst',
          epicenter: { x: caster.x, y: caster.y },
          radius: 1,
          color,
          fx,
          durationMs: spell.visual?.durationMs ?? 200,
          style: 'aura',
        });
      } else if (spell.effects.some((e) => e.type === 'teleport')) {
        effects.push({
          type: 'burst',
          epicenter: startPos,
          radius: 1,
          color,
          fx,
          durationMs: 150,
          style: 'shockwave',
        });
        effects.push({
          type: 'burst',
          epicenter: { x: caster.x, y: caster.y },
          radius: 1,
          color,
          fx,
          durationMs: 150,
          style: 'aura',
        });
      } else if (spell.effects.some((e) => e.type === 'reveal')) {
        effects.push({
          type: 'screen_flash',
          color,
          durationMs: spell.visual?.durationMs ?? 180,
        });
      } else {
        effects.push({
          type: 'burst',
          epicenter: { x: caster.x, y: caster.y },
          radius: 1,
          color,
          fx,
          durationMs: spell.visual?.durationMs ?? 180,
          style: 'aura',
        });
      }
      return {
        success: true,
        cost: actionCost,
        message: `${caster.name} casts ${spell.name}.`,
        effects,
      };
    }

    return { success: true, cost: actionCost, message: `${caster.name} casts ${spell.name}.`, effects };
  }

  private static executeTargetedSpell(
    engine: GameEngine,
    spell: SpellDefinition,
    caster: Entity,
    targetPos: Position,
    mode: TargetingMode,
    actionCost: number,
    shaping: CastShaping
  ): ActionResult {
    const startPos = { x: caster.x, y: caster.y };
    // Its flight and burst, as the aim preview draws them (`castGeometry`).
    const geo = castGeometry(engine, spell, caster, targetPos);
    const reflects = geo.reflects;
    const targetsHit: Entity[] = [];
    let impactTile = { x: targetPos.x, y: targetPos.y };
    let hitDescription = '';
    const effects: VisualEffectDescriptor[] = [];
    const color = spell.visual?.color ?? getElementDefaultColor(spell.element);
    const fx = spellFxOf(spell);

    if ((mode === 'ray' || mode === 'bounce_ray') && geo.ray) {
      const rayResult = geo.ray;
      impactTile = rayResult.impactTile;

      if (rayResult.path.length > 0) {
        effects.push({
          type: 'projectile',
          path: rayResult.path.map((p) => ({ x: p.x, y: p.y, isReflection: p.isReflection })),
          origin: { x: caster.x, y: caster.y },
          color,
          fx,
          spriteId: spell.visual?.spriteId,
          stepDelayMs: spell.visual?.stepDelayMs ?? (reflects ? 20 : 25),
          travelMode: spell.visual?.travelMode ?? (reflects ? 'stepped' : 'smooth'),
        });
      }

      if (geo.burst) {
        const blastRadius = geo.burst.radius;
        effects.push({
          type: 'burst',
          epicenter: { x: impactTile.x, y: impactTile.y },
          radius: blastRadius,
          color,
          fx,
          durationMs: spell.visual?.durationMs ?? 250,
          style: spell.element === 'fire' ? 'flame' : spell.element === 'lightning' ? 'spark' : 'shockwave',
        });
        const blastTiles = getAreaOfEffectTiles(
          engine.map,
          impactTile.x,
          impactTile.y,
          blastRadius
        );
        for (const tile of blastTiles) {
          const ent = engine.map.getEntityAt(tile.x, tile.y);
          if (ent && ent.isAlive()) {
            targetsHit.push(ent);
          }
        }
        hitDescription = `${caster.name} casts ${spell.name}! An explosive blast erupts at (${impactTile.x}, ${impactTile.y}) catching ${targetsHit.length} target(s)!`;
        engine.log(hitDescription);
      } else if (rayResult.hitEntityId) {
        const hitEnt = engine.map.getEntityById(rayResult.hitEntityId);
        if (hitEnt && hitEnt.isAlive()) {
          targetsHit.push(hitEnt);
          if (rayResult.reflectionsCount > 0) {
            engine.log(`${caster.name}'s ${spell.name} ricochets after ${rayResult.reflectionsCount} wall bounce(s)!`);
          }
          hitDescription = `${caster.name} casts ${spell.name} at ${hitEnt.name}.`;
        }
      } else {
        const bounceNote = rayResult.reflectionsCount > 0 ? ` after ${rayResult.reflectionsCount} bounce(s)` : '';
        hitDescription = rayResult.hitWall
          ? `${caster.name} casts ${spell.name}, impacting a wall at (${impactTile.x}, ${impactTile.y})${bounceNote}.`
          : `${caster.name} casts ${spell.name}, but it strikes nothing and fades at (${impactTile.x}, ${impactTile.y})${bounceNote}.`;
        engine.log(hitDescription);
      }

      // Check water shock
      if (spell.element === 'lightning') {
        this.checkAndPropagateWaterShock(engine, spell, rayResult.path, rayResult.hitEntityId);
      }
    } else if (geo.burst) {
      // A thrown burst flies to the tile aimed at and bursts where it stops.
      const burstOrigin = geo.burst.epicenter;
      if (geo.ray) {
        effects.push({
          type: 'projectile',
          path: geo.ray.path.map((p) => ({ x: p.x, y: p.y, isReflection: p.isReflection })),
          origin: { x: caster.x, y: caster.y },
          color,
          fx,
          spriteId: spell.visual?.spriteId,
          stepDelayMs: spell.visual?.stepDelayMs ?? 25,
          travelMode: spell.visual?.travelMode ?? 'smooth',
        });
      }

      const radius = geo.burst.radius;
      effects.push({
        type: 'burst',
        epicenter: { x: burstOrigin.x, y: burstOrigin.y },
        radius,
        color,
        fx,
        durationMs: spell.visual?.durationMs ?? 250,
        style: spell.element === 'fire' ? 'flame' : spell.element === 'lightning' ? 'spark' : 'shockwave',
      });
      const blastTiles = getAreaOfEffectTiles(engine.map, burstOrigin.x, burstOrigin.y, radius);
      for (const tile of blastTiles) {
        const ent = engine.map.getEntityAt(tile.x, tile.y);
        if (ent && ent.isAlive()) {
          targetsHit.push(ent);
        }
      }
      hitDescription = `${caster.name} casts ${spell.name}! An explosive blast erupts at (${burstOrigin.x}, ${burstOrigin.y}) catching ${targetsHit.length} target(s)!`;
      engine.log(hitDescription);
    } else {
      // Direct entity or single tile target
      const ent = engine.map.getEntityAt(targetPos.x, targetPos.y);
      if (ent && ent.isAlive()) {
        targetsHit.push(ent);
        hitDescription = `${caster.name} casts ${spell.name} at ${ent.name}.`;
      } else {
        hitDescription = `${caster.name} casts ${spell.name} at (${targetPos.x}, ${targetPos.y}).`;
        engine.log(hitDescription);
      }
    }

    // The spell's effect primitives, in order, on everything it reached.
    SpellPipeline.ensureBuiltinEffects();
    const ctx: EffectContext = {
      engine,
      spell,
      caster,
      targets: targetsHit,
      aim: { x: targetPos.x, y: targetPos.y },
      effects,
      color,
      powerMultiplier: shaping.powerMultiplier,
    };
    for (const effect of spell.effects) {
      if (effect.type === 'damage') {
        ctx.lastDamageEffect = effect;
      }
      EffectPrimitiveRegistry.dispatch(effect, ctx);
    }
    if (shaping.lends) SpellPipeline.deliverLends(ctx, shaping.lends, targetsHit, startPos);

    return { success: true, cost: actionCost, message: hitDescription || `${caster.name} casts ${spell.name}.`, effects };
  }

  public static applyEffectToTarget(
    engine: GameEngine,
    spell: SpellDefinition,
    caster: Entity,
    target: Entity,
    effect: EffectPrimitive
  ): void {
    SpellPipeline.ensureBuiltinEffects();
    const ctx: EffectContext = {
      engine,
      spell,
      caster,
      targets: [target],
      effects: [],
      color: spell.visual?.color ?? getElementDefaultColor(spell.element),
    };
    if (effect.type === 'damage') {
      ctx.lastDamageEffect = effect;
    }
    EffectPrimitiveRegistry.dispatch(effect, ctx);
  }

  public static applyDamageEffect(
    engine: GameEngine,
    spell: SpellDefinition,
    caster: Entity,
    target: Entity,
    effect: DamageEffect,
    powerMultiplier = 1
  ): void {
    if (!target.isAlive()) return;
    const rolled = scaleByPower(parseAndRollDice(effect.amount, engine.rng), powerMultiplier);
    if (rolled <= 0) return;
    const element = strikeElement(engine, target, effect);
    let rawDamage = scaleSpellDamage(engine, caster, element, rolled);
    rawDamage = scaleByTargetFamily(engine, caster, target, rawDamage);
    rawDamage = wardFirstSpell(engine, caster, target, rawDamage);
    const terrain = engine.map.getTile(target.x, target.y)?.type;
    const result = target.takeElementalDamage(rawDamage, element, engine.affinityMatrix, terrain, { pierce: effect.pierce });

    if (result.affinity === 'absorbing') {
      engine.log(`${target.name} absorbs the ${element} energy, healing ${result.healed} HP!`);
      return;
    }

    if (result.affinity === 'immune') {
      engine.log(`${target.name} is completely unharmed by the ${element}!`);
      return;
    }

    let detail = '';
    if (result.affinity === 'weak') {
      detail = ' (Vulnerable! 150% damage)';
    } else if (result.affinity === 'resistant') {
      detail = ' (Resistant! 50% damage)';
    }

    if (spell.areaOfEffect > 0) {
      engine.log(`${target.name} takes ${result.damageDealt} ${element} damage${detail}!`);
    } else {
      engine.log(`${caster.name}'s ${spell.name} strikes ${target.name} for ${result.damageDealt} ${element} damage${detail}!`);
    }

    dispatchDamageHooks(engine, caster, target, result.damageDealt);

    if (result.killed) {
      DeathResolver.resolveDeath(engine, caster, target, {
        damageElement: element,
        damageElements: carriedElements(effect),
        damageDealt: result.finalDamage,
        remainingHpBeforeBlow: result.damageDealt,
        cause: ownSpellCause(caster, target, spell),
      });
    }

    if (engine.surfaces) {
      engine.surfaces.triggerElementalReaction(target.x, target.y, element, result.damageDealt, engine);
    }
  }

  /** Lifts `target`'s longest-lasting affliction, or with `all` every one. */
  public static cleanse(engine: GameEngine, target: Entity, all: boolean): void {
    if (!target.isAlive()) return;
    const lifted = afflictionsOf(target).slice(0, all ? undefined : 1);
    for (const type of lifted) target.statusManager.removeStatus(type);
    engine.log(lifted.length > 0 ? `${target.name} is cleansed of ${lifted.join(', ')}.` : `${target.name} has nothing to cleanse.`);
  }

  /** Moves the caster's afflictions to `target`; one it is immune to stays with the caster. */
  public static handOver(engine: GameEngine, caster: Entity, target: Entity): void {
    if (!target.isAlive() || target.id === caster.id) return;
    const afflictions = afflictionsOf(caster);
    if (afflictions.length === 0) return;
    const moved = caster.statusManager.transferTo(afflictions, target, caster.id, engine);
    engine.log(
      moved.length > 0
        ? `${caster.name} hands ${moved.join(', ')} over to ${target.name}!`
        : `${target.name} will not take what ${caster.name} bears.`
    );
  }

  public static applyStatusEffect(
    engine: GameEngine,
    caster: Entity,
    target: Entity,
    effect: StatusEffectPrimitive
  ): void {
    if (!target.isAlive()) return;
    // The target's family perk against the caster's family may shrug it off (Spirit-Ward).
    if (shrugsAffliction(engine, target, caster, effect.statusId)) return;
    const { applied, message } = target.statusManager.applyStatusDetailed(
      {
        type: effect.statusId as StatusType,
        duration: effect.duration,
        potency: effect.potency,
        sourceEntityId: caster.id,
      },
      target.statusImmunities,
      target,
      engine
    );
    if (applied) {
      // The status's own handler may already have said it took hold ("X is wreathed in holy fire!").
      if (!message) engine.log(`${target.name} is afflicted with ${effect.statusId}!`);
    } else {
      engine.log(`${target.name} resists the affliction!`);
    }
  }

  public static applyHealEffect(
    engine: GameEngine,
    _caster: Entity,
    target: Entity,
    effect: HealEffect,
    powerMultiplier = 1
  ): void {
    if (!target.isAlive()) return;
    let amount = scaleSpellHeal(engine, _caster, scaleByPower(parseAndRollDice(effect.amount, engine.rng), powerMultiplier));
    if (target instanceof Actor) {
      const eff = EnergyModel.calculateHealingEfficiency(target);
      if (eff < 1.0) {
        amount = Math.max(1, Math.floor(amount * eff));
      }
    }
    const healed = target.heal(amount);
    engine.log(`${target.name} is healed for ${healed} HP! (HP: ${target.hp}/${target.maxHp})`);
  }

  /**
   * Executes a SummonEffect: spawns a monster near the caster from the manifest
   * bestiary. If `friendly` is true the summoned entity's faction is set to
   * 'player', so it runs the ally routine (MonsterAI.decideAction). Duration > 0
   * applies the `summoned` status, which sends it back when it runs out.
   */
  public static executeSummonEffect(
    engine: GameEngine,
    caster: Entity,
    effect: SummonEffect
  ): void {
    const range = effect.range ?? 2;
    const monsterId = effect.monsterId;

    // Find a passable, unoccupied tile within range of the caster
    const candidates: Array<{ x: number; y: number }> = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = caster.x + dx;
        const ty = caster.y + dy;
        if (
          engine.map.inBounds(tx, ty) &&
          engine.map.isPassable(tx, ty) &&
          !engine.map.getEntityAt(tx, ty)
        ) {
          candidates.push({ x: tx, y: ty });
        }
      }
    }

    if (candidates.length === 0) {
      engine.log(`The summoning flares but finds no space to manifest!`);
      return;
    }

    const spawnPos = engine.prng.choice(candidates);
    const randSuffix = engine.prng.nextInt(1000, 9999).toString();
    const entityId = `summon_${monsterId}_${engine.turnCount}_${randSuffix}`;

    let summoned: Monster;
    try {
      summoned = Monster.createFromDefinition(monsterId, entityId, spawnPos, engine.registries);
    } catch {
      engine.log(`Summoning failed — unknown creature definition: ${monsterId}`);
      return;
    }

    if (effect.friendly) {
      summoned.faction = 'player';
      summoned.aiState = 'hunting'; // will hunt hostiles
    }

    engine.map.addEntity(summoned);
    engine.scheduler?.addEntity(summoned);

    // A lease on the world: the built-in `summoned` status, which saves with the creature
    // and sends it back when it runs out (statusHandlers.ts).
    if (effect.duration && effect.duration > 0) {
      // Its own first, so they end (a shatter, a burst) while it still stands.
      for (const type of effect.bears ?? []) summoned.statusManager.applyStatus({ type, duration: effect.duration, sourceEntityId: caster.id });
      summoned.statusManager.applyStatus({ type: 'summoned', duration: effect.duration });
      if (effect.decoy && effect.friendly) summoned.statusManager.applyStatus({ type: 'decoy', duration: effect.duration });
    }

    const allegiance = effect.friendly ? 'friendly' : 'hostile';
    engine.log(`A ${summoned.name} materialises from the aether (${allegiance})!`);
  }

  public static executeRevealEffect(
    engine: GameEngine,
    caster: Entity,
    effect: RevealEffect
  ): void {
    const duration = effect.duration ?? 30;
    if (effect.target === 'monsters' || effect.target === 'actors') {
      if (duration > 0) {
        engine.detectMonstersTurns += duration;
      }
      const monsters = engine.map.getAllEntities().filter((e) => e.isHostileTo(caster) && e.isAlive());
      for (const m of monsters) {
        engine.fov.revealTile(m.x, m.y);
      }
      engine.log(`Your mind expands beyond physical barriers! Sensing living beings through stone (${duration} turns, ${monsters.length} detected).`);
    } else if (effect.target === 'objects' || effect.target === 'items') {
      if (duration > 0) {
        engine.detectObjectsTurns += duration;
      }
      const groundPiles = engine.map.getAllGroundItems();
      for (const pile of groundPiles) {
        engine.fov.revealTile(pile.x, pile.y);
      }
      engine.log(`A resonant shimmer reveals loose treasures through stone (${duration} turns, ${groundPiles.length} pile(s)).`);
    } else if (effect.target === 'map') {
      engine.fov.revealAllTiles();
      engine.log(`*** Clairvoyance flares in your mind! The entire floor geometry is revealed! ***`);
    }
  }

  public static executeChainEffect(
    engine: GameEngine,
    spell: SpellDefinition,
    caster: Entity,
    initialTargets: Entity[],
    effect: ChainEffect,
    damageContext?: DamageEffect,
    effectsOut?: VisualEffectDescriptor[],
    powerMultiplier = 1
  ): void {
    if (initialTargets.length === 0) return;

    const visitedIds = new Set<string>([caster.id, ...initialTargets.map((t) => t.id)]);
    let current = initialTargets[0];
    const rolled = scaleByPower(damageContext ? parseAndRollDice(damageContext.amount, engine.rng) : (spell.basePower || 16), powerMultiplier);
    const element = damageContext?.element || spell.element || 'lightning';
    // The same caster scaling as the first hit (Intelligence, Enchanted, Elementalist, entropy).
    const baseDamage = scaleSpellDamage(engine, caster, element, rolled);

    // Chain-Weaver: the caster's chains reach further foes.
    const maxHops = effect.maxHops + sumWorn(caster, 'chainExtraHops');
    for (let hop = 1; hop <= maxHops; hop++) {
      // Find candidate living entities hostile to caster within hopRange of current
      const candidates = engine.map.getAllEntities().filter((e) => {
        if (!e.isAlive() || visitedIds.has(e.id)) return false;
        if (!e.isHostileTo(caster) && e.id !== caster.id) return false;
        const dist = Math.hypot(e.x - current.x, e.y - current.y);
        return dist <= effect.hopRange;
      });

      if (candidates.length === 0) break;

      // Pick closest candidate
      candidates.sort((a, b) => {
        const da = Math.hypot(a.x - current.x, a.y - current.y);
        const db = Math.hypot(b.x - current.x, b.y - current.y);
        return da - db;
      });

      const nextTarget = candidates[0];
      visitedIds.add(nextTarget.id);

      if (effectsOut) {
        effectsOut.push({
          type: 'chain_link',
          from: { x: current.x, y: current.y },
          to: { x: nextTarget.x, y: nextTarget.y },
          color: spell.visual?.color ?? getElementDefaultColor(element),
          fx: spell.visual?.fx ?? element,
          durationMs: spell.visual?.durationMs ?? 150,
        });
      }

      const decayFactor = Math.max(0.1, 1 - hop * effect.damageDecay);
      const hopDamage = Math.max(1, Math.floor(baseDamage * decayFactor));

      engine.log(`The ${spell.name} arcs from ${current.name} to ${nextTarget.name} for hop ${hop}!`);

      const terrain = engine.map.getTile(nextTarget.x, nextTarget.y)?.type;
      const hopTaken = scaleByTargetFamily(engine, caster, nextTarget, hopDamage);
      const hopElement = damageContext ? strikeElement(engine, nextTarget, damageContext) : element;
      const result = nextTarget.takeElementalDamage(wardFirstSpell(engine, caster, nextTarget, hopTaken), hopElement, engine.affinityMatrix, terrain, {
        pierce: damageContext?.pierce,
      });
      if (!result.isHeal && result.affinity !== 'immune') dispatchDamageHooks(engine, caster, nextTarget, result.damageDealt);

      if (result.killed) {
        DeathResolver.resolveDeath(engine, caster, nextTarget, {
          damageElement: hopElement,
          damageElements: damageContext ? carriedElements(damageContext) : undefined,
          damageDealt: result.finalDamage,
          remainingHpBeforeBlow: result.damageDealt,
        });
      }

      current = nextTarget;
    }
  }

  private static offset(from: Position, to: Position): { dx: number; dy: number } {
    return { dx: to.x - from.x, dy: to.y - from.y };
  }

  /** The living targets other than the caster, nearest the caster first. */
  private static othersByDistance(ctx: EffectContext): Entity[] {
    const reach = (e: Entity) => Math.max(Math.abs(e.x - ctx.caster.x), Math.abs(e.y - ctx.caster.y));
    return ctx.targets.filter((t) => t !== ctx.caster && t.isAlive()).sort((a, b) => reach(a) - reach(b));
  }

  /**
   * Drags `target` toward `caster` one tile at a time, re-aimed each step, until it stands
   * beside the caster or has gone `distance` tiles. What blocks it on the way splats it (as
   * a push does); the caster itself never does.
   */
  private static pullToward(engine: GameEngine, caster: Entity, target: Entity, distance: number): void {
    for (let step = 0; step < distance; step++) {
      const { dx, dy } = SpellPipeline.offset(target, caster);
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) return;
      const moved = applyImpulse(engine, caster, target, Math.sign(dx), Math.sign(dy), 1, 1);
      if (!moved.pushed || moved.wallSplat || moved.fellInChasm || moved.killed) return;
    }
  }

  /** The caster and a creature it can see trade places. */
  public static swapPlaces(engine: GameEngine, caster: Entity, target: Entity): boolean {
    if (!hasLineOfSight(engine, caster, target)) {
      engine.log(`${caster.name} cannot see ${target.name} to trade places.`);
      return false;
    }
    const from = { x: caster.x, y: caster.y };
    engine.map.removeEntity(target);
    engine.map.moveEntity(caster, target.x, target.y);
    target.setPosition(from.x, from.y);
    engine.map.addEntity(target);
    engine.log(`${caster.name} and ${target.name} trade places!`);
    if (caster === engine.player || target === engine.player) engine.updateFov();
    return true;
  }

  /**
   * Moves the caster to the tile it aimed at: within `range`, in sight and standable. A
   * creature on that tile puts the caster down on the nearest free tile beside it.
   */
  public static teleportToAim(engine: GameEngine, caster: Entity, aim: Position | undefined, range: number): boolean {
    if (!aim) return false;
    const { dx, dy } = SpellPipeline.offset(caster, aim);
    const reachable =
      engine.map.inBounds(aim.x, aim.y) &&
      Math.hypot(dx, dy) <= range &&
      engine.map.isPassable(aim.x, aim.y) &&
      hasLineOfSight(engine, caster, aim);
    if (!reachable) {
      engine.log(`${caster.name} cannot land there.`);
      return false;
    }
    const dest = engine.map.getEntityAt(aim.x, aim.y) ? findSafeSpawnPosition(engine.map, aim, 3, caster) : aim;
    engine.map.moveEntity(caster, dest.x, dest.y);
    if (caster instanceof Player) engine.updateFov();
    return true;
  }

  public static teleportEntity(
    engine: GameEngine,
    entity: Entity,
    range: number,
    _random = true
  ): boolean {
    const validTiles: Position[] = [];
    const minDistance = range > 0 ? 2 : 0;
    const maxDistance = range > 0 ? range : Math.max(engine.map.width, engine.map.height);

    if (range > 0) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        for (let dx = -maxDistance; dx <= maxDistance; dx++) {
          const dist = Math.hypot(dx, dy);
          if (dist >= minDistance && dist <= maxDistance) {
            const tx = entity.x + dx;
            const ty = entity.y + dy;
            if (engine.map.isPassable(tx, ty) && !engine.map.getEntityAt(tx, ty)) {
              validTiles.push({ x: tx, y: ty });
            }
          }
        }
      }
    } else {
      // Any passable tile on the map
      for (let y = 0; y < engine.map.height; y++) {
        for (let x = 0; x < engine.map.width; x++) {
          if (engine.map.isPassable(x, y) && !engine.map.getEntityAt(x, y)) {
            validTiles.push({ x, y });
          }
        }
      }
    }

    if (validTiles.length === 0) return false;

    const rawDest = engine.prng.choice(validTiles);
    const dest = findSafeSpawnPosition(engine.map, rawDest, 3, entity);
    engine.map.moveEntity(entity, dest.x, dest.y);
    if (entity instanceof Player) {
      engine.updateFov();
    }
    return true;
  }

  private static checkAndPropagateWaterShock(
    engine: GameEngine,
    spell: SpellDefinition,
    path: Array<{ x: number; y: number }>,
    hitEntityId?: string
  ): void {
    if (!engine.surfaces) return;

    // If the ray's own impact hit an entity standing in water, applyDamageEffect's
    // call to triggerElementalReaction will already flood-fill and shock the whole
    // pool at the correct 200% rate — firing again here would double-damage everyone
    // in that pool. Only self-trigger when that won't happen (miss, or hit entity
    // standing on dry land while the ray still crossed water).
    if (hitEntityId) {
      const hitEnt = engine.map.getEntityById(hitEntityId);
      if (hitEnt) {
        const tile = engine.map.getTile(hitEnt.x, hitEnt.y);
        const cell = engine.surfaces.getCell(hitEnt.x, hitEnt.y);
        const hitEntInWater = cell?.surface?.type === 'water' || tile?.type === 'shallow_water';
        if (hitEntInWater) return;
      }
    }

    const waterSeed = path.find((p) => engine.map.getTile(p.x, p.y)?.type === 'shallow_water');
    if (!waterSeed) return;

    engine.surfaces.triggerElementalReaction(
      waterSeed.x,
      waterSeed.y,
      spell.element || 'lightning',
      spell.basePower || 16,
      engine
    );
  }
}

// Automatically register built-in effect primitives
SpellPipeline.registerBuiltinEffects();
