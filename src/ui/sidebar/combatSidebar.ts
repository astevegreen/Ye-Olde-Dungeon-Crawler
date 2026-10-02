import type { Entity, GameEngine, Item } from '../../engine';
import { iconElement, type UiIconName } from '../icons';
import {
  formatGroundStatus,
  getConditions,
  getExploredPercent,
  getGroundPiles,
  getNearbyThreats,
  type Condition,
} from './sidebarModel';

export interface CombatSidebarOptions {
  drawMinimap: (canvas: HTMLCanvasElement) => void;
  drawEntityIcon: (canvas: HTMLCanvasElement, entity: Entity) => void;
  drawItemIcon: (canvas: HTMLCanvasElement, item: Item) => void;
  /** Points the map at a tile (a hovered row), or clears it with nulls. */
  onPointAt: (x: number | null, y: number | null) => void;
  onOpenMap: () => void;
}

/** How many monster rows fit before the rest collapse into "+N more in sight". */
const MAX_THREAT_ROWS = 5;

/**
 * The right-hand column beside the map: a minimap, the monsters in sight, the
 * hero's conditions, and what lies on the ground. Hovering a monster or item row
 * points the map at it; pointing at a monster on the map (mouse or look reticle)
 * highlights its row, so two of the same kind can be told apart.
 */
export class CombatSidebar {
  private readonly root: HTMLElement;
  private readonly mapTitle: HTMLElement;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly threatsCount: HTMLElement;
  private readonly threatsList: HTMLElement;
  private readonly conditionsList: HTMLElement;
  private readonly hereLine: HTMLElement;
  private readonly groundList: HTMLElement;
  private focusedEntityId: string | null = null;
  /** The longest each condition has run, so its bar can show how much is left. */
  private readonly conditionSpan = new Map<string, number>();

  constructor(private readonly options: CombatSidebarOptions) {
    this.root = document.createElement('aside');
    this.root.id = 'combat-sidebar';
    this.root.setAttribute('aria-label', 'Map, nearby monsters, conditions and ground items');

    const mapSec = this.section('sb-map');
    this.mapTitle = this.title(mapSec, '');
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.className = 'sb-minimap';
    this.mapCanvas.width = 240;
    this.mapCanvas.height = 150;
    this.mapCanvas.title = 'Open the full map (M)';
    this.mapCanvas.addEventListener('click', () => this.options.onOpenMap());
    mapSec.appendChild(this.mapCanvas);

    const threatSec = this.section('sb-threats');
    this.threatsCount = this.title(threatSec, 'Nearby');
    this.threatsList = document.createElement('div');
    this.threatsList.className = 'sb-list';
    threatSec.appendChild(this.threatsList);

    const condSec = this.section('sb-conditions');
    this.title(condSec, 'Conditions');
    this.conditionsList = document.createElement('div');
    this.conditionsList.className = 'sb-list';
    condSec.appendChild(this.conditionsList);

    const groundSec = this.section('sb-ground');
    this.title(groundSec, 'On the ground');
    this.hereLine = document.createElement('div');
    this.hereLine.className = 'sb-here';
    groundSec.appendChild(this.hereLine);
    this.groundList = document.createElement('div');
    this.groundList.className = 'sb-list sb-ground-list';
    groundSec.appendChild(this.groundList);
  }

  public get element(): HTMLElement {
    return this.root;
  }

  /** Highlights the row of the monster the map is pointing at (null clears it). */
  public setFocusedEntity(entityId: string | null): void {
    this.focusedEntityId = entityId;
    for (const row of this.threatsList.querySelectorAll<HTMLElement>('.sb-threat')) {
      row.classList.toggle('sb-focused', row.dataset.entityId === entityId);
    }
  }

  public update(engine: GameEngine): void {
    if (!engine?.player) return;
    this.renderMap(engine);
    this.renderThreats(engine);
    this.renderConditions(engine);
    this.renderGround(engine);
  }

