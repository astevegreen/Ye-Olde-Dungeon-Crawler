import type { GameEngine } from '../engine';
import { getFlag, setFlag } from '../state/worldState';

export interface RunPactMutatorRules {
  playerMaxHpPercent?: number; // e.g. -0.25 (-25% max HP)
  playerAttackBonus?: number; // e.g. +4
  playerDefenseBonus?: number; // e.g. -2 or -4
  fovRadiusModifier?: number; // e.g. -3
  monsterDensityMultiplier?: number; // e.g. 1.5
  monsterStatMultiplier?: number; // e.g. 1.2
}

export interface RunPactRewardModifiers {
  goldMultiplier: number; // e.g. 2.0 (200% gold)
  xpMultiplier: number; // e.g. 1.75 (175% XP)
  magicFindBonus: number; // e.g. 0.2 (+20% drop chance)
}

export interface RunPactDefinition {
  id: string;
  name: string;
  description: string;
  curseDescription: string;
  rewardDescription: string;
  mutators: RunPactMutatorRules;
  rewards: Partial<RunPactRewardModifiers>;
}

export class PactManager {
  private registry = new Map<string, RunPactDefinition>();
  private engine?: GameEngine;

  constructor(engine?: GameEngine, pacts?: RunPactDefinition[]) {
    this.engine = engine;
    if (pacts) {
      for (const pact of pacts) {
        this.register(pact);
      }
    }
  }

  public setEngine(engine: GameEngine): void {
    this.engine = engine;
  }

  public register(pact: RunPactDefinition): void {
    this.registry.set(pact.id, pact);
  }

  public getPact(id: string): RunPactDefinition | undefined {
    return this.registry.get(id);
  }

  public getAllPacts(): RunPactDefinition[] {
    return Array.from(this.registry.values());
  }

  public isPactActive(id: string): boolean {
    if (!this.engine?.worldState) return false;
    return getFlag(this.engine.worldState, `pact_active_${id}`);
  }

  public activatePact(id: string): boolean {
    const pact = this.registry.get(id);
    if (!pact) return false;
    if (this.engine?.worldState) {
      setFlag(this.engine.worldState, `pact_active_${id}`, true);
      this.engine.log(`[Pact Sealed] ${pact.name}: ${pact.curseDescription}`);
      this.engine.emitDiscovery({
        type: 'pact_sealed',
        text: `Sealed Ancient Pact: ${pact.name}`,
        icon: '📜',
      });
      return true;
    }
    return false;
  }

  public deactivatePact(id: string): boolean {
    const pact = this.registry.get(id);
    if (!pact) return false;
    if (this.engine?.worldState) {
      setFlag(this.engine.worldState, `pact_active_${id}`, false);
      this.engine.log(`[Pact Renounced] ${pact.name} has been broken.`);
      return true;
    }
    return false;
  }

  public togglePact(id: string): boolean {
    if (this.isPactActive(id)) {
      return this.deactivatePact(id);
    } else {
      return this.activatePact(id);
    }
  }

  public getActivePacts(): RunPactDefinition[] {
    return this.getAllPacts().filter((p) => this.isPactActive(p.id));
  }

  public getAggregatedMutators(): RunPactMutatorRules {
    const active = this.getActivePacts();
    const result: RunPactMutatorRules = {
      playerMaxHpPercent: 0,
      playerAttackBonus: 0,
      playerDefenseBonus: 0,
      fovRadiusModifier: 0,
      monsterDensityMultiplier: 1.0,
      monsterStatMultiplier: 1.0,
    };

    for (const pact of active) {
      if (pact.mutators.playerMaxHpPercent) {
        result.playerMaxHpPercent! += pact.mutators.playerMaxHpPercent;
      }
      if (pact.mutators.playerAttackBonus) {
        result.playerAttackBonus! += pact.mutators.playerAttackBonus;
      }
      if (pact.mutators.playerDefenseBonus) {
        result.playerDefenseBonus! += pact.mutators.playerDefenseBonus;
      }
      if (pact.mutators.fovRadiusModifier) {
        result.fovRadiusModifier! += pact.mutators.fovRadiusModifier;
      }
      if (pact.mutators.monsterDensityMultiplier) {
        result.monsterDensityMultiplier! *= pact.mutators.monsterDensityMultiplier;
      }
      if (pact.mutators.monsterStatMultiplier) {
        result.monsterStatMultiplier! *= pact.mutators.monsterStatMultiplier;
      }
    }

    return result;
  }

  public getAggregatedRewards(): RunPactRewardModifiers {
    const active = this.getActivePacts();
    let goldMult = 1.0;
    let xpMult = 1.0;
    let magicFind = 0.0;

    for (const pact of active) {
      if (pact.rewards.goldMultiplier) {
        goldMult *= pact.rewards.goldMultiplier;
      }
      if (pact.rewards.xpMultiplier) {
        xpMult *= pact.rewards.xpMultiplier;
      }
      if (pact.rewards.magicFindBonus) {
        magicFind += pact.rewards.magicFindBonus;
      }
    }

    return {
      goldMultiplier: goldMult,
      xpMultiplier: xpMult,
      magicFindBonus: magicFind,
    };
  }
}
