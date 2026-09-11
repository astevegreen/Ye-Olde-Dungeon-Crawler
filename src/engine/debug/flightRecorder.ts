import type { GameEngine } from '../engine';
import type { CharacterProfile } from '../storage/types';
import { serializeGame } from '../storage/serializer';
import { getPlayerTotalCp } from '../economy/currency';
import type { FlightEvent, FlightEventType, DiagnosticReportOptions } from './types';

export class FlightRecorder {
  private buffer: FlightEvent[] = [];
  public readonly capacity: number;
  private nextId = 1;

  constructor(capacity = 150) {
    this.capacity = capacity;
  }

  public record(event: {
    type: FlightEventType;
    summary: string;
    timestamp?: number;
    details?: Record<string, unknown>;
  }): FlightEvent {
    const entry: FlightEvent = {
      id: this.nextId++,
      timestamp: event.timestamp ?? Date.now(),
      type: event.type,
      summary: event.summary,
      details: event.details,
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
    return entry;
  }

  public recordInput(
    key: string,
    actionType?: string,
    details?: Record<string, unknown>
  ): FlightEvent {
    return this.record({
      type: 'input',
      summary: actionType ? `Key '${key}' -> ${actionType}` : `Key '${key}'`,
      details: { key, actionType, ...details },
    });
  }

  public recordScheduler(
    actorId: string,
    energyCost: number,
    turnCount: number,
    details?: Record<string, unknown>
  ): FlightEvent {
    return this.record({
      type: 'scheduler',
      summary: `Actor '${actorId}' spent ${energyCost} energy (Turn ${turnCount})`,
      details: { actorId, energyCost, turnCount, ...details },
    });
  }

  public recordCombat(
    attacker: string,
    target: string,
    damage: number,
    killed: boolean,
    details?: Record<string, unknown>
  ): FlightEvent {
    return this.record({
      type: 'combat',
      summary: killed
        ? `${attacker} dealt ${damage} dmg to ${target} (FATAL)`
        : `${attacker} dealt ${damage} dmg to ${target}`,
      details: { attacker, target, damage, killed, ...details },
    });
  }

  public recordSpell(
    caster: string,
    spellId: string,
    target?: { x: number; y: number },
    effect?: string,
    details?: Record<string, unknown>
  ): FlightEvent {
    const tgt = target ? ` at (${target.x}, ${target.y})` : '';
    const eff = effect ? ` [${effect}]` : '';
    return this.record({
      type: 'spell',
      summary: `${caster} cast '${spellId}'${tgt}${eff}`,
      details: { caster, spellId, target, effect, ...details },
    });
  }

  public recordState(
    category: string,
    message: string,
    details?: Record<string, unknown>
  ): FlightEvent {
    return this.record({
      type: 'state',
      summary: `[${category}] ${message}`,
      details: { category, message, ...details },
    });
  }

  public recordError(
    error: Error | string,
    context?: Record<string, unknown>
  ): FlightEvent {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return this.record({
      type: 'error',
      summary: `ERROR: ${message}`,
      details: { message, stack, ...context },
    });
  }

  public recordWarning(
    message: string,
    context?: Record<string, unknown>
  ): FlightEvent {
    return this.record({
      type: 'warning',
      summary: `WARN: ${message}`,
      details: { message, ...context },
    });
  }

  public warn(message: string, context?: Record<string, unknown>): FlightEvent {
    return this.recordWarning(message, context);
  }

  public log(message: string, context?: Record<string, unknown>): FlightEvent {
    return this.recordState('general', message, context);
  }

  public getEvents(): FlightEvent[] {
    return [...this.buffer];
  }

  public getRecentEvents(count = 150): FlightEvent[] {
    return this.buffer.slice(-count);
  }

  public clear(): void {
    this.buffer = [];
  }

  /**
   * Generates an Antigravity-ready Markdown diagnostic report with telemetry, player state,
   * floor snapshot, 150-event chronological flight log, and optional state snapshot.
   */
  public generateReport(
    engine?: GameEngine,
    profile?: CharacterProfile,
    options: DiagnosticReportOptions = {}
  ): string {
    const now = new Date();
    const isoTimestamp = now.toISOString();
    const dpr = options.devicePixelRatio ?? 1;
    const winW = options.viewportWidth ?? 960;
    const winH = options.viewportHeight ?? 600;
    const userAgent = options.userAgent ?? 'Headless / Pure Engine';

    const events = this.getRecentEvents(options.maxEvents ?? this.capacity);
    const firstEventTime = events.length > 0 ? events[0].timestamp : now.getTime();

    const lines: string[] = [];

    lines.push(`# ${engine?.manifest?.name ?? 'Roguelike Game Engine'} - Diagnostic Flight Report`);
    lines.push(`Generated: **${isoTimestamp}** | Epoch: \`${now.getTime()}\``);
    lines.push('');

    // 1. System Telemetry
    lines.push('## 1. System Telemetry');
    lines.push(`- **Content Manifest**: \`${engine?.manifest?.id ?? 'cotw'}\` (${engine?.manifest?.name ?? 'Castle of the Winds'})`);
    lines.push(`- **Engine Version**: \`1.0.0\` (Architecture: Swappable Manifest + RLE V2)`);
    lines.push(`- **Display / Viewport**: ${winW}x${winH} (DPR: \`${dpr}\`)`);
    lines.push(`- **User Agent**: \`${userAgent}\``);
    lines.push(`- **Buffered Events**: ${events.length} / ${this.capacity}`);
    lines.push('');

    // 2. Player State
    if (engine && engine.player) {
      const p = engine.player;
      const inv = p.inventory;
      const enc = inv.getEncumbrance(p.strength);
      const equipped = inv.paperdoll.getAllEquipped();
      const statusEffects = p.statusManager.getAll();

      const weightGrams = inv.totalWeight();
      const weightLbs = (weightGrams / 453.592).toFixed(1);
      const totalCp = getPlayerTotalCp(p);

      const townLabel = engine.manifest?.town?.name ? `${engine.manifest.town.name} Town` : 'Town';
      lines.push('## 2. Player State');
      lines.push(`- **Hero**: **${p.name}** (Gender: ${p.gender}, Level: ${p.level}, XP: ${p.xp}/${p.xpToNextLevel})`);
      lines.push(`- **Location**: Floor ${engine.currentFloor} (${engine.currentFloor === 0 ? townLabel : 'Dungeon'}) at \`(${p.x}, ${p.y})\``);
      lines.push(`- **Difficulty / Campaign Arc**: \`${(p.difficulty ?? 'medium').toUpperCase()}\` (Max Floor: \`${p.maxFloor ?? 37}\`)`);
      lines.push(`- **Vitals**: HP \`${p.hp}/${p.maxHp}\` | MP \`${p.mana}/${p.maxMana}\``);
      lines.push(`- **Attributes**: STR \`${p.strength}\` | DEX \`${p.dexterity}\` | CON \`${p.constitution}\` | INT \`${p.intelligence}\``);
      lines.push(`- **Combat**: Base ATK \`${p.attack}\` | Base DEF \`${p.defense}\` | Speed \`${p.speed}\``);
      lines.push(`- **Encumbrance**: **${enc.toUpperCase()}** (${weightLbs} lbs / ${weightGrams}g)`);
      lines.push(`- **Purse (Total Purchasing Power)**: \`${totalCp}\` cp`);

      if (statusEffects.length > 0) {
        const effectsStr = statusEffects.map((e) => `${e.type.toUpperCase()} (${e.duration}t)`).join(', ');
        lines.push(`- **Active Afflictions**: ${effectsStr}`);
      } else {
        lines.push('- **Active Afflictions**: None');
      }

      lines.push('- **Equipped Gear**:');
      if (equipped.length === 0) {
        lines.push('  - *(None equipped)*');
      } else {
        for (const eq of equipped) {
          lines.push(`  - \`[${eq.slot}]\` ${eq.item.displayName} (Weight: ${eq.item.weight}, Bulk: ${eq.item.bulk})`);
        }
      }
      lines.push('');
    }

    // 3. Map & Floor Telemetry
    if (engine && engine.map) {
      const floorMonsters = engine.map
        .getAllEntities()
        .filter((e) => e !== engine.player && (typeof e.isAlive === 'function' ? e.isAlive() : true));
      const groundPiles = engine.map.getAllGroundItems();

      lines.push('## 3. Active Floor Telemetry');
      lines.push(`- **Floor Index**: \`${engine.currentFloor}\``);
      lines.push(`- **Map Bounds**: \`${engine.map.width} x ${engine.map.height}\``);
      lines.push(`- **Turn Count**: \`${engine.turnCount}\``);
      lines.push(`- **Alive Monsters**: ${floorMonsters.length}`);
      if (floorMonsters.length > 0) {
        for (const m of floorMonsters.slice(0, 10)) {
          lines.push(`  - \`${m.name}\` at (${m.x}, ${m.y}) - HP: ${m.hp}/${m.maxHp}`);
        }
        if (floorMonsters.length > 10) {
          lines.push(`  - *...and ${floorMonsters.length - 10} more*`);
        }
      }
      lines.push(`- **Ground Item Piles**: ${groundPiles.length}`);
      lines.push('');
    }

    // 4. Chronological Flight Log
    lines.push(`## 4. Chronological Flight Log (${events.length} Events)`);
    if (events.length === 0) {
      lines.push('*(No telemetry events recorded yet)*');
    } else {
      lines.push('| ID | +Time | Type | Summary | Details |');
      lines.push('|---|---|---|---|---|');
      for (const ev of events) {
        const deltaMs = ev.timestamp - firstEventTime;
        const detailsStr = ev.details ? JSON.stringify(ev.details) : '';
        const sanitizedDetails = detailsStr.length > 60 ? detailsStr.slice(0, 57) + '...' : detailsStr;
        lines.push(`| #${ev.id} | +${deltaMs}ms | \`${ev.type}\` | ${ev.summary} | \`${sanitizedDetails}\` |`);
      }
    }
    lines.push('');

    // 5. Reproducible State Snapshot
    if (options.includeSnapshot !== false && engine) {
      lines.push('## 5. Reproducible State Snapshot');
      try {
        const mockProfile: CharacterProfile = profile ?? {
          id: 'diagnostic_snapshot',
          name: engine.player.name,
          gender: engine.player.gender,
          attributes: engine.player.attributes,
          level: engine.player.level,
          floor: engine.currentFloor,
          lastSaved: now.getTime(),
          hp: engine.player.hp,
          maxHp: engine.player.maxHp,
          strength: engine.player.strength,
          mana: engine.player.mana,
          maxMana: engine.player.maxMana,
          xp: engine.player.xp,
          xpToNextLevel: engine.player.xpToNextLevel,
        };
        const saveData = serializeGame(engine, mockProfile);
        const jsonSnapshot = JSON.stringify(saveData);
        lines.push('```json');
        lines.push(jsonSnapshot);
        lines.push('```');
      } catch (err) {
        lines.push(`*(Failed to serialize game state snapshot: ${(err as Error).message})*`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export const flightRecorder = new FlightRecorder(150);
