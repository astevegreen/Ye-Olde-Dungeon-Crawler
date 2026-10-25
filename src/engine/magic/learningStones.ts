import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import type { Action } from '../actions/action';
import type { GameMap } from '../grid/map';
import type { Item } from '../items/item';
import type { ActionResult, Position } from '../types';
import { BASE_ACTION_COST } from '../types';
import { Visibility } from '../fov/types';
import { createScaledItem } from '../dungeon/lootSpawner';
import { getSpell } from './spellRegistry';
import { formatMagicMessage, type LearningStoneConfig, type LearningStoneDefinition } from './magicConfig';

/**
 * Shard and stone (P-34): a stone stands on some floors, and one of the floor's monsters,
 * deep asleep, carries its shard. Holding the shard marks the stone; setting it there shows
 * two spells the hero doesn't know, to read one. A kill by the carrier kind's rite is the
 * shortcut: the card opens on the spot and the spell costs less for the run. A shard still
 * held on leaving the floor becomes an Essence-Rune. The engine knows shards and stones,
 * never what a pack calls them (`manifest.magic.learningStones`).
 */

/** One floor's stone, as the hero has met it. */
export interface StoneRecord {
  floor: number;
  /** The faces drawn the first time the card opened; the same faces show again. */
  faces?: string[];
  /** Stepped on without its shard, which names the carrier once. */
  found?: boolean;
  /** The carrier fell to its rite: the shard is in hand, readable anywhere on the floor. */
  shortcut?: boolean;
  /** Read, or its shard turned into a rune: the stone teaches no more. */
  spent?: boolean;
}

export interface LearningStoneState {
  /** Spells shown on a face this run, in the order shown. */
  shown: string[];
  /** What a spell read through a shortcut costs, as a share of its price. */
  costShares: Record<string, number>;
  stones: StoneRecord[];
}

export function createLearningStoneState(): LearningStoneState {
  return { shown: [], costShares: {}, stones: [] };
}

export function copyLearningStoneState(state: LearningStoneState): LearningStoneState {
  return {
    shown: [...state.shown],
    costShares: { ...state.costShares },
    stones: state.stones.map((s) => ({ ...s, faces: s.faces ? [...s.faces] : undefined })),
  };
}

/** The state as saved; absent when the hero has met no stone. */
export function serializeLearningStoneState(state: LearningStoneState): LearningStoneState | undefined {
  if (state.shown.length === 0 && state.stones.length === 0 && Object.keys(state.costShares).length === 0) return undefined;
  return copyLearningStoneState(state);
}

/** Reads saved state defensively: a malformed entry is dropped, never thrown on. */
export function readLearningStoneState(raw: unknown): LearningStoneState {
  const state = createLearningStoneState();
  if (!raw || typeof raw !== 'object') return state;
  const r = raw as Record<string, unknown>;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : []);
  state.shown = strings(r.shown);
  if (r.costShares && typeof r.costShares === 'object') {
    for (const [id, share] of Object.entries(r.costShares as Record<string, unknown>)) {
      if (typeof share === 'number' && share > 0) state.costShares[id] = share;
    }
  }
  if (Array.isArray(r.stones)) {
    for (const e of r.stones) {
      if (!e || typeof e !== 'object' || !Number.isInteger((e as StoneRecord).floor)) continue;
      const s = e as Record<string, unknown>;
      const record: StoneRecord = { floor: s.floor as number };
      if (Array.isArray(s.faces)) record.faces = strings(s.faces);
      if (s.found === true) record.found = true;
      if (s.shortcut === true) record.shortcut = true;
      if (s.spent === true) record.spent = true;
      state.stones.push(record);
    }
  }
  return state;
}

/** The share of its price a spell costs this caster for having been read through a shortcut; 1 otherwise. */
export function learnedCostShare(caster: Entity, spellId: string | undefined): number {
  if (!spellId) return 1;
  const state = (caster as Partial<Pick<Player, 'learningStones'>>).learningStones;
  return state?.costShares[spellId] ?? 1;
}

export function getLearningStoneConfig(engine: Pick<GameEngine, 'manifest'>): LearningStoneConfig | undefined {
  return engine.manifest?.magic?.learningStones;
}

/** The stone the pack declares for `floor`, if any. */
export function stoneDefinitionFor(config: LearningStoneConfig, floor: number): LearningStoneDefinition | undefined {
  return config.stones.find((s) => s.floor === floor);
}

function stoneTileId(config: LearningStoneConfig, def: LearningStoneDefinition): string {
  return def.tileId ?? config.tileId;
}