  private section(className: string): HTMLElement {
    const sec = document.createElement('section');
    sec.className = `sb-sec ${className}`;
    this.root.appendChild(sec);
    return sec;
  }

  /** A section heading; returns the small right-aligned note beside it. */
  private title(sec: HTMLElement, text: string): HTMLElement {
    const head = document.createElement('div');
    head.className = 'sb-title';
    const label = document.createElement('span');
    label.textContent = text;
    const note = document.createElement('small');
    head.append(label, note);
    sec.appendChild(head);
    return text ? note : label;
  }

  private renderMap(engine: GameEngine): void {
    const where = engine.currentFloor === 0 ? engine.manifest?.town?.name ?? 'Town' : `Floor ${engine.currentFloor}`;
    this.mapTitle.textContent = where;
    const note = this.mapTitle.nextElementSibling as HTMLElement | null;
    if (note) note.textContent = engine.currentFloor === 0 ? '[M] map' : `${getExploredPercent(engine)}% explored · [M]`;
    this.options.drawMinimap(this.mapCanvas);
  }

  private renderThreats(engine: GameEngine): void {
    const threats = getNearbyThreats(engine);
    this.threatsCount.textContent = threats.length ? `${threats.length} in sight` : '';
    this.threatsList.replaceChildren();
    if (threats.length === 0) {
      this.threatsList.appendChild(this.empty('Nothing in sight'));
      return;
    }
    for (const t of threats.slice(0, MAX_THREAT_ROWS)) {
      const row = document.createElement('div');
      row.className = 'sb-row sb-threat';
      row.dataset.entityId = t.id;
      row.classList.toggle('sb-focused', t.id === this.focusedEntityId);
      row.addEventListener('mouseenter', () => this.options.onPointAt(t.x, t.y));
      row.addEventListener('mouseleave', () => this.options.onPointAt(null, null));

      const icon = this.icon();
      const entity = engine.map.getEntityAt(t.x, t.y);
      if (entity) this.options.drawEntityIcon(icon, entity);

      const name = document.createElement('div');
      name.className = 'sb-name';
      const nameText = document.createElement('span');
      nameText.textContent = t.name;
      const where = document.createElement('span');
      where.className = 'sb-where';
      where.textContent = `${t.distance} ${t.direction}`.trim();
      name.append(nameText, where);

      const hp = document.createElement('div');
      hp.className = 'sb-hp';
      const fill = document.createElement('i');
      fill.style.width = `${Math.max(0, Math.min(100, Math.round((t.hp / Math.max(1, t.maxHp)) * 100)))}%`;
      const hpText = document.createElement('b');
      hpText.textContent = `${t.hp}/${t.maxHp}`;
      hp.append(fill, hpText);

      row.append(icon, name, hp);
      if (t.windup) {
        const warn = document.createElement('div');
        warn.className = 'sb-intent';
        const turns = Math.max(1, t.windup.turnsRemaining);
        warn.append(iconElement('warning'), ` Winding up ${t.windup.ability} · lands ${turns === 1 ? 'next turn' : `in ${turns} turns`}`);
        row.appendChild(warn);
      }
      this.threatsList.appendChild(row);
    }
    if (threats.length > MAX_THREAT_ROWS) {
      this.threatsList.appendChild(this.empty(`+${threats.length - MAX_THREAT_ROWS} more in sight`));
    }
  }

  private renderConditions(engine: GameEngine): void {
    const conditions = getConditions(engine);
    const active = new Set(conditions.map((c) => c.key));
    for (const key of [...this.conditionSpan.keys()]) if (!active.has(key)) this.conditionSpan.delete(key);

    this.conditionsList.replaceChildren();
    if (conditions.length === 0) {
      this.conditionsList.appendChild(this.empty('None'));
      return;
    }
    for (const c of conditions) this.conditionsList.appendChild(this.conditionRow(c));
  }

