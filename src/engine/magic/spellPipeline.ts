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
  HealEffect,
  RevealEffect,
  IdentifyEffect,
  SummonEffect,
  LearnSpellEffect,
  TargetingMode,
} from './types';
import { traceProjectile, getAreaOfEffectTiles } from './targeting';
import { DeathResolver } from '../combat/deathResolver';
import type { StatusType } from '../status/types';
import { findSafeSpawnPosition } from '../spatial/collisionSolver';
import { EffectPrimitiveRegistry, type EffectContext } from './effectRegistry';
import { scaleSpellDamage, scaleSpellHeal } from './castNumbers';
import { registerReciprocalPrimitives } from '../combat/reciprocalPipeline';
import { EnergyModel } from '../actors/energyModel';
import { Actor } from '../entities/actor';

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

export class SpellPipeline {
  public static registerBuiltinEffects(): void {
    EffectPrimitiveRegistry.register<DamageEffect>('damage', (effect, ctx) => {
      ctx.lastDamageEffect = effect;
      for (const target of ctx.targets) {
        SpellPipeline.applyDamageEffect(ctx.engine, ctx.spell, ctx.caster, target, effect);
      }
    });

    EffectPrimitiveRegistry.register<StatusEffectPrimitive>('applyStatus', (effect, ctx) => {
      for (const target of ctx.targets) {
        SpellPipeline.applyStatusEffect(ctx.engine, ctx.caster, target, effect);
      }
    });

    EffectPrimitiveRegistry.register<HealEffect>('heal', (effect, ctx) => {
      if (effect.target === 'caster') {
        SpellPipeline.applyHealEffect(ctx.engine, ctx.caster, ctx.caster, effect);
      } else {
        for (const target of ctx.targets) {
          SpellPipeline.applyHealEffect(ctx.engine, ctx.caster, target, effect);
        }
      }
    });

    EffectPrimitiveRegistry.register<TeleportEffect>('teleport', (effect, ctx) => {
      for (const target of ctx.targets) {
        SpellPipeline.teleportEntity(ctx.engine, target, effect.range, effect.random);
      }
    });

    EffectPrimitiveRegistry.register<RevealEffect>('reveal', (effect, ctx) => {
      SpellPipeline.executeRevealEffect(ctx.engine, ctx.caster, effect);
    });

    EffectPrimitiveRegistry.register<IdentifyEffect>('identify', (_effect, ctx) => {
      SpellPipeline.executeInventorySpell(ctx.engine, ctx.spell, ctx.caster, undefined, 100);
    });

    EffectPrimitiveRegistry.register<ChainEffect>('chain', (effect, ctx) => {
      SpellPipeline.executeChainEffect(
        ctx.engine,
        ctx.spell,
        ctx.caster,
        ctx.targets,
        effect,
        ctx.lastDamageEffect as DamageEffect | undefined,
        ctx.effects
      );
    });

    EffectPrimitiveRegistry.register<SummonEffect>('summon', (effect, ctx) => {
      SpellPipeline.executeSummonEffect(ctx.engine, ctx.caster, effect);
    });

    EffectPrimitiveRegistry.register<LearnSpellEffect>('learn_spell', (effect, ctx) => {
      if (!(ctx.caster instanceof Player)) return;
      const spell = ctx.engine.manifest?.spells?.find((s) => s.id === effect.spellId);
      const name = spell?.name ?? effect.spellId;
      if (ctx.caster.learnSpell(effect.spellId)) {
        ctx.engine.log(`You have learned ${name}!`);
      } else {
        ctx.engine.log(`You already know ${name}; the runes teach you nothing new.`);
      }
    });

    registerReciprocalPrimitives();
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
    actionCost = 100
  ): ActionResult {
    const mode: TargetingMode = spell.targetingMode ?? (spell.targetType as TargetingMode);

    if (mode === 'inventory_item') {
      return this.executeInventorySpell(engine, spell, caster, itemTargetId, actionCost);
    }

    if (mode === 'self') {
      return this.executeSelfSpell(engine, spell, caster, actionCost);
    }

    // Targeted / Ray / Area / Burst spells
    return this.executeTargetedSpell(engine, spell, caster, targetPos, mode, actionCost);
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
    actionCost: number
  ): ActionResult {
    const effects: VisualEffectDescriptor[] = [];
    const color = spell.visual?.color ?? getElementDefaultColor(spell.element);
    const startPos = { x: caster.x, y: caster.y };

    if (spell.effects && spell.effects.length > 0) {
      SpellPipeline.ensureBuiltinEffects();
      const ctx: EffectContext = {
        engine,
        spell,
        caster,
        targets: [caster],
        effects,
        color,
      };

      for (const effect of spell.effects) {
        if (effect.type === 'damage') {
          ctx.lastDamageEffect = effect;
        }
        EffectPrimitiveRegistry.dispatch(effect, ctx);
      }

      if (spell.effects.some((e) => e.type === 'heal')) {
        effects.push({
          type: 'burst',
          epicenter: { x: caster.x, y: caster.y },
          radius: 1,
          color,
          durationMs: spell.visual?.durationMs ?? 200,
          style: 'aura',
        });
      } else if (spell.effects.some((e) => e.type === 'teleport')) {
        effects.push({
          type: 'burst',
          epicenter: startPos,
          radius: 1,
          color,
          durationMs: 150,
          style: 'shockwave',
        });
        effects.push({
          type: 'burst',
          epicenter: { x: caster.x, y: caster.y },
          radius: 1,
          color,
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
    actionCost: number
  ): ActionResult {
    const reflects = spell.reflects || mode === 'bounce_ray' || engine.affinityMatrix.canReflect(spell.element);
    const targetsHit: Entity[] = [];
    let impactTile = { x: targetPos.x, y: targetPos.y };
    let hitDescription = '';
    const effects: VisualEffectDescriptor[] = [];
    const color = spell.visual?.color ?? getElementDefaultColor(spell.element);

    if (mode === 'ray' || mode === 'bounce_ray') {
      const rayResult = traceProjectile(
        engine.map,
        caster.x,
        caster.y,
        targetPos.x,
        targetPos.y,
        spell.range,
        reflects,
        caster.id
      );
      impactTile = rayResult.impactTile;

      if (rayResult.path.length > 0) {
        effects.push({
          type: 'projectile',
          path: rayResult.path.map((p) => ({ x: p.x, y: p.y, isReflection: p.isReflection })),
          color,
          spriteId: spell.visual?.spriteId,
          stepDelayMs: spell.visual?.stepDelayMs ?? (reflects ? 20 : 25),
          travelMode: spell.visual?.travelMode ?? (reflects ? 'stepped' : 'smooth'),
        });
      }

      if (spell.areaOfEffect > 0 || spell.visual?.archetype === 'projectile_burst') {
        const blastRadius = spell.areaOfEffect > 0 ? spell.areaOfEffect : (spell.visual?.burstRadius ?? 1);
        effects.push({
          type: 'burst',
          epicenter: { x: impactTile.x, y: impactTile.y },
          radius: blastRadius,
          color,
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
    } else if (mode === 'area_burst' || (mode === 'tile' && spell.areaOfEffect > 0) || spell.visual?.archetype === 'direct_burst') {
      let burstOrigin = targetPos;
      if (spell.visual?.archetype === 'projectile_burst' || (spell.range > 0 && spell.visual?.archetype !== 'direct_burst')) {
        const distToTarget = Math.hypot(targetPos.x - caster.x, targetPos.y - caster.y);
        const rayResult = traceProjectile(
          engine.map,
          caster.x,
          caster.y,
          targetPos.x,
          targetPos.y,
          Math.min(spell.range, distToTarget),
          false,
          caster.id
        );
        if (rayResult.path.length > 0) {
          effects.push({
            type: 'projectile',
            path: rayResult.path.map((p) => ({ x: p.x, y: p.y, isReflection: p.isReflection })),
            color,
            spriteId: spell.visual?.spriteId,
            stepDelayMs: spell.visual?.stepDelayMs ?? 25,
            travelMode: spell.visual?.travelMode ?? 'smooth',
          });
          burstOrigin = rayResult.impactTile;
        }
      }

      const radius = spell.areaOfEffect > 0 ? spell.areaOfEffect : (spell.visual?.burstRadius ?? 1);
      effects.push({
        type: 'burst',
        epicenter: { x: burstOrigin.x, y: burstOrigin.y },
        radius,
        color,
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

    // Execute effect primitives if defined
    if (spell.effects && spell.effects.length > 0) {
      SpellPipeline.ensureBuiltinEffects();
      const ctx: EffectContext = {
        engine,
        spell,
        caster,
        targets: targetsHit,
        effects,
        color,
      };

      for (const effect of spell.effects) {
        if (effect.type === 'damage') {
          ctx.lastDamageEffect = effect;
        }
        EffectPrimitiveRegistry.dispatch(effect, ctx);
      }
    } else {
      // Legacy execution
      for (const target of targetsHit) {
        this.applyLegacySpellDamageAndStatus(engine, spell, caster, target);
      }
    }

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
    effect: DamageEffect
  ): void {
    if (!target.isAlive()) return;
    const rolled = parseAndRollDice(effect.amount, engine.rng);
    if (rolled <= 0) return;
    let rawDamage = scaleSpellDamage(engine, caster, effect.element, rolled);
    rawDamage = scaleByTargetFamily(engine, caster, target, rawDamage);
    rawDamage = wardFirstSpell(engine, caster, target, rawDamage);
    const terrain = engine.map.getTile(target.x, target.y)?.type;
    const result = target.takeElementalDamage(rawDamage, effect.element, engine.affinityMatrix, terrain);

    if (result.affinity === 'absorbing') {
      engine.log(`${target.name} absorbs the ${effect.element} energy, healing ${result.healed} HP!`);
      return;
    }

    if (result.affinity === 'immune') {
      engine.log(`${target.name} is completely unharmed by the ${effect.element}!`);
      return;
    }

    let detail = '';
    if (result.affinity === 'weak') {
      detail = ' (Vulnerable! 150% damage)';
    } else if (result.affinity === 'resistant') {
      detail = ' (Resistant! 50% damage)';
    }

    if (spell.areaOfEffect > 0) {
      engine.log(`${target.name} takes ${result.damageDealt} ${effect.element} damage${detail}!`);
    } else {
      engine.log(`${caster.name}'s ${spell.name} strikes ${target.name} for ${result.damageDealt} ${effect.element} damage${detail}!`);
    }

    if (result.killed) {
      DeathResolver.resolveDeath(engine, caster, target, {
        damageElement: effect.element,
        damageDealt: result.finalDamage,
        remainingHpBeforeBlow: result.damageDealt,
        cause: ownSpellCause(caster, target, spell),
      });
    }

    if (engine.surfaces) {
      engine.surfaces.triggerElementalReaction(target.x, target.y, effect.element, result.damageDealt, engine);
    }
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
    const applied = target.statusManager.applyStatus(
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
      // The handler's onApply might log a specific message. We can still log a generic one if we want, or rely on handler.
      // Let's keep the generic one for now as it's safe.
      engine.log(`${target.name} is afflicted with ${effect.statusId}!`);
    } else {
      engine.log(`${target.name} resists the affliction!`);
    }
  }

  public static applyHealEffect(
    engine: GameEngine,
    _caster: Entity,
    target: Entity,
    effect: HealEffect
  ): void {
    if (!target.isAlive()) return;
    let amount = scaleSpellHeal(engine, _caster, parseAndRollDice(effect.amount, engine.rng));
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
   * 'player' (enabling charm-type summons). Duration > 0 is stored in worldState
   * for future turn-based despawn.
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

    if (effect.duration && effect.duration > 0) {
      // Record the summon expiry turn in worldState using boolean flags.
      // Key convention: summon_expires_{entityId}_{expiryTurn}
      const expiryTurn = engine.turnCount + effect.duration;
      engine.setWorldFlag(`summon_expires_${entityId}_${expiryTurn}`, true);
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
    effectsOut?: VisualEffectDescriptor[]
  ): void {
    if (initialTargets.length === 0) return;

    const visitedIds = new Set<string>([caster.id, ...initialTargets.map((t) => t.id)]);
    let current = initialTargets[0];
    const rolled = damageContext ? parseAndRollDice(damageContext.amount, engine.rng) : (spell.basePower || 16);
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
          durationMs: spell.visual?.durationMs ?? 150,
        });
      }

      const decayFactor = Math.max(0.1, 1 - hop * effect.damageDecay);
      const hopDamage = Math.max(1, Math.floor(baseDamage * decayFactor));

      engine.log(`The ${spell.name} arcs from ${current.name} to ${nextTarget.name} for hop ${hop}!`);

      const terrain = engine.map.getTile(nextTarget.x, nextTarget.y)?.type;
      const hopTaken = scaleByTargetFamily(engine, caster, nextTarget, hopDamage);
      const result = nextTarget.takeElementalDamage(wardFirstSpell(engine, caster, nextTarget, hopTaken), element, engine.affinityMatrix, terrain);

      if (result.killed) {
        DeathResolver.resolveDeath(engine, caster, nextTarget, {
          damageElement: element,
          damageDealt: result.finalDamage,
          remainingHpBeforeBlow: result.damageDealt,
        });
      }

      current = nextTarget;
    }
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

  private static applyLegacySpellDamageAndStatus(
    engine: GameEngine,
    spell: SpellDefinition,
    caster: Entity,
    target: Entity
  ): void {
    if (spell.basePower > 0) {
      const terrain = engine.map.getTile(target.x, target.y)?.type;
      const result = target.takeElementalDamage(wardFirstSpell(engine, caster, target, spell.basePower), spell.element, engine.affinityMatrix, terrain);

      if (result.affinity === 'absorbing') {
        engine.log(`${target.name} absorbs the ${spell.element} energy, healing ${result.healed} HP!`);
        return;
      }

      if (result.affinity === 'immune') {
        engine.log(`${target.name} is completely unharmed by the ${spell.element}!`);
        return;
      }

      let detail = '';
      if (result.affinity === 'weak') {
        detail = ' (Vulnerable! 150% damage)';
      } else if (result.affinity === 'resistant') {
        detail = ' (Resistant! 50% damage)';
      }

      if (spell.areaOfEffect > 0) {
        engine.log(`${target.name} takes ${result.damageDealt} ${spell.element} damage${detail}!`);
      } else {
        engine.log(`${caster.name}'s ${spell.name} strikes ${target.name} for ${result.damageDealt} ${spell.element} damage${detail}!`);
      }

      if (result.killed) {
        DeathResolver.resolveDeath(engine, caster, target, {
          damageElement: spell.element,
          damageDealt: result.finalDamage,
          remainingHpBeforeBlow: result.damageDealt,
          cause: ownSpellCause(caster, target, spell),
        });
        return;
      }
    }

    if (spell.statusAffliction && target.isAlive() && !shrugsAffliction(engine, target, caster, spell.statusAffliction.type)) {
      const applied = target.statusManager.applyStatus(
        {
          type: spell.statusAffliction.type,
          duration: spell.statusAffliction.duration,
          potency: spell.statusAffliction.potency,
          sourceEntityId: caster.id,
        },
        target.statusImmunities,
        target,
        engine
      );
      if (applied) {
        engine.log(`${target.name} is afflicted with ${spell.statusAffliction.type}!`);
      } else {
        engine.log(`${target.name} resists the affliction!`);
      }
    }
  }
}

// Automatically register built-in effect primitives
SpellPipeline.registerBuiltinEffects();
