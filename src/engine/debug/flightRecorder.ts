import type { GameEngine } from '../engine';
import type { CharacterProfile } from '../storage/types';
import { getPlayerTotalCp } from '../economy/currency';
import { safeJsonStringify } from '../storage/safeJson';
import { sanitizePaths } from './sanitizer';
export { sanitizePaths } from './sanitizer';
import type { Action } from '../actions/action';
import { describeAction, formatTrailEntry } from './actionTrail';
import type {
  BugReportScope,
  FlightEvent,
  FlightEventType,
  DiagnosticReportOptions,
  DiagnosticPackage,
  DiagnosticPackageOptions,
  DiagnosticPackageMetadata,
  ReplayCheckpoint,
  ReplayData,
  TrailEntry,
} from './types';

/** Player actions whose class name marks them as item handling, for scoping. */
const ITEM_ACTION = /PickUp|Drop|Equip|Loot|Store|Drink|Read|Zap|Identify|Curse|Vault|Deposit|Withdraw/;
/** Player actions that move the hero or change the floor, for scoping. */
const MAP_ACTION = /Movement|Stairs|Door|Search|Disarm|Portal|Projection|Rest|Wait/;
/** Player actions that attack or cast, for scoping. */
const COMBAT_ACTION = /Attack|Spell|Zap|Ranged|WindUp/;

