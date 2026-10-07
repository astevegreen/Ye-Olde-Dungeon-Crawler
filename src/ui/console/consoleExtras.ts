import type { Entity, GameEngine } from '../../engine';
import { iconElement } from '../icons';
import {
  getCompanionCard,
  getObjectiveLine,
  getTrayChips,
  resolveContextAction,
  type ContextAction,
  type TrayChipAction,
} from './consoleModel';

export interface ConsoleExtrasOptions {
  onContextAction: (action: ContextAction) => void;
  onChip: (action: TrayChipAction) => void;
  /** Points the map at a tile (the companion card on hover), or clears it with nulls. */
  onPointAt: (x: number | null, y: number | null) => void;
  drawEntityIcon: (canvas: HTMLCanvasElement, entity: Entity) => void;
  /** The key bound to the context action, e.g. "F". */
  contextKey: () => string;
  /** The label of the key bound to an action, for the tooltips that name one (R-ui-16). */
  keyFor: (actionId: string) => string | undefined;
  /** Who awakens a dormant rune (the pack's rune-smith), for its chip's tooltip. */
  smithName: () => string;
}

/**
 * The action console's situational parts, in the order they matter: the context
 * action button left of the spell belt, a tray of status chips and the companion
 * card to its right (each shown only while relevant), and the objective line
 * under the belt, which is the first thing to go when the console is narrow.
 */
export class ConsoleExtras {
  private readonly contextBtn: HTMLButtonElement;
  private readonly tray: HTMLElement;
  private readonly chipsRow: HTMLElement;
  private readonly companionSlot: HTMLElement;
  private readonly objective: HTMLElement;
  private action: ContextAction = { kind: 'none', verb: '', icon: null };

