import type { GameEngine } from '../engine';
import type { CharacterProfile } from '../storage/types';
import { getPlayerTotalCp } from '../economy/currency';
import { safeJsonStringify } from '../storage/safeJson';
import { sanitizePaths } from './sanitizer';
export { sanitizePaths } from './sanitizer';
import type {
  FlightEvent,
  FlightEventType,
  DiagnosticReportOptions,
  DiagnosticPackage,
  DiagnosticPackageOptions,
  DiagnosticPackageMetadata,
} from './types';

/**
 * Injected by `storage/serializer.ts` (self-registering on load) rather than imported
 * directly. `storage/serializer.ts` sits behind a chain of value-imports reachable
 * from `entities/monster.ts` (this module is one of monster.ts's own imports), so a
 * direct static import here would put `entities/monster.ts` in a load-order cycle
 * with itself. Everything in that cycle already tolerated it by only touching the
 * circular value lazily inside function bodies — this diagnostic snapshot is the
 * same lazy-use case, just expressed as injection instead of a static import so the
 * cycle never forms in the first place.
 */
type SerializeGameFn = (engine: GameEngine, profile?: CharacterProfile) => unknown;
let serializeGameFn: SerializeGameFn | null = null;
export function registerSerializeGameFn(fn: SerializeGameFn): void {
  serializeGameFn = fn;
}

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
    try {
      const entry: FlightEvent = {
        id: this.nextId++,
        timestamp: event.timestamp ?? Date.now(),
        type: event.type,
        summary: sanitizePaths(event.summary),
        details: event.details,
      };

      this.buffer.push(entry);
      if (this.buffer.length > this.capacity) {
        this.buffer.shift();
      }
      return entry;
    } catch (_err) {
      // Defensive fallback against log cascade
      const fallbackEntry: FlightEvent = {
        id: this.nextId++,
        timestamp: Date.now(),
        type: event.type ?? 'error',
        summary: String(event.summary ?? 'Logging failure'),
      };
      this.buffer.push(fallbackEntry);
      return fallbackEntry;
    }
  }

  public recordInput(
    key: string,
    actionType?: string,
    details?: Record<string, unknown>
  ): FlightEvent {
    const last = this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
    const isSameInput =
      last &&
      last.type === 'input' &&
      last.details?.key === key &&
      last.details?.actionType === actionType &&
      (!details || !('index' in details));

    if (isSameInput && last) {
      const repeatCount = ((last.details?.repeatCount as number) ?? 1) + 1;
      last.details = { ...last.details, ...details, repeatCount };
      last.timestamp = Date.now();
      const baseSummary = actionType ? `Key '${key}' -> ${actionType}` : `Key '${key}'`;
      last.summary = `${baseSummary} (x${repeatCount})`;
      return last;
    }

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
    try {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      return this.record({
        type: 'error',
        summary: `ERROR: ${message}`,
        details: { message, stack, ...context },
      });
    } catch (_err) {
      return this.record({
        type: 'error',
        summary: `ERROR: [Unrecordable Error]`,
      });
    }
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

  /**
   * Retrieves the most recent sequence of player actions/inputs from the buffer,
   * formatted for reproduction by AI agents (Claude Code / Antigravity).
   */
  public getRecentActionSequence(max = 15): string[] {
    const actions: string[] = [];
    for (let i = this.buffer.length - 1; i >= 0 && actions.length < max; i--) {
      const ev = this.buffer[i];
      if (ev.type === 'input') {
        actions.unshift(ev.summary);
      } else if (ev.type === 'combat') {
        actions.unshift(`Combat: ${ev.summary}`);
      } else if (ev.type === 'spell') {
        actions.unshift(`Spell: ${ev.summary}`);
      } else if (ev.type === 'state' && ev.details?.action) {
        actions.unshift(String(ev.details.action));
      }
    }
    return actions;
  }

  /**
   * Scopes flight log events to only those relevant to a specific category,
   * preventing irrelevant data bloat in bug reports.
   */
  public getScopedFlightLog(category?: string, maxEvents?: number): FlightEvent[] {
    const limit = maxEvents ?? this.capacity;
    if (!category || category === 'Other' || category === 'Crash / Freeze' || category === 'Balance & Rules') {
      return this.getRecentEvents(limit);
    }
    const catLower = category.toLowerCase();
    let filtered: FlightEvent[];
    if (catLower.includes('combat') || catLower.includes('spell')) {
      filtered = this.buffer.filter(
        (e) =>
          e.type === 'combat' ||
          e.type === 'spell' ||
          e.type === 'error' ||
          (e.type === 'state' && (e.details?.category === 'combat' || e.details?.category === 'action'))
      );
    } else if (catLower.includes('item') || catLower.includes('inventory')) {
      filtered = this.buffer.filter(
        (e) =>
          e.type === 'error' ||
          e.type === 'warning' ||
          (e.type === 'state' && (e.details?.category === 'inventory' || e.details?.category === 'item' || e.details?.category === 'action')) ||
          (e.type === 'input' && typeof e.summary === 'string' && (e.summary.includes('Pick') || e.summary.includes('Loot') || e.summary.includes('Drop') || e.summary.includes('Item') || e.summary.includes('Use')))
      );
    } else if (catLower.includes('visual') || catLower.includes('ui')) {
      filtered = this.buffer.filter(
        (e) =>
          e.type === 'warning' ||
          e.type === 'error' ||
          (e.type === 'state' && (e.details?.category === 'ui' || e.details?.category === 'render')) ||
          (e.type === 'input' && typeof e.summary === 'string' && e.summary.includes('Toggle'))
      );
    } else if (catLower.includes('map') || catLower.includes('movement')) {
      filtered = this.buffer.filter(
        (e) =>
          (e.type === 'input' && e.summary.includes('Move')) ||
          (e.type === 'state' && (e.details?.category === 'movement' || e.details?.category === 'map' || e.details?.category === 'action')) ||
          e.type === 'error' ||
          e.type === 'warning'
      );
    } else {
      filtered = this.buffer;
    }
    if (filtered.length === 0) {
      return this.getRecentEvents(Math.min(limit, 25));
    }
    return filtered.slice(-limit);
  }

  public clear(): void {
    this.buffer = [];
  }

  public generateStateSnapshot(
    engine?: GameEngine,
    profile?: CharacterProfile
  ): unknown | null {
    if (!engine) return null;
    const now = new Date();
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
    if (!serializeGameFn) {
      throw new Error('serializeGame is not registered (storage/serializer.ts was not loaded)');
    }
    return serializeGameFn(engine, mockProfile);
  }

  public generateAsciiMap(engine?: GameEngine, radius = 5): string | null {
    if (!engine || !engine.map || !engine.player) {
      return null;
    }
    try {
      const map = engine.map;
      const player = engine.player;
      const px = player.x;
      const py = player.y;

      const lines: string[] = [];
      const legendEntries = new Map<string, string>();
      legendEntries.set('@', `Hero (${player.name}, HP: ${player.hp}/${player.maxHp})`);

      for (let dy = -radius; dy <= radius; dy++) {
        const y = py + dy;
        let row = '';
        for (let dx = -radius; dx <= radius; dx++) {
          const x = px + dx;
          if (dx === 0 && dy === 0) {
            row += '@';
            continue;
          }
          if (!map.inBounds(x, y)) {
            row += ' ';
            continue;
          }

          const entity = map.getEntityAt(x, y);
          if (entity) {
            if (entity.type === 'player') {
              row += '@';
            } else if (entity.type === 'monster') {
              const sym = entity.name ? entity.name[0].toLowerCase() : 'm';
              row += sym;
              if (!legendEntries.has(sym)) {
                legendEntries.set(sym, `${entity.name} (HP: ${entity.hp}/${entity.maxHp})`);
              }
            } else {
              row += 'N';
              if (!legendEntries.has('N')) {
                legendEntries.set('N', `NPC (${entity.name})`);
              }
            }
            continue;
          }

          const items = typeof map.getItemsAt === 'function' ? map.getItemsAt(x, y) : [];
          if (items && items.length > 0) {
            row += '*';
            if (!legendEntries.has('*')) {
              const firstItem = items[0]?.name ?? 'Item';
              legendEntries.set('*', `${firstItem}${items.length > 1 ? ` (+${items.length - 1})` : ''}`);
            }
            continue;
          }

          const tile = map.getTile(x, y);
          if (!tile) {
            row += ' ';
          } else if (tile.isClosedDoor) {
            row += '+';
            if (!legendEntries.has('+')) legendEntries.set('+', 'Closed Door');
          } else if (tile.isOpenDoor) {
            row += '/';
            if (!legendEntries.has('/')) legendEntries.set('/', 'Open Door');
          } else if (tile.isStairsUp) {
            row += '<';
            if (!legendEntries.has('<')) legendEntries.set('<', 'Stairs Up');
          } else if (tile.isStairsDown) {
            row += '>';
            if (!legendEntries.has('>')) legendEntries.set('>', 'Stairs Down');
          } else if (!tile.passable) {
            row += '#';
          } else {
            row += '.';
          }
        }
        lines.push(row);
      }

      if (!legendEntries.has('#')) legendEntries.set('#', 'Wall');
      if (!legendEntries.has('.')) legendEntries.set('.', 'Floor');

      const legendStr = Array.from(legendEntries.entries())
        .map(([sym, desc]) => `[${sym}] ${desc}`)
        .join(' | ');

      return `Floor ${engine.currentFloor} @ (${px}, ${py}):\n` + lines.join('\n') + `\n\nLegend: ${legendStr}`;
    } catch {
      return null;
    }
  }

  public generateFlightLogJson(maxEvents?: number): string {
    const events = this.getRecentEvents(maxEvents ?? this.capacity);
    return safeJsonStringify(events);
  }

  public generateSummary(
    engine?: GameEngine,
    profile?: CharacterProfile,
    options: DiagnosticPackageOptions = {}
  ): string {
    const now = new Date();
    const isoTimestamp = now.toISOString();
    const dpr = options.devicePixelRatio ?? 1;
    const winW = options.viewportWidth ?? 960;
    const winH = options.viewportHeight ?? 600;
    const userAgent = options.userAgent ?? 'Headless / Pure Engine';

    const lines: string[] = [];
    const manifestName = engine?.manifest?.name ?? 'Roguelike Engine';
    const manifestId = engine?.manifest?.id ?? 'core';

    lines.push(`### 🛡️ ${manifestName} (${manifestId}) - Diagnostic Summary`);
    lines.push(`- **Generated**: \`${isoTimestamp}\``);
    lines.push(`- **Engine Version**: \`1.0.0\` | **Display**: ${winW}x${winH} (DPR: \`${dpr}\`)`);
    lines.push(`- **Environment**: \`${userAgent}\``);

    if (engine && engine.player) {
      const p = engine.player;
      lines.push(`- **Hero**: **${p.name}** (Level ${p.level}, HP \`${p.hp}/${p.maxHp}\`, MP \`${p.mana}/${p.maxMana}\`)`);
      lines.push(`- **Location**: Floor \`${engine.currentFloor}\` at \`(${p.x}, ${p.y})\` | **Turn**: \`${engine.turnCount}\``);
      lines.push(`- **Difficulty**: \`${(p.difficulty ?? profile?.difficulty ?? 'medium').toUpperCase()}\``);
      if (engine.prng) {
        lines.push(`- **PRNG State / Seed**: \`${engine.prng.getState()}\``);
      }
    } else if (profile) {
      lines.push(`- **Hero Profile**: **${profile.name}** (Level ${profile.level}, Floor ${profile.floor})`);
    }

    if (options.error) {
      const err = options.error;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const msg = sanitizePaths(rawMsg);
      const rawStack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : undefined;
      const stack = rawStack ? sanitizePaths(rawStack) : undefined;
      lines.push('');
      lines.push(`### ⚠️ Error Context`);
      lines.push(`- **Message**: \`${msg}\``);
      if (stack) {
        lines.push('```');
        lines.push(stack);
        lines.push('```');
      }
    }

    if (options.userNotes) {
      lines.push('');
      lines.push(`### 📝 User Notes`);
      lines.push(sanitizePaths(options.userNotes));
    }

    if (options.includeMap !== false && engine) {
      const asciiMap = this.generateAsciiMap(engine, options.mapRadius ?? 5);
      if (asciiMap) {
        lines.push('');
        lines.push(`### 🗺️ Surrounding Area`);
        lines.push('```text');
        lines.push(asciiMap);
        lines.push('```');
      }
    }

    return lines.join('\n');
  }

  public generatePackage(
    engine?: GameEngine,
    profile?: CharacterProfile,
    options: DiagnosticPackageOptions = {}
  ): DiagnosticPackage {
    const now = new Date();
    const dpr = options.devicePixelRatio ?? 1;
    const winW = options.viewportWidth ?? 960;
    const winH = options.viewportHeight ?? 600;
    const userAgent = options.userAgent ?? 'Headless / Pure Engine';
    const category = options.category;
    const subject = options.subject;

    // Scoped defaults to avoid massive data dumps:
    // Visual & UI: omit save snapshot and ascii map unless requested
    // Items & Inventory: omit ascii map and heavy entity lists unless requested
    let includeSnapshot = options.includeSnapshot;
    let includeMap = options.includeMap;
    if (includeSnapshot === undefined && category) {
      if (category === 'Visual & UI' || category === 'Items & Inventory') {
        includeSnapshot = false;
      } else if (category === 'Crash / Freeze') {
        includeSnapshot = true;
      }
    }
    if (includeMap === undefined && category) {
      if (category === 'Visual & UI' || category === 'Items & Inventory') {
        includeMap = false;
      }
    }

    const events = this.getScopedFlightLog(category, options.maxEvents ?? this.capacity);
    const summary = this.generateSummary(engine, profile, {
      ...options,
      includeSnapshot,
      includeMap,
    });

    let stateSnapshot: unknown | undefined;
    if (includeSnapshot !== false && engine) {
      try {
        stateSnapshot = this.generateStateSnapshot(engine, profile) ?? undefined;
      } catch {
        stateSnapshot = undefined;
      }
    }

    const errorMsg = options.error
      ? sanitizePaths(options.error instanceof Error ? options.error.message : String(options.error))
      : undefined;

    const asciiMap =
      includeMap !== false && engine
        ? this.generateAsciiMap(engine, options.mapRadius ?? 5) ?? undefined
        : undefined;

    const p = engine?.player;
    const reproduction =
      engine && p
        ? {
            manifestId: engine.manifest?.id ?? 'core',
            floor: engine.currentFloor,
            turn: engine.turnCount,
            prngState: engine.prng ? engine.prng.getState() : undefined,
            playerCoords: { x: p.x, y: p.y },
            recentActions: this.getRecentActionSequence(15),
            reproductionHint: `Simulate floor ${engine.currentFloor} with PRNG state ${engine.prng?.getState() ?? 'unknown'} and replay the recent actions.`,
          }
        : undefined;

    const metadata: DiagnosticPackageMetadata = {
      timestamp: now.getTime(),
      isoTimestamp: now.toISOString(),
      engineVersion: '1.0.0',
      manifestId: engine?.manifest?.id ?? 'core',
      manifestName: engine?.manifest?.name ?? 'Roguelike Game Engine',
      turnCount: engine?.turnCount,
      floor: engine?.currentFloor,
      prngState: engine?.prng ? engine.prng.getState() : undefined,
      error: errorMsg,
      userAgent,
      display: `${winW}x${winH}@${dpr}x`,
      category,
      subject,
    };

    const markdownReport = this.generateReport(engine, profile, {
      ...options,
      includeSnapshot,
      includeMap,
    });

    return {
      metadata,
      summary,
      asciiMap,
      flightLog: events,
      stateSnapshot,
      reproduction,
      markdownReport,
    };
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

    const events = this.getScopedFlightLog(options.category, options.maxEvents ?? this.capacity);
    const firstEventTime = events.length > 0 ? events[0].timestamp : now.getTime();

    const lines: string[] = [];

    lines.push(`# ${engine?.manifest?.name ?? 'Roguelike Game Engine'} - Diagnostic Flight Report`);
    lines.push(`Generated: **${isoTimestamp}** | Epoch: \`${now.getTime()}\``);
    if (options.subject || options.category) {
      lines.push(`- **Subject**: ${options.subject ?? 'Bug Report'}`);
      lines.push(`- **Category**: \`${options.category ?? 'General'}\``);
    }
    lines.push('');

    if (options.userNotes) {
      lines.push('### 📝 Playtester Notes');
      lines.push(`> ${sanitizePaths(options.userNotes)}`);
      lines.push('');
    }

    if (options.error) {
      const err = options.error;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const msg = sanitizePaths(rawMsg);
      const rawStack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : undefined;
      const stack = rawStack ? sanitizePaths(rawStack) : undefined;
      lines.push('### ⚠️ Error Context');
      lines.push(`- **Message**: \`${msg}\``);
      if (stack) {
        lines.push('```');
        lines.push(stack);
        lines.push('```');
      }
      lines.push('');
    }

    // 1. System Telemetry
    lines.push('## 1. System Telemetry');
    lines.push(`- **Content Manifest**: \`${engine?.manifest?.id ?? 'none'}\` (${engine?.manifest?.name ?? 'no manifest loaded'})`);
    lines.push(`- **Engine Version**: \`1.0.0\` (Architecture: Swappable Manifest + RLE V2)`);
    lines.push(`- **Display / Viewport**: ${winW}x${winH} (DPR: \`${dpr}\`)`);
    lines.push(`- **User Agent**: \`${userAgent}\``);
    lines.push(`- **Buffered Events**: ${events.length} / ${this.capacity}`);
    lines.push('');

    // AI Reproduction Context
    if (engine && engine.player) {
      const p = engine.player;
      const recentActions = this.getRecentActionSequence(10);
      lines.push('### 🤖 AI Agent Reproduction Context (Claude Code & Antigravity)');
      lines.push(`- **Target Manifest**: \`${engine.manifest?.id ?? 'cotw'}\` | **Floor**: \`${engine.currentFloor}\` | **Turn**: \`${engine.turnCount}\``);
      lines.push(`- **PRNG State**: \`${engine.prng ? engine.prng.getState() : 'unknown'}\``);
      lines.push(`- **Player Coordinates**: \`(${p.x}, ${p.y})\``);
      if (recentActions.length > 0) {
        lines.push('- **Recent Actions**:');
        for (let i = 0; i < recentActions.length; i++) {
          lines.push(`  ${i + 1}. \`${recentActions[i]}\``);
        }
      }
      lines.push(`- **Reproduction Hint**: Replay the actions above on floor \`${engine.currentFloor}\` with PRNG state \`${engine.prng ? engine.prng.getState() : 'unknown'}\`.`);
      lines.push('');
    }

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
        const detailsStr = ev.details ? safeJsonStringify(ev.details) : '';
        const sanitizedDetails = detailsStr.length > 60 ? detailsStr.slice(0, 57) + '...' : detailsStr;
        lines.push(`| #${ev.id} | +${deltaMs}ms | \`${ev.type}\` | ${ev.summary} | \`${sanitizedDetails}\` |`);
      }
    }
    lines.push('');

    // 5. Reproducible State Snapshot
    if (options.includeSnapshot !== false && engine) {
      lines.push('## 5. Reproducible State Snapshot');
      try {
        const saveData = this.generateStateSnapshot(engine, profile);
        const jsonSnapshot = safeJsonStringify(saveData);
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