function recordFor(player: Player, floor: number): StoneRecord | undefined {
  return player.learningStones.stones.find((s) => s.floor === floor);
}

function ensureRecord(player: Player, floor: number): StoneRecord {
  let record = recordFor(player, floor);
  if (!record) {
    record = { floor };
    player.learningStones.stones.push(record);
  }
  return record;
}

const stoneSites = new WeakMap<GameMap, { tileId: string; at: Position | null }>();

/** Where the current floor's stone stands, if the floor has one. */
export function findLearningStone(engine: Pick<GameEngine, 'manifest' | 'map' | 'currentFloor'>): Position | undefined {
  const config = getLearningStoneConfig(engine);
  const def = config && stoneDefinitionFor(config, engine.currentFloor);
  if (!config || !def) return undefined;
  const tileId = stoneTileId(config, def);
  const cached = stoneSites.get(engine.map);
  if (cached && cached.tileId === tileId) return cached.at ?? undefined;
  let at: Position | null = null;
  for (let y = 0; y < engine.map.height && !at; y++) {
    for (let x = 0; x < engine.map.width; x++) {
      if (engine.map.getTile(x, y)?.type === tileId) {
        at = { x, y };
        break;
      }
    }
  }
  stoneSites.set(engine.map, { tileId, at });
  return at ?? undefined;
}

function isShard(config: LearningStoneConfig, item: Item): boolean {
  return item.definitionId === config.shardItemId;
}

/** True when `monster` carries a stone's shard. */
export function carriesShard(engine: Pick<GameEngine, 'manifest'>, monster: Entity): boolean {
  const config = getLearningStoneConfig(engine);
  return !!config && monster instanceof Monster && monster.getItems().some((i) => isShard(config, i));
}

/** The living monster carrying this floor's shard, if one does. */
export function stoneCarrier(engine: GameEngine): Monster | undefined {
  return engine.map
    .getAllEntities()
    .find((e): e is Monster => e instanceof Monster && e.isAlive() && carriesShard(engine, e));
}

function heldShard(engine: GameEngine, config: LearningStoneConfig): Item | undefined {
  return engine.player.inventory.getAllCarriedItems().find((i) => isShard(config, i));
}

/** True when the hero can set this floor's shard: carried, or in hand from a shortcut. */
export function holdsStoneShard(engine: GameEngine): boolean {
  const config = getLearningStoneConfig(engine);
  if (!config || !stoneDefinitionFor(config, engine.currentFloor)) return false;
  const record = recordFor(engine.player, engine.currentFloor);
  if (record?.spent) return false;
  return !!record?.shortcut || !!heldShard(engine, config);
}

function spellFor(engine: GameEngine, id: string) {
  return engine.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id);
}

function stoneName(engine: GameEngine): string {
  const at = findLearningStone(engine);
  return (at && engine.map.getTile(at.x, at.y)?.name) || 'the stone';
}

/** A spell the hero could still learn: not known, not forgotten, not waiting for a slot. */
function learnable(engine: GameEngine, id: string): boolean {
  const player = engine.player;
  return (
    !player.spellsKnown.includes(id) &&
    !(player.grimoireState?.forgotten.includes(id) ?? false) &&
    !player.pendingSpellOffers.includes(id) &&
    !!spellFor(engine, id)
  );
}

/**
 * The card's faces for this floor's stone, drawn the first time and kept: two spells the hero
 * doesn't know, at least one not yet shown this run while its zone (or, when that runs out, a
 * later one) has any; the other from the zone or a spell passed over before. One face when
 * one spell is left, none when none is (the shard then gives a rune). Draws on `engine.prng`.
 */
export function drawStoneFaces(engine: GameEngine): string[] {
  const config = getLearningStoneConfig(engine);
  const def = config && stoneDefinitionFor(config, engine.currentFloor);
  if (!config || !def) return [];
  const state = engine.player.learningStones;
  const record = ensureRecord(engine.player, engine.currentFloor);
  if (!record.faces) {
    record.faces = def.faces ? def.faces.filter((id) => learnable(engine, id)).slice(0, 2) : drawFaces(engine, config);
    for (const id of record.faces) if (!state.shown.includes(id)) state.shown.push(id);
  }
  return record.faces.filter((id) => learnable(engine, id));
}