  constructor(private readonly options: ConsoleExtrasOptions) {
    this.contextBtn = document.createElement('button');
    this.contextBtn.type = 'button';
    this.contextBtn.id = 'context-action';
    this.contextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.action.kind !== 'none') this.options.onContextAction(this.action);
    });

    this.tray = document.createElement('div');
    this.tray.id = 'console-tray';
    this.chipsRow = document.createElement('div');
    this.chipsRow.className = 'tray-chips';
    this.companionSlot = document.createElement('div');
    this.companionSlot.className = 'tray-companion-slot';
    this.tray.append(this.chipsRow, this.companionSlot);

    this.objective = document.createElement('div');
    this.objective.id = 'console-objective';
  }

  /**
   * Places the parts in the console: the button before the centre cluster, the
   * tray after it, and the objective line at the bottom of the cluster.
   */
  public mount(console_: HTMLElement): void {
    const center = console_.querySelector('.console-center-cluster');
    if (!center) return;
    if (!console_.contains(this.contextBtn)) console_.insertBefore(this.contextBtn, center);
    if (!console_.contains(this.tray)) center.after(this.tray);
    if (!center.contains(this.objective)) center.appendChild(this.objective);
  }

  /** The action the button would take now (the context key runs it too). */
  public get currentAction(): ContextAction {
    return this.action;
  }

  public update(engine: GameEngine): void {
    if (!engine?.player) return;
    this.renderContextAction(resolveContextAction(engine, this.options.keyFor));
    this.renderTray(engine);
    this.renderObjective(engine);
  }

  private renderContextAction(action: ContextAction): void {
    this.action = action;
    const idle = action.kind === 'none';
    const key = this.options.contextKey();
    this.contextBtn.classList.toggle('context-idle', idle);
    this.contextBtn.disabled = idle;
    this.contextBtn.replaceChildren();

    const icon = document.createElement('span');
    icon.className = 'context-icon';
    if (action.icon) icon.appendChild(iconElement(action.icon));
    const text = document.createElement('span');
    text.className = 'context-text';
    const verb = document.createElement('span');
    verb.className = 'context-verb';
    verb.textContent = action.verb;
    text.appendChild(verb);
    if (action.target) {
      const target = document.createElement('span');
      target.className = 'context-target';
      target.textContent = action.target;
      text.appendChild(target);
    }
    this.contextBtn.append(icon, text);
    if (key && !idle) {
      const kbd = document.createElement('kbd');
      kbd.className = 'context-key';
      kbd.textContent = key;
      this.contextBtn.appendChild(kbd);
    }
    this.contextBtn.title = idle
      ? 'The context action: when there is something to do here (stairs, loot, a door, someone to talk to), it appears on this button.'
      : `${action.verb}${action.target ? ` ${action.target}` : ''} — ${key || 'click'}${action.nativeKey ? ` (or ${action.nativeKey})` : ''}`;
  }

  private renderTray(engine: GameEngine): void {
    const chips = getTrayChips(engine, this.options.smithName(), this.options.keyFor);
    this.chipsRow.replaceChildren();
    for (const chip of chips) {
      const el = document.createElement(chip.action ? 'button' : 'div');
      if (el instanceof HTMLButtonElement) {
        el.type = 'button';
        const action = chip.action as TrayChipAction;
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.options.onChip(action);
        });
      }
      el.className = 'tray-chip';
      el.style.setProperty('--chip-color', chip.color);
      el.title = chip.title;
      const icon = document.createElement('span');
      icon.className = 'tray-chip-icon';
      icon.appendChild(iconElement(chip.icon));
      const label = document.createElement('span');
      label.className = 'tray-chip-label';
      label.textContent = chip.label;
      el.append(icon, label);
      if (chip.pips) {
        const pips = document.createElement('span');
        pips.className = 'tray-pips';
        for (let i = 0; i < chip.pips.total; i++) {
          const pip = document.createElement('i');
          if (i < chip.pips.filled) pip.className = 'on';
          pips.appendChild(pip);
        }
        el.appendChild(pips);
      } else {
        const value = document.createElement('span');
        value.className = 'tray-chip-value';
        value.textContent = chip.value;
        el.appendChild(value);
      }
      this.chipsRow.appendChild(el);
    }

    this.companionSlot.replaceChildren();
    const card = getCompanionCard(engine);
    if (card) {
      const el = document.createElement('div');
      el.className = 'tray-companion';
      el.classList.toggle('tray-companion-downed', card.downed);
      const icon = document.createElement('canvas');
      icon.className = 'tray-companion-icon';
      icon.width = 32;
      icon.height = 32;
      const entity = card.downed ? engine.deadCompanionRecord : engine.companion;
      if (entity) this.options.drawEntityIcon(icon, entity);
      const body = document.createElement('div');
      body.className = 'tray-companion-body';
      const name = document.createElement('div');
      name.className = 'tray-companion-name';
      name.textContent = card.name;
      body.appendChild(name);
      if (card.downed) {
        const note = document.createElement('div');
        note.className = 'tray-companion-note';
        note.textContent = 'Downed · a trainer can revive';
        body.appendChild(note);
        el.title = `${card.name} fell in battle. A trainer in town can revive them.`;
      } else {
        const hp = document.createElement('div');
        hp.className = 'sb-hp tray-companion-hp';
        const fill = document.createElement('i');
        fill.style.width = `${Math.round((card.hp / Math.max(1, card.maxHp)) * 100)}%`;
        fill.style.background = 'linear-gradient(90deg, color-mix(in srgb, var(--ui-good) 55%, black), var(--ui-good))';
        const hpText = document.createElement('b');
        hpText.textContent = `${card.hp}/${card.maxHp}`;
        hp.append(fill, hpText);
        body.appendChild(hp);
        el.title = card.away ? `${card.name} is out of sight.` : `${card.name}: ${card.hp}/${card.maxHp} HP. Hover to find them on the map.`;
        if (card.away) name.textContent = `${card.name} · away`;
        el.addEventListener('mouseenter', () => this.options.onPointAt(card.x, card.y));
        el.addEventListener('mouseleave', () => this.options.onPointAt(null, null));
      }
      el.append(icon, body);
      this.companionSlot.appendChild(el);
    }

    this.tray.hidden = chips.length === 0 && !card;
  }

  private renderObjective(engine: GameEngine): void {
    const line = getObjectiveLine(engine);
    this.objective.hidden = !line;
    this.objective.replaceChildren();
    if (!line) return;
    const text = document.createElement('span');
    text.className = 'objective-text';
    text.textContent = line.text;
    this.objective.appendChild(text);
    if (line.bearing) {
      const bearing = document.createElement('span');
      bearing.className = 'objective-bearing';
      bearing.textContent = ` · ${line.bearing}`;
      this.objective.appendChild(bearing);
    }
    this.objective.title = line.bearing ? `${line.text} (${line.bearing})` : line.text;
  }
}
