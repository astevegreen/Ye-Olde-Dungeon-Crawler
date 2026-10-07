import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';

export interface DeathEnvelope {
  fatalDamageType: string;
  killerArchetypeId: string;
  planeDepth: number;
  activePlaneId: string;
  equippedSynergyTags: string[];
  corruptionLevel: number;
  turnsElapsed: number;
  timestamp: number;
  victimName: string;
  victimLevel: number;
}

/** Envelopes kept for the session: the latest few deaths, not every one since launch (R-dbg-14). */
const HISTORY_LIMIT = 20;

export class DeathEnvelopeTracker {
  private static latestEnvelope: DeathEnvelope | null = null;
  private static history: DeathEnvelope[] = [];
  private static listeners: Array<(envelope: DeathEnvelope) => void> = [];

  /**
   * Compiles and records a comprehensive death envelope upon player defeat.
   */
  public static recordPlayerDeath(
    engine: GameEngine,
    killer?: Entity,
    damageType = 'physical'
  ): DeathEnvelope {
    const player = engine.player;

    // Extract equipped synergy tags from paperdoll equipment
    const synergyTags: string[] = [];
    if (player.inventory?.paperdoll) {
      for (const equipped of player.inventory.paperdoll.getAllEquipped()) {
        const item = equipped.item;
        if (item.elementalAffix?.element) {
          synergyTags.push(`element:${item.elementalAffix.element}`);
        }
        if (item.aspectState && item.aspectState !== 'neutral') {
          synergyTags.push(`aspect:${item.aspectState}`);
        }
        if (item.category) {
          synergyTags.push(`category:${item.category}`);
        }
      }
    }

    let killerArchetype = 'unknown_hazard';
    if (killer instanceof Monster) {
      killerArchetype = killer.definitionId ?? killer.name;
    } else if (killer) {
      killerArchetype = killer.name;
    }

    const envelope: DeathEnvelope = {
      fatalDamageType: damageType,
      killerArchetypeId: killerArchetype,
      planeDepth: engine.currentFloor,
      activePlaneId: player.planeId ?? 'physical',
      equippedSynergyTags: Array.from(new Set(synergyTags)),
      corruptionLevel: player.corruptionScore ?? 0,
      turnsElapsed: engine.turnCount,
      timestamp: Date.now(),
      victimName: player.name,
      victimLevel: player.level,
    };

    DeathEnvelopeTracker.latestEnvelope = envelope;
    DeathEnvelopeTracker.history.push(envelope);
    if (DeathEnvelopeTracker.history.length > HISTORY_LIMIT) DeathEnvelopeTracker.history.shift();

    // Notify registered external listeners (metaprogression / hub / cemetery)
    for (const listener of DeathEnvelopeTracker.listeners) {
      listener(envelope);
    }

    return envelope;
  }

  public static getLatestEnvelope(): DeathEnvelope | null {
    return DeathEnvelopeTracker.latestEnvelope;
  }

  public static getHistory(): readonly DeathEnvelope[] {
    return DeathEnvelopeTracker.history;
  }

  public static subscribe(listener: (envelope: DeathEnvelope) => void): () => void {
    DeathEnvelopeTracker.listeners.push(listener);
    return () => {
      const idx = DeathEnvelopeTracker.listeners.indexOf(listener);
      if (idx !== -1) {
        DeathEnvelopeTracker.listeners.splice(idx, 1);
      }
    };
  }

  /** Forgets the recorded deaths; subscribers stay subscribed (they unsubscribe themselves). */
  public static clearHistory(): void {
    DeathEnvelopeTracker.latestEnvelope = null;
    DeathEnvelopeTracker.history = [];
  }
}
