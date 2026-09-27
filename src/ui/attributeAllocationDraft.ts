import type { Player } from '../engine';

export type AttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence';

const ATTRIBUTE_KEYS: AttributeKey[] = ['strength', 'dexterity', 'constitution', 'intelligence'];

type DraftOp = { op: 'add' | 'remove'; attr: AttributeKey };

function emptyPending(): Record<AttributeKey, number> {
  return { strength: 0, dexterity: 0, constitution: 0, intelligence: 0 };
}

/**
 * Staged attribute allocation shared by the level-up modal and the character sheet.
 * Points are only planned here — the player is untouched until `commit()` — so a
 * player can shuffle this session's points freely, but can never take back a point
 * that was already locked in (including one that unlocked an attribute milestone).
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

  public get(attr: AttributeKey): number {
    return this.pending[attr];
  }

  public get total(): number {
    return ATTRIBUTE_KEYS.reduce((sum, key) => sum + this.pending[key], 0);
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

  public add(attr: AttributeKey, player: Player): boolean {
    if (this.remaining(player) <= 0) return false;
    this.apply({ op: 'add', attr });
    this.undoStack.push({ op: 'add', attr });
    this.redoStack = [];
    return true;
  }

  public remove(attr: AttributeKey): boolean {
    if (this.pending[attr] <= 0) return false;
    this.apply({ op: 'remove', attr });
    this.undoStack.push({ op: 'remove', attr });
    this.redoStack = [];
    return true;
  }

  public undo(): boolean {
    const op = this.undoStack.pop();
    if (!op) return false;
    this.apply({ op: op.op === 'add' ? 'remove' : 'add', attr: op.attr });
    this.redoStack.push(op);
    return true;
  }

  public redo(player: Player): boolean {
    const op = this.redoStack[this.redoStack.length - 1];
    if (!op) return false;
    if (op.op === 'add' && this.remaining(player) <= 0) return false;
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
    this.clear();
    return spent;
  }

  /** Human-readable summary of what is planned, e.g. "+2 STR, +1 CON". */
  public describe(): string {
    return ATTRIBUTE_KEYS.filter((attr) => this.pending[attr] > 0)
      .map((attr) => `+${this.pending[attr]} ${attr.slice(0, 3).toUpperCase()}`)
      .join(', ');
  }

  private apply(op: DraftOp): void {
    this.pending[op.attr] += op.op === 'add' ? 1 : -1;
  }
}