function drawFaces(engine: GameEngine, config: LearningStoneConfig): string[] {
  const floor = engine.currentFloor;
  const shown = engine.player.learningStones.shown;
  const zones = [...config.zones].sort((a, b) => a.minFloor - b.minFloor);
  const here = Math.max(0, zones.findIndex((z) => floor >= z.minFloor && floor <= z.maxFloor));
  const unique = (ids: string[]) => [...new Set(ids)];
  const all = unique(zones.flatMap((z) => z.spellIds)).filter((id) => learnable(engine, id));
  if (all.length === 0) return [];
  const zoneSpells = (z: number) => zones[z].spellIds.filter((id) => all.includes(id));
  // Fresh: unshown spells of this zone, else of the nearest later zone that has any.
  let fresh: string[] = [];
  for (let z = here; z < zones.length && fresh.length === 0; z++) fresh = zoneSpells(z).filter((id) => !shown.includes(id));
  const passedOver = all.filter((id) => shown.includes(id));
  const first = engine.prng.choice(fresh.length > 0 ? fresh : passedOver.length > 0 ? passedOver : all);
  const without = (ids: string[]) => unique(ids).filter((id) => id !== first);
  const pools = [
    without([...(zones.length > 0 ? zoneSpells(here) : []), ...passedOver]),
    without(fresh),
    without(zones.slice(here + 1).flatMap((_, i) => zoneSpells(here + 1 + i))),
    without(all),
  ];
  const pool = pools.find((p) => p.length > 0);
  return pool ? [first, engine.prng.choice(pool)] : [first];
}

/** The element of the first face that has an Essence-Rune. */
function faceElement(engine: GameEngine, record: StoneRecord | undefined): string | undefined {
  const essences = engine.manifest?.magic?.killRites?.essenceItems ?? {};
  return (record?.faces ?? []).map((id) => spellFor(engine, id)?.element).find((e): e is string => !!e && !!essences[e]);
}

function faceRuneName(engine: GameEngine, record: StoneRecord | undefined): string | undefined {
  const element = faceElement(engine, record);
  const itemId = element ? engine.manifest?.magic?.killRites?.essenceItems[element] : undefined;
  return itemId ? engine.manifest?.items?.find((i) => i.id === itemId)?.name : undefined;
}

/** The rune a shard turns into: a face's element, else a drawn one. */
function runeElement(engine: GameEngine, record: StoneRecord | undefined): string | undefined {
  const elements = Object.keys(engine.manifest?.magic?.killRites?.essenceItems ?? {}).sort();
  return faceElement(engine, record) ?? (elements.length > 0 ? engine.prng.choice(elements) : undefined);
}

/** Puts an Essence-Rune of `element` in the hero's pack, or at their feet when it is full. */
export function grantEssenceRune(engine: GameEngine, element: string | undefined): Item | undefined {
  const itemId = element ? engine.manifest?.magic?.killRites?.essenceItems[element] : undefined;
  const def = itemId ? engine.manifest?.items?.find((i) => i.id === itemId) : undefined;
  if (!itemId || !def) return undefined;
  const item = createScaledItem(def, engine.nextSimulationId(itemId), engine.currentFloor, engine.rng);
  const player = engine.player;
  if (player.inventory.primaryPack.canContain(item).allowed) player.inventory.primaryPack.addItem(item);
  else engine.map.addItemAt(player.x, player.y, item);
  return item;
}

function shardToRune(engine: GameEngine, config: LearningStoneConfig, record: StoneRecord): Item | undefined {
  record.spent = true;
  record.shortcut = undefined;
  const rune = grantEssenceRune(engine, runeElement(engine, record));
  if (rune) engine.log(formatMagicMessage(config.messages.rune, { essence: rune.displayName }));
  return rune;
}

function openCard(engine: GameEngine, shortcut: boolean): void {
  drawStoneFaces(engine);
  const at = findLearningStone(engine);
  engine.emitGameEvent({
    type: 'learning_stone_reached',
    turn: engine.turnCount,
    actorId: engine.player.id,
    data: { floor: engine.currentFloor, x: at?.x, y: at?.y, shortcut },
  });
}

/** On first arriving on a stone's floor, the log says the stone hums and names its carrier. */
export function announceLearningStone(engine: GameEngine): void {
  const config = getLearningStoneConfig(engine);
  if (!config || !stoneDefinitionFor(config, engine.currentFloor)) return;
  if (recordFor(engine.player, engine.currentFloor)) return;
  ensureRecord(engine.player, engine.currentFloor);
  const carrier = stoneCarrier(engine);
  if (!carrier || !findLearningStone(engine)) return;
  engine.log(formatMagicMessage(config.messages.arrival, { stone: stoneName(engine), monster: carrier.name }));
}

