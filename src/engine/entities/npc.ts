import { Actor } from './actor';
import type { Position } from '../types';

export type NpcRole = 'merchant' | 'priest' | 'sage' | 'banker' | 'guard' | 'villager' | 'trainer';

export interface NpcConfig {
  id: string;
  name: string;
  role: NpcRole;
  position: Position;
  shopId?: string;
  greeting?: string;
  dialogText?: string;
  isStationary?: boolean;
  /** A `manifest.choices` key: talking to this NPC opens that choice instead of the
   *  greeting. It never resolves, so the NPC can be spoken to again; its options gate
   *  themselves with predicates. */
  choiceId?: string;
}

export class NPC extends Actor {
  public readonly role: NpcRole;
  public readonly shopId?: string;
  private _greeting: string;
  private _dialogText: string;
  public readonly isStationary: boolean;
  public readonly choiceId?: string;

  constructor(config: NpcConfig) {
    const isStat = config.isStationary ?? true;
    super({
      id: config.id,
      name: config.name,
      type: 'npc',
      faction: 'neutral',
      position: config.position,
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 10 },
      speed: 100,
      strength: 15,
      capabilities: {
        canMove: !isStat,
        canAct: false,
        canBlockPath: true,
        isDestructible: false,
        blocksLos: false,
      },
    });

    this.role = config.role;
    this.shopId = config.shopId;
    this._greeting = config.greeting ?? `Greetings, traveler! Welcome to town.`;
    this._dialogText = config.dialogText ?? `The winds whisper of ancient dangers below...`;
    this.isStationary = config.isStationary ?? true;
    this.choiceId = config.choiceId;
  }

  /** What the NPC says on being greeted. */
  public get greeting(): string {
    return this._greeting;
  }

  /** What the NPC says at more length. */
  public get dialogText(): string {
    return this._dialogText;
  }

  /**
   * Changes what the NPC says, for a pack whose town answers the story (cotw's villagers
   * after the Hearth-Tear comes home). Saved with the NPC, like the lines it started with.
   */
  public setDialogue(greeting: string, dialogText: string): void {
    this._greeting = greeting;
    this._dialogText = dialogText;
  }

  public override isHostileTo(): boolean {
    return false;
  }
}