/** A new checkpoint is taken once the trail since the last one reaches this length. */
const TRAIL_CAPACITY = 250;

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

  // Replay: a save taken at an action boundary, and every player action since.
  private trail: TrailEntry[] = [];
  private checkpoint: (Omit<ReplayCheckpoint, 'save'> & { save: string }) | null = null;
  private checkpointEngine: GameEngine | null = null;
  private pendingCheckpointReason: string | null = 'session start';
  private nextTrailSeq = 1;

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
    if (category === 'floor_transition') {
      // The floor changes mid-action; checkpoint before the next action, at a clean boundary.
      this.requestCheckpoint('floor entry');
    }
    return this.record({
      type: 'state',
      summary: `[${category}] ${message}`,
      details: { category, message, ...details },
    });
  }

  /**
   * Asks for a fresh replay checkpoint before the next player action. Call it after any
   * state change that doesn't go through `handlePlayerAction` (triage tools, floor changes),
   * since replaying the trail can't reproduce those.
   */
  public requestCheckpoint(reason: string): void {
    this.pendingCheckpointReason = reason;
  }

  /**
   * Records a player action as `handlePlayerAction` received it, before it runs. Takes the
   * checkpoint first when one is due, so checkpoint + trail always replay from a boundary.
   * Never throws: diagnostics must not break a turn.
   */
  public recordPlayerAction(action: Action, engine: GameEngine): void {
    try {
      if (engine !== this.checkpointEngine) {
        this.pendingCheckpointReason ??= 'game loaded';
      } else if (this.trail.length >= TRAIL_CAPACITY) {
        this.pendingCheckpointReason ??= `trail reached ${TRAIL_CAPACITY} actions`;
      }
      if (this.pendingCheckpointReason !== null) {
        this.takeCheckpoint(engine, this.pendingCheckpointReason);
      }
      const { action: name, params } = describeAction(action);
      this.trail.push({ seq: this.nextTrailSeq++, turn: engine.turnCount, floor: engine.currentFloor, action: name, params });
    } catch {
      // A checkpoint that fails to serialize leaves no replay data rather than a wrong one.
      this.checkpoint = null;
      this.trail = [];
    }
  }

  private takeCheckpoint(engine: GameEngine, reason: string): void {
    this.pendingCheckpointReason = null;
    this.checkpointEngine = engine;
    this.trail = [];
    this.checkpoint = null;
    const save = this.generateStateSnapshot(engine);
    if (save === null) return;
    this.checkpoint = {
      reason,
      turn: engine.turnCount,
      floor: engine.currentFloor,
      save: safeJsonStringify(save),
    };
  }

  /** The current checkpoint and the actions since it, or null if none was taken. */
  public getReplayData(): ReplayData | null {
    if (!this.checkpoint) return null;
    return {
      checkpoint: { ...this.checkpoint, save: JSON.parse(this.checkpoint.save) as unknown },
      trail: this.trail.map((e) => ({ ...e, params: { ...e.params } })),
    };
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
    // slice(-0) is the whole array; zero means none.
    return count > 0 ? this.buffer.slice(-count) : [];
  }

  /**
   * The most recent player actions, oldest first, with their parameters
   * (`MovementAction dx=1 dy=0`). Falls back to the logged action names when no trail
   * has been recorded.
   */
  public getRecentActionSequence(max = 15): string[] {
    if (this.trail.length > 0) {
      return this.trail.slice(-max).map((e) => formatTrailEntry(e));
    }
    return this.buffer
      .filter((e) => e.type === 'state' && e.details?.category === 'action' && e.details.action)
      .slice(-max)
      .map((e) => String(e.details?.action));
  }

  /**
   * The flight log narrowed to what a report's scope needs. Errors and warnings are always
   * kept. With no scope (or crash/balance/other) the whole log is returned.
   */
  public getScopedFlightLog(scope?: BugReportScope, maxEvents?: number): FlightEvent[] {
    const limit = maxEvents ?? this.capacity;
    if (limit <= 0) return [];
    const actionName = (e: FlightEvent): string =>
      e.type === 'state' && e.details?.category === 'action' ? String(e.details.action ?? '') : '';
    let keep: ((e: FlightEvent) => boolean) | null = null;
    switch (scope) {
      case 'combat':
        keep = (e) => e.type === 'combat' || e.type === 'spell' || COMBAT_ACTION.test(actionName(e)) || MAP_ACTION.test(actionName(e));
        break;
      case 'items':
        keep = (e) => ITEM_ACTION.test(actionName(e)) || (e.type === 'state' && e.details?.category === 'loot_spawn');
        break;
      case 'map':
        keep = (e) => MAP_ACTION.test(actionName(e)) || (e.type === 'state' && e.details?.category === 'floor_transition');
        break;
      case 'visual':
        keep = (e) => e.type === 'input';
        break;
      default:
        keep = null;
    }
    const events = keep ? this.buffer.filter((e) => e.type === 'error' || e.type === 'warning' || keep(e)) : this.buffer;
    return events.slice(-limit);
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
    lines.push(`- **Build**: \`${options.appVersion ?? 'unknown'}\` (commit \`${options.buildId ?? 'unknown'}\`) | **Display**: ${winW}x${winH} (DPR: \`${dpr}\`)`);
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
    const resolved = this.resolveSections(options);

    const events = this.getScopedFlightLog(options.scope, options.maxEvents ?? this.capacity);
    const summary = this.generateSummary(engine, profile, resolved);

    let stateSnapshot: unknown | undefined;
    if (resolved.includeSnapshot && engine) {
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
      resolved.includeMap && engine
        ? this.generateAsciiMap(engine, options.mapRadius ?? 5) ?? undefined
        : undefined;

    const p = engine?.player;
    const replay = resolved.includeReplay ? this.getReplayData() ?? undefined : undefined;
    const reproduction =
      engine && p
        ? {
            manifestId: engine.manifest?.id ?? 'core',
            floor: engine.currentFloor,
            turn: engine.turnCount,
            prngState: engine.prng ? engine.prng.getState() : undefined,
            playerCoords: { x: p.x, y: p.y },
            recentActions: this.getRecentActionSequence(15),
            replay,
            reproductionHint: this.reproductionHint(replay),
          }
        : undefined;

    const metadata: DiagnosticPackageMetadata = {
      timestamp: now.getTime(),
      isoTimestamp: now.toISOString(),
      engineVersion: options.appVersion ?? 'unknown',
      buildId: options.buildId,
      manifestId: engine?.manifest?.id ?? 'core',
      manifestName: engine?.manifest?.name ?? 'Roguelike Game Engine',
      turnCount: engine?.turnCount,
      floor: engine?.currentFloor,
      prngState: engine?.prng ? engine.prng.getState() : undefined,
      error: errorMsg,
      userAgent,
      display: `${winW}x${winH}@${dpr}x`,
      category,
      scope: options.scope,
      subject,
    };

    const markdownReport = this.generateReport(engine, profile, resolved);

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
   * Fills in the sections a scope leaves out by default; explicit options always win.
   * Visual and item reports skip the map and save; everything else carries them.
   */
  private resolveSections(options: DiagnosticPackageOptions): DiagnosticPackageOptions & {
    includeSnapshot: boolean;
    includeMap: boolean;
    includeReplay: boolean;
  } {
    const lean = options.scope === 'visual' || options.scope === 'items';
    const includeSnapshot = options.includeSnapshot ?? !lean;
    const includeMap = options.includeMap ?? !lean;
    const includeReplay = options.includeReplay ?? includeSnapshot;
    return { ...options, includeSnapshot, includeMap, includeReplay };
  }

  private reproductionHint(replay: ReplayData | undefined): string {
    if (!replay) {
      return 'No replay data in this report; load the state snapshot, if present, to inspect the final state.';
    }
    return (
      `Load the checkpoint save (turn ${replay.checkpoint.turn}, floor ${replay.checkpoint.floor}, taken on ` +
      `${replay.checkpoint.reason}) and replay the ${replay.trail.length} trail action(s) in order through ` +
      'handlePlayerAction: loadReplayState() + replayActionTrail() in src/engine/debug/replay.ts, or ' +
      'F2 > Triage > Load State From Report. Changes made outside player actions (shop trades, level-up ' +
      'stat choices, dialog choices) are not in the trail; if the replay diverges, one of those happened.'
    );
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

    const resolved = this.resolveSections(options);
    const events = this.getScopedFlightLog(options.scope, options.maxEvents ?? this.capacity);
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
    lines.push(`- **Build**: \`${options.appVersion ?? 'unknown'}\` (commit \`${options.buildId ?? 'unknown'}\`)`);
    lines.push(`- **Display / Viewport**: ${winW}x${winH} (DPR: \`${dpr}\`)`);
    lines.push(`- **User Agent**: \`${userAgent}\``);
    lines.push(`- **Buffered Events**: ${events.length} / ${this.capacity}`);
    lines.push('');

    // Reproduction context
    const replay = resolved.includeReplay ? this.getReplayData() ?? undefined : undefined;
    if (engine && engine.player) {
      const p = engine.player;
      const recentActions = this.getRecentActionSequence(15);
      lines.push('### 🤖 Reproduction Context');
      lines.push(`- **Manifest**: \`${engine.manifest?.id ?? 'core'}\` | **Floor**: \`${engine.currentFloor}\` | **Turn**: \`${engine.turnCount}\` | **Player**: \`(${p.x}, ${p.y})\``);
      lines.push(`- **PRNG State (at report time)**: \`${engine.prng ? engine.prng.getState() : 'unknown'}\``);
      if (recentActions.length > 0) {
        lines.push('- **Recent Player Actions** (oldest first):');
        for (let i = 0; i < recentActions.length; i++) {
          lines.push(`  ${i + 1}. \`${recentActions[i]}\``);
        }
      }
      lines.push(`- **How to Reproduce**: ${this.reproductionHint(replay)}`);
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
      lines.push(options.maxEvents === 0 ? '*(Flight log not included in this report)*' : '*(No telemetry events recorded yet)*');
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

    // 5. Replay data, or the final state when there is none
    if (replay) {
      lines.push(`## 5. Replay Data (checkpoint + ${replay.trail.length} actions)`);
      lines.push('```json');
      lines.push(safeJsonStringify(replay));
      lines.push('```');
      lines.push('');
    } else if (resolved.includeSnapshot && engine) {
      lines.push('## 5. State Snapshot (at report time)');
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
