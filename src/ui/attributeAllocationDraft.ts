import {
  RUNE_TOTAL_POINTS_CAP,
  RUNE_TRACK_MAX,
  allocateRuneMastery,
  getTotalRuneMasteryPoints,
  type Player,
  type RuneOfReturnMastery,
  type RuneOfReturnTrack,
} from '../engine';

export type AttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence';
/** Anything a level's points can buy: an attribute or a Rune of Return track rank. */
export type PlanKey = AttributeKey | RuneOfReturnTrack;

export const ATTRIBUTE_KEYS: AttributeKey[] = ['strength', 'dexterity', 'constitution', 'intelligence'];
export const RUNE_TRACKS: RuneOfReturnTrack[] = ['celerity', 'weave', 'mobility'];

const RUNE_FIELD: Record<RuneOfReturnTrack, keyof RuneOfReturnMastery> = {
  celerity: 'celerityPoints',
  weave: 'weavePoints',
  mobility: 'mobilityPoints',
};

const PLAN_LABEL: Record<PlanKey, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  celerity: 'Channel Celerity',
  weave: 'Steadfast Weave',
  mobility: 'Unbound Casting',
};

const isRuneTrack = (key: PlanKey): key is RuneOfReturnTrack => (RUNE_TRACKS as string[]).includes(key);

type DraftOp = { op: 'add' | 'remove'; key: PlanKey };

function emptyPending(): Record<PlanKey, number> {
  return { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, celerity: 0, weave: 0, mobility: 0 };
}

/** A track's rank now, before anything planned. */
export function runeRank(player: Player, track: RuneOfReturnTrack): number {
  return player.runeMastery[RUNE_FIELD[track]];
}

/**
 * Staged spending of a level's points, for the Character tab. Points are only planned
 * here — the player is untouched until `commit()` — so this session's points can be
 * shuffled freely, but a point locked in earlier (including one that unlocked an
 * attribute milestone or a rune rank) can never be taken back. Committing goes through
 * the same calls as before: `Player.allocateAttribute` and `allocateRuneMastery`.
 */
export class AttributeAllocationDraft {
  private pending = emptyPending();
  private undoStack: DraftOp[] = [];
  private redoStack: DraftOp[] = [];

  public clear(): void {
    this.pending = emptyPending();
    this.undoStack = [];
    this.redoStack = [];
  }

  public get(key: PlanKey): number {
    return this.pending[key];
  }

  public get total(): number {
    return (Object.keys(this.pending) as PlanKey[]).reduce((sum, key) => sum + this.pending[key], 0);
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Points still free to plan, given the player's unspent pool. */
  public remaining(player: Player): number {
    return Math.max(0, player.unspentStatPoints - this.total);
  }

  /** Whether one more point can go into `key`: a free point, and for a rune track, room
   *  under its rank cap and the tree's total cap. */
  public canAdd(key: PlanKey, player: Player): boolean {
    if (this.remaining(player) <= 0) return false;
    if (!isRuneTrack(key)) return true;
    const plannedRunes = RUNE_TRACKS.reduce((sum, t) => sum + this.pending[t], 0);
    return (
      runeRank(player, key) + this.pending[key] < RUNE_TRACK_MAX[key] &&
      getTotalRuneMasteryPoints(player.runeMastery) + plannedRunes < RUNE_TOTAL_POINTS_CAP
    );
  }

  public add(key: PlanKey, player: Player): boolean {
    if (!this.canAdd(key, player)) return false;
    this.apply({ op: 'add', key });
    this.undoStack.push({ op: 'add', key });
    this.redoStack = [];
    return true;
  }

  public remove(key: PlanKey): boolean {
    if (this.pending[key] <= 0) return false;
    this.apply({ op: 'remove', key });
    this.undoStack.push({ op: 'remove', key });
    this.redoStack = [];
    return true;
  }

  public undo(): boolean {
    const op = this.undoStack.pop();
    if (!op) return false;
    this.apply({ op: op.op === 'add' ? 'remove' : 'add', key: op.key });
    this.redoStack.push(op);
    return true;
  }

  public redo(player: Player): boolean {
    const op = this.redoStack[this.redoStack.length - 1];
    if (!op) return false;
    if (op.op === 'add' && !this.canAdd(op.key, player)) return false;
    this.redoStack.pop();
    this.apply(op);
    this.undoStack.push(op);
    return true;
  }

  public reset(): boolean {
    if (this.total === 0 && this.undoStack.length === 0) return false;
    this.clear();
    return true;
  }

  /** Locks the planned points into the player. Returns how many points were spent. */
  public commit(player: Player): number {
    let spent = 0;
    for (const attr of ATTRIBUTE_KEYS) {
      const amount = Math.min(this.pending[attr], player.unspentStatPoints);
      if (amount > 0 && player.allocateAttribute(attr, amount)) {
        spent += amount;
      }
    }
    for (const track of RUNE_TRACKS) {
      const amount = Math.min(this.pending[track], player.unspentStatPoints);
      if (amount > 0 && allocateRuneMastery(player, track, amount)) {
        spent += amount;
      }
    }
    this.clear();
    return spent;
  }

  /** Human-readable summary of what is planned, e.g. "+2 STR, +1 CON, +1 Channel Celerity". */
  public describe(): string {
    return (Object.keys(this.pending) as PlanKey[])
      .filter((key) => this.pending[key] > 0)
      .map((key) => `+${this.pending[key]} ${PLAN_LABEL[key]}`)
      .join(', ');
  }

  private apply(op: DraftOp): void {
    this.pending[op.key] += op.op === 'add' ? 1 : -1;
  }
}