/**
 * The hero stepped onto (x, y). On the stone, with its shard, the card opens and this is
 * true; without it, the first visit names the carrier and the tile does what it otherwise does.
 */
export function stepOntoLearningStone(engine: GameEngine, x: number, y: number): boolean {
  const config = getLearningStoneConfig(engine);
  const at = config && findLearningStone(engine);
  if (!config || !at || at.x !== x || at.y !== y) return false;
  const record = ensureRecord(engine.player, engine.currentFloor);
  if (record.spent) return false;
  if (holdsStoneShard(engine)) {
    openCard(engine, false);
    return true;
  }
  if (!record.found) {
    record.found = true;
    const carrier = stoneCarrier(engine);
    if (carrier) engine.log(formatMagicMessage(config.messages.stoneFound, { stone: stoneName(engine), monster: carrier.name }));
  }
  return false;
}

/** The hero picked up `item`: the floor's shard marks its stone. */
export function notePickedUp(engine: GameEngine, item: Item): void {
  const config = getLearningStoneConfig(engine);
  if (!config || !isShard(config, item) || !findLearningStone(engine)) return;
  if (recordFor(engine.player, engine.currentFloor)?.spent) return;
  engine.log(formatMagicMessage(config.messages.shardMarks, { stone: stoneName(engine) }));
}

/**
 * The carrier fell to its kind's rite: its shard is in hand, readable anywhere on the floor
 * at a share of the price, and the card opens on the spot. Called before the death drops
 * what the carrier held, so the shard never reaches the ground.
 */
export function takeShortcut(engine: GameEngine, victim: Monster): void {
  const config = getLearningStoneConfig(engine);
  if (!config) return;
  const shard = victim.getItems().find((i) => isShard(config, i));
  if (!shard) return;
  victim.removeItem(shard);
  const record = ensureRecord(engine.player, engine.currentFloor);
  if (record.spent) return;
  record.shortcut = true;
  engine.log(formatMagicMessage(config.messages.shortcut, { monster: victim.name, stone: stoneName(engine) }));
  engine.recordVisualEffects([{ type: 'screen_flash', color: '#38bdf8', durationMs: 250 }]);
  openCard(engine, true);
}

/** Before the hero leaves a floor: its shard, still held, turns into an Essence-Rune. */
export function shardFadesOnLeaving(engine: GameEngine): void {
  const config = getLearningStoneConfig(engine);
  if (!config || !stoneDefinitionFor(config, engine.currentFloor)) return;
  const record = recordFor(engine.player, engine.currentFloor);
  if (record?.spent) return;
  const shard = heldShard(engine, config);
  if (!shard && !record?.shortcut) return;
  if (shard) engine.player.inventory.removeItem(shard.id);
  shardToRune(engine, config, record ?? ensureRecord(engine.player, engine.currentFloor));
}

/** What the card shows for this floor's stone, for presentation. */
export interface LearningStoneCard {
  stoneName: string;
  /** The spells to read, in order; empty when none is left to learn (the shard gives a rune). */
  faces: Array<{ id: string; name: string; description: string }>;
  /** Read through the shortcut: the spell will cost less. */
  shortcut: boolean;
  /** The share of its price a spell read now costs (1 without the shortcut). */
  costShare: number;
  /** What the shard becomes when no face is read, when a face's element names it. */
  runeName?: string;
}

/** The open card for this floor's stone, when the hero holds its shard; faces already drawn. */
export function learningStoneCard(engine: GameEngine): LearningStoneCard | undefined {
  const config = getLearningStoneConfig(engine);
  if (!config || !holdsStoneShard(engine)) return undefined;
  const record = recordFor(engine.player, engine.currentFloor);
  const faces = (record?.faces ?? []).filter((id) => learnable(engine, id));
  const shortcut = !!record?.shortcut;
  return {
    stoneName: stoneName(engine),
    faces: faces.map((id) => {
      const spell = spellFor(engine, id);
      return { id, name: spell?.name ?? id, description: spell?.description ?? '' };
    }),
    shortcut,
    costShare: shortcut ? (config.shortcutCostMultiplier ?? 0.9) : 1,
    runeName: faceRuneName(engine, record),
  };
}

/**
 * What the map marks for this floor's stone, and its living carrier. The stone is marked until
 * it is spent, once the hero has seen its tile or holds its shard; an unseen stone stays unmarked.
 */