  private conditionRow(c: Condition): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sb-cond';
    const dot = document.createElement('span');
    dot.className = 'sb-dot';
    dot.style.background = c.color;
    const label = document.createElement('span');
    label.className = 'sb-cond-name';
    label.textContent = c.label;
    const turns = document.createElement('span');
    turns.className = 'sb-cond-turns';
    turns.textContent = c.turns === null ? 'ongoing' : `${c.turns} turn${c.turns === 1 ? '' : 's'}`;
    row.append(dot, label, turns);

    if (c.detail) {
      const detail = document.createElement('span');
      detail.className = 'sb-cond-detail';
      detail.textContent = c.detail;
      row.appendChild(detail);
    }
    if (c.turns !== null) {
      const span = Math.max(this.conditionSpan.get(c.key) ?? 0, c.turns);
      this.conditionSpan.set(c.key, span);
      const bar = document.createElement('span');
      bar.className = 'sb-cond-bar';
      const fill = document.createElement('i');
      fill.style.width = `${Math.round((c.turns / Math.max(1, span)) * 100)}%`;
      fill.style.background = c.color;
      bar.appendChild(fill);
      row.appendChild(bar);
    }
    return row;
  }

  private renderGround(engine: GameEngine): void {
    const here = formatGroundStatus(engine, engine.player.x, engine.player.y);
    // "[icon] Where you stand · [icon] what you can do here"
    this.hereLine.replaceChildren();
    const parts: Array<[string, UiIconName | undefined]> = [
      [here.standingText, here.standingIcon],
      [here.promptText, here.promptIcon],
    ];
    for (const [text, icon] of parts.filter(([text]) => text)) {
      if (this.hereLine.childNodes.length > 0) this.hereLine.append(' · ');
      if (icon) this.hereLine.append(iconElement(icon), ' ');
      // "[G] Pickup | [Shift+G] Quick-Loot | …": the line breaks between commands, never
      // inside one.
      text.split(' | ').forEach((command, i) => {
        if (i > 0) this.hereLine.append(' | ');
        const seg = document.createElement('span');
        seg.className = 'sb-here-seg';
        seg.textContent = command;
        this.hereLine.append(seg);
      });
    }
    this.hereLine.hidden = this.hereLine.childNodes.length === 0;
    this.hereLine.classList.toggle('sb-here-warn', Boolean(here.hazard));

    const piles = getGroundPiles(engine);
    this.groundList.replaceChildren();
    if (piles.length === 0) {
      this.groundList.appendChild(this.empty('Nothing in sight'));
      return;
    }
    for (const pile of piles) {
      const row = document.createElement('div');
      row.className = 'sb-row sb-item';
      row.classList.toggle('sb-item-here', pile.distance === 0);
      row.addEventListener('mouseenter', () => this.options.onPointAt(pile.x, pile.y));
      row.addEventListener('mouseleave', () => this.options.onPointAt(null, null));
      const icon = this.icon();
      this.options.drawItemIcon(icon, pile.item);
      const name = document.createElement('div');
      name.className = 'sb-name';
      const label = document.createElement('span');
      label.textContent = pile.more > 0 ? `${pile.label} +${pile.more}` : pile.label;
      const where = document.createElement('span');
      where.className = 'sb-where';
      where.textContent = pile.distance === 0 ? 'here' : `${pile.distance} ${pile.direction}`;
      name.append(label, where);
      row.title = pile.distance === 0 ? `${pile.label} — [G] pick up` : pile.label;
      row.append(icon, name);
      this.groundList.appendChild(row);
    }
  }

  private icon(): HTMLCanvasElement {
    const icon = document.createElement('canvas');
    icon.className = 'sb-icon';
    icon.width = 32;
    icon.height = 32;
    return icon;
  }

  private empty(text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'sb-empty';
    el.textContent = text;
    return el;
  }
}
