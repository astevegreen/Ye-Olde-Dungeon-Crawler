import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import type { SpellDefinition } from './types';
import type { VisualEffectDescriptor } from '../types';
import { DeathResolver } from '../combat/deathResolver';

export type VoidOverflowTier = 0 | 1 | 2 | 3;

export const OVERFLOW_TIER_THRESHOLDS = {
  TIER_1: 1,
  TIER_2: 6,
  TIER_3: 16,
} as const;

export interface ManaOverflowResolution {
  occurred: boolean;
  tier: VoidOverflowTier;
  deficit: number;
  totalDebt: number;
  message?: string;
  effects: VisualEffectDescriptor[];
  damageToCaster: number;
}

/**
 * Evaluates the Ginnungagap / Mana Overflow when a caster spends past zero mana.
 * Pure headless simulation: relies solely on engine.prng / engine.rng, never Math.random().
 */
export class ManaOverflowManager {
  public static evaluateOverflow(
    engine: GameEngine,
    caster: Entity,
    deficit: number,
    _spell: SpellDefinition
  ): ManaOverflowResolution {
    const isPlayer = caster instanceof Player;
    const player = isPlayer ? (caster as Player) : undefined;
    const totalDebt = player ? player.accrueVoidDebt(deficit) : deficit;

    const effects: VisualEffectDescriptor[] = [];
    let tier: VoidOverflowTier = 0;
    let message = '';
    let damageToCaster = 0;

    if (totalDebt >= OVERFLOW_TIER_THRESHOLDS.TIER_3) {
      tier = 3;
    } else if (totalDebt >= OVERFLOW_TIER_THRESHOLDS.TIER_2) {
      tier = 2;
    } else if (totalDebt >= OVERFLOW_TIER_THRESHOLDS.TIER_1) {
      tier = 1;
    }

    if (tier === 0) {
      return { occurred: false, tier: 0, deficit, totalDebt, effects, damageToCaster };
    }

    const prng = engine.prng;
    const roll = prng.nextInt(1, 100);

    // Visual rift burst at caster location
    effects.push({
      type: 'burst',
      epicenter: { x: caster.x, y: caster.y },
      radius: tier === 3 ? 2 : 1,
      color: tier === 3 ? '#7c3aed' : tier === 2 ? '#a855f7' : '#c084fc',
      durationMs: tier === 3 ? 300 : 200,
      style: 'shockwave',
    });

    if (tier === 1) {
      // Tier 1: Reality Fracture (Debt 1 - 5)
      // Minor environmental spill or acoustic crack
      if (roll <= 60 && engine.surfaces) {
        // Spawn volatile surface on an adjacent passable tile
        const neighbors = [
          { x: caster.x + 1, y: caster.y },
          { x: caster.x - 1, y: caster.y },
          { x: caster.x, y: caster.y + 1 },
          { x: caster.x, y: caster.y - 1 },
        ].filter((p) => engine.map.inBounds(p.x, p.y) && engine.map.isPassable(p.x, p.y));

        if (neighbors.length > 0) {
          const chosen = prng.choice(neighbors);
          const surfaceType = prng.choice(['dense_steam', 'ice_sheet', 'fire_storm'] as const);
          if (surfaceType === 'dense_steam') {
            engine.surfaces.setGas(chosen.x, chosen.y, 'dense_steam', 4, 1);
            message = `🌀 Aetheric overflow! A pocket of dense steam billows from the floor! (Void Debt: ${totalDebt})`;
          } else if (surfaceType === 'ice_sheet') {
            engine.surfaces.setSurface(chosen.x, chosen.y, 'ice_sheet', 5, 1);
            message = `🌀 Aetheric overflow! Frost condenses into a slick sheet of ice! (Void Debt: ${totalDebt})`;
          } else {
            engine.surfaces.setGas(chosen.x, chosen.y, 'fire_storm', 3, 4);
            message = `🌀 Aetheric overflow! A brief fiery rift flares on the stone! (Void Debt: ${totalDebt})`;
          }
        } else {
          message = `🌀 Aetheric overflow ripples harmlessly through the stone! (Void Debt: ${totalDebt})`;
        }
      } else {
        // Acoustic crack: alerts sleeping enemies nearby
        message = `🌀 Mana depleted! An eerie rift crackles around ${caster.name}! (Void Debt: ${totalDebt})`;
      }
    } else if (tier === 2) {
      // Tier 2: Primordial Tremor (Debt 6 - 15)
      if (roll <= 45) {
        // Inverted recoil shock
        damageToCaster = Math.max(3, Math.floor(deficit * 0.75));
        const res = caster.takeDamage(damageToCaster);
        damageToCaster = res.damageDealt;
        message = `⚡ Primordial tremor! The uncontained ether recoils into ${caster.name} for ${damageToCaster} backlash damage! (Void Debt: ${totalDebt})`;
        effects.push({
          type: 'screen_flash',
          color: '#9333ea',
          durationMs: 180,
        });
        if (res.killed) {
          DeathResolver.resolveDeath(engine, undefined, caster);
        }
      } else if (roll <= 80) {
        // Spiritual palsy: stunned for 1 turn
        caster.statusManager.applyStatus(
          { type: 'stunned', duration: 1, potency: 1 },
          caster.statusImmunities,
          caster,
          engine
        );
        message = `⚡ Primordial tremor! The dimensional shockwave stuns ${caster.name} for 1 turn! (Void Debt: ${totalDebt})`;
      } else if (engine.surfaces) {
        // Acid pool or boiling geyser under caster
        engine.surfaces.setSurface(caster.x, caster.y, 'acid_pool', 4, 1);
        message = `⚡ Primordial tremor! Caustic aether pools beneath ${caster.name}! (Void Debt: ${totalDebt})`;
      } else {
        message = `⚡ Primordial tremor vibrates through reality! (Void Debt: ${totalDebt})`;
      }
    } else {
      // Tier 3: Ymir's Wrath (Debt 16+)
      if (roll <= 40) {
        // Severe entropic backlash
        damageToCaster = Math.max(10, Math.floor(deficit * 1.2));
        const res = caster.takeDamage(damageToCaster);
        damageToCaster = res.damageDealt;
        message = `☠ YMIR'S WRATH! Catastrophic void backlash tears into ${caster.name} for ${damageToCaster} damage! (Void Debt: ${totalDebt})`;
        effects.push({
          type: 'screen_flash',
          color: '#581c87',
          durationMs: 300,
        });
        if (res.killed) {
          DeathResolver.resolveDeath(engine, undefined, caster);
        }
      } else if (roll <= 70 && player) {
        // Mortal conduit burn: burns 1 permanent Max HP
        if (player.maxHp > 5) {
          player.maxHp = Math.max(5, player.maxHp - 1);
          player.hp = Math.min(player.hp, player.maxHp);
          message = `☠ YMIR'S WRATH! The abyssal conduit burns away 1 permanent Max HP! (Max HP: ${player.maxHp}, Void Debt: ${totalDebt})`;
        } else {
          damageToCaster = 12;
          caster.takeDamage(damageToCaster);
          message = `☠ YMIR'S WRATH! The cosmic conduit ravages ${caster.name} for ${damageToCaster} damage! (Void Debt: ${totalDebt})`;
        }
      } else {
        // Spatial displacement: teleport caster a short distance away
        const validTiles: Array<{ x: number; y: number }> = [];
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            if (Math.abs(dx) + Math.abs(dy) < 2) continue;
            const tx = caster.x + dx;
            const ty = caster.y + dy;
            if (engine.map.inBounds(tx, ty) && engine.map.isPassable(tx, ty) && !engine.map.getEntityAt(tx, ty)) {
              validTiles.push({ x: tx, y: ty });
            }
          }
        }
        if (validTiles.length > 0) {
          const dest = prng.choice(validTiles);
          engine.map.moveEntity(caster, dest.x, dest.y);
          if (caster instanceof Player) {
            engine.updateFov();
          }
          message = `☠ YMIR'S WRATH! A spatial rupture violently displaces ${caster.name}! (Void Debt: ${totalDebt})`;
        } else {
          message = `☠ YMIR'S WRATH shatters the surrounding reality! (Void Debt: ${totalDebt})`;
        }
      }
    }

    if (message) {
      engine.log(message);
    }

    return {
      occurred: true,
      tier,
      deficit,
      totalDebt,
      message,
      effects,
      damageToCaster,
    };
  }
}