export function learningStoneMarks(engine: GameEngine): { stone?: Position; carrierId?: string } {
  const config = getLearningStoneConfig(engine);
  if (!config || !stoneDefinitionFor(config, engine.currentFloor)) return {};
  const carrierId = stoneCarrier(engine)?.id;
  if (recordFor(engine.player, engine.currentFloor)?.spent) return { stone: undefined, carrierId };
  const at = findLearningStone(engine);
  const seen = !!at && engine.fov.getVisibility(at.x, at.y) !== Visibility.Unexplored;
  return { stone: seen || holdsStoneShard(engine) ? at : undefined, carrierId };
}

/**
 * Where the way to this floor's stone leads next: the stone once its shard is held (the
 * shortcut included), else the living carrier, else the tile where the shard lies. Undefined
 * on a floor without a stone, and once the stone is spent.
 */
export function learningStoneTarget(engine: GameEngine): { kind: 'carrier' | 'shard' | 'stone'; x: number; y: number } | undefined {
  const config = getLearningStoneConfig(engine);
  if (!config || !stoneDefinitionFor(config, engine.currentFloor)) return undefined;
  if (recordFor(engine.player, engine.currentFloor)?.spent) return undefined;
  const stone = findLearningStone(engine);
  if (!stone) return undefined;
  if (holdsStoneShard(engine)) return { kind: 'stone', x: stone.x, y: stone.y };
  const carrier = stoneCarrier(engine);
  if (carrier) return { kind: 'carrier', x: carrier.x, y: carrier.y };
  const ground = engine.map.getAllGroundItems().find((g) => g.items.some((i) => isShard(config, i)));
  return ground ? { kind: 'shard', x: ground.x, y: ground.y } : undefined;
}

/**
 * Reads this floor's stone: learns one of its faces (`spellId`), or turns the shard into an
 * Essence-Rune (`null`). Set at the stone, or anywhere on the floor after a shortcut.
 */
export class ReadLearningStoneAction implements Action {
  public readonly entity: Player;
  public readonly spellId: string | null;

  constructor(player: Player, spellId: string | null) {
    this.entity = player;
    this.spellId = spellId;
  }

  public perform(engine: GameEngine): ActionResult {
    const config = getLearningStoneConfig(engine);
    if (!config || !holdsStoneShard(engine)) return { success: false, cost: 0, message: 'You hold no shard for a stone here.' };
    const record = ensureRecord(this.entity, engine.currentFloor);
    const at = findLearningStone(engine);
    if (!record.shortcut && (!at || at.x !== this.entity.x || at.y !== this.entity.y)) {
      return { success: false, cost: 0, message: 'The shard must be set in its stone.' };
    }
    const faces = drawStoneFaces(engine);
    if (this.spellId !== null && !faces.includes(this.spellId)) {
      return { success: false, cost: 0, message: 'The stone shows no such spell.' };
    }

    const shortcut = !!record.shortcut;
    const shard = heldShard(engine, config);
    if (!shortcut && shard) this.entity.inventory.removeItem(shard.id);
    let message: string;
    let learnedSpell = false;
    if (this.spellId === null) {
      const rune = shardToRune(engine, config, record);
      message = rune ? formatMagicMessage(config.messages.rune, { essence: rune.displayName }) : 'The shard crumbles.';
      if (!rune) engine.log(message);
    } else {
      record.spent = true;
      record.shortcut = undefined;
      if (shortcut) this.entity.learningStones.costShares[this.spellId] = config.shortcutCostMultiplier ?? 0.9;
      const learned = this.entity.learnSpellResult(this.spellId);
      learnedSpell = learned.outcome === 'learned';
      const spell = spellFor(engine, this.spellId);
      const waiting = learned.outcome === 'full' ? ' Every slot in your grimoires is full: it waits in your spellbook until you make room.' : '';
      message = formatMagicMessage(config.messages.learned, { spell: spell?.name ?? this.spellId, stone: stoneName(engine) }) + waiting;
      engine.log(message);
    }
    // `learned` is true only for a read that put the spell in a grimoire slot: a rune, or a
    // spell left waiting because every slot is full, teaches nothing to slot yet.
    engine.emitGameEvent({
      type: 'learning_stone_read',
      turn: engine.turnCount,
      actorId: this.entity.id,
      data: { floor: engine.currentFloor, spellId: this.spellId ?? undefined, learned: learnedSpell, shortcut },
    });
    const cost = this.entity.getActionCost(BASE_ACTION_COST);
    this.entity.consumeEnergy(cost);
    return { success: true, cost, message };
  }
}
