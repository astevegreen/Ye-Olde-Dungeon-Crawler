import type { GameState } from '../flanks/types';
import type { MenuHost, MenuTab } from './menuTab';
import type { AttributeMilestoneTrigger, ChoiceDefinition, Player } from '../../engine';
import { formatCurrency, getMaxCarryWeight, getPlayerTotalCp, resolveManaTerms, type ManaTerms } from '../../engine';
import { AttributeAllocationDraft, type AttributeKey } from '../attributeAllocationDraft';

interface AttributeMeta {
  key: AttributeKey;
  label: string;
  hotkeyLetter: string;
  description: string;
  derivedPreview: (val: number) => string;
}

const ATTRIBUTES: AttributeMeta[] = [
  {
    key: 'strength',
    label: 'Strength',
    hotkeyLetter: 'S',
    description: 'Increases melee physical damage and inventory carry capacity.',
    derivedPreview: (val) => `Carry capacity: ${(getMaxCarryWeight(val) / 1000).toFixed(1)} kg`,
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    hotkeyLetter: 'D',
    description: 'Enhances evasion, ranged strike precision, and physical reflex speed.',
    derivedPreview: (val) => `Evasion: +${Math.floor(val / 2)}% | Ranged Atk: +${Math.floor(val / 2)}`,
  },
  {
    key: 'constitution',
    label: 'Constitution',
    hotkeyLetter: 'C',
    description: 'Fortifies physical resilience, increasing maximum Hit Points (+2 HP/pt).',
    derivedPreview: (val) => `HP Bonus: +${val * 2}`,
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    hotkeyLetter: 'I',
    // {mana}/{unit} are filled from the pack's terms where the text is shown.
    description: 'Expands mystical reservoir (+2 {unit}/pt) and amplifies spell potency.',
    derivedPreview: (val) => `{mana} Bonus: +${val * 2} {unit} | Spell Amp: +${Math.floor(val / 2)}%`,
  },
];

/** Base value plus what gear/pacts add on top, e.g. "14 (8 base +6)". */
function withBreakdown(total: number, base: number): string {
  const bonus = total - base;
  if (bonus === 0) return `${total}`;
  return `${total} <span style="color: #94a3b8; font-size: 11px;">(${base} base ${bonus > 0 ? '+' : ''}${bonus})</span>`;
}

/** Fills an attribute text's {mana}/{unit} placeholders with the pack's terms. */
export function fillManaTerms(text: string, mana: ManaTerms): string {
  return text.replace(/\{mana\}/g, mana.name).replace(/\{unit\}/g, mana.unit);
}

function renderVitals(player: Player, floor: number, turn: number, xpName: string, manaName: string): string {
  const carriedKg = player.inventory.totalWeight() / 1000;
  const capacityKg = getMaxCarryWeight(player.strength) / 1000;
  const actionCost = player.getActionCost(100);
  const resistances = Object.entries(player.elementalResistances)
    .filter(([, affinity]) => affinity && affinity !== 'neutral')
    .map(([element, affinity]) => `${element} ${affinity}`)
    .join(', ');
  const statuses = player.statusManager
    .getAll()
    .map((eff) => (eff.duration >= 9999 ? eff.type : `${eff.type} (${eff.duration}t)`))
    .join(', ');

  const rows: Array<[string, string]> = [
    ['Attack', withBreakdown(player.attack, player.baseAttackValue)],
    ['Defense', withBreakdown(player.defense, player.baseDefenseValue)],
    ['Hit Points', `${player.hp} / ${player.maxHp}`],
    [manaName, `${player.mana} / ${player.maxMana}`],
    [xpName, `${player.xp} / ${player.xpToNextLevel} to Level ${player.level + 1}`],
    ['Action cost', `${actionCost} energy per action${actionCost === 100 ? ' (normal)' : actionCost > 100 ? ' (slowed)' : ' (hastened)'}`],
    ['Load', `${carriedKg.toFixed(1)} / ${capacityKg.toFixed(1)} kg — ${player.inventory.getEncumbrance(player.strength)}`],
    ['Purse', formatCurrency(getPlayerTotalCp(player))],
    ['Resistances', resistances || 'None'],
    ['Conditions', statuses || 'None'],
    ['Depth', `${floor === 0 ? 'Town' : `Floor ${floor}`} · Turn ${turn} · ${(player.difficulty ?? 'medium').toUpperCase()}`],
  ];

  return `
    <div class="character-vitals" style="
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 3px 14px;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid #475569;
      border-radius: 4px;
      font-size: 12px;
    ">
      <h3 style="grid-column: 1 / -1; font-size: 13px; color: #facc15; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">⚔️ Combat &amp; Vitals</h3>
      ${rows
        .map(
          ([label, value]) =>
            `<span style="color: #94a3b8;">${label}</span><span style="color: #f8fafc; font-weight: bold;">${value}</span>`
        )
        .join('')}
    </div>
  `;
}

export class CharacterTab implements MenuTab {
  public readonly id = 'character';
  public readonly label = 'Character';
  public readonly hotkeyActionId = 'character_menu';

  private container: HTMLElement | null = null;
  private state: GameState | null = null;
  public onAllocateCallback?: (attr: AttributeKey) => void;
  /** This session's planned points; nothing reaches the player until `accept()`. */
  private readonly draft = new AttributeAllocationDraft();
  private host?: MenuHost;

  public bindHost(host: MenuHost): void {
    this.host = host;
  }

  /** "+N" on the tab while points wait to be spent. */
  public badge(state: GameState): string | null {
    const points = state.player.unspentStatPoints;
    return points > 0 ? `+${points}` : null;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState): void {
    this.state = state;
    this.draft.clear();
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  /** Plans one point into `attr`. */
  public allocate(attr: AttributeKey): boolean {
    const player = this.state?.player;
    if (!player || !this.draft.add(attr, player)) return false;
    this.render();
    return true;
  }

  /** Takes back one point planned this session; locked-in points can't be removed. */
  public deallocate(attr: AttributeKey): boolean {
    if (!this.draft.remove(attr)) return false;
    this.render();
    return true;
  }

  public undo(): boolean {
    if (!this.draft.undo()) return false;
    this.render();
    return true;
  }

  public redo(): boolean {
    const player = this.state?.player;
    if (!player || !this.draft.redo(player)) return false;
    this.render();
    return true;
  }

  public reset(): boolean {
    if (!this.draft.reset()) return false;
    this.render();
    return true;
  }

  /** Locks the planned points into the player. */
  public accept(): boolean {
    const state = this.state;
    if (!state?.player || this.draft.total === 0) return false;
    const summary = this.draft.describe();
    const spent = this.draft.commit(state.player);
    if (spent > 0) {
      state.engine.log(`Attributes locked in: ${summary}. ${state.player.unspentStatPoints} point(s) remain.`);
      this.onAllocateCallback?.('strength');
    }
    this.render();
    this.host?.refreshChrome();
    return true;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.state || !this.state.player) return false;

    const key = e.key.toUpperCase();
    const code = e.code;

    if (key === 'ENTER' || code === 'NumpadEnter') {
      if (this.accept()) {
        e.preventDefault();
        return true;
      }
    }

    if ((key === 'Z' || code === 'KeyZ') && !e.shiftKey) {
      if (this.undo()) {
        e.preventDefault();
        return true;
      }
    }

    if (key === 'Y' || code === 'KeyY' || (e.shiftKey && (key === 'Z' || code === 'KeyZ'))) {
      if (this.redo()) {
        e.preventDefault();
        return true;
      }
    }

    if (key === 'R' || code === 'KeyR') {
      if (this.reset()) {
        e.preventDefault();
        return true;
      }
    }

    if (key === 'S' || code === 'KeyS') {
      if (this.allocate('strength')) {
        e.preventDefault();
        return true;
      }
    }
    if (key === 'D' || code === 'KeyD') {
      if (this.allocate('dexterity')) {
        e.preventDefault();
        return true;
      }
    }
    if (key === 'C' || code === 'KeyC') {
      if (this.allocate('constitution')) {
        e.preventDefault();
        return true;
      }
    }
    if (key === 'I' || code === 'KeyI') {
      if (this.allocate('intelligence')) {
        e.preventDefault();
        return true;
      }
    }

    return false;
  }

  public render(): void {
    if (!this.container || !this.state) return;

    const player = this.state.player;
    const worldState = this.state.worldState;
    const manifest = this.state.manifest ?? this.state.engine.manifest;
    const mana = resolveManaTerms(manifest);
    const unspent = this.draft.remaining(player);
    const planned = this.draft.total;
    const canUndo = this.draft.canUndo;
    const canRedo = this.draft.canRedo;

    const rowsHtml = ATTRIBUTES.map((meta) => {
      const sessionDelta = this.draft.get(meta.key);
      const currentVal = player[meta.key] + sessionDelta;
      const preview = fillManaTerms(meta.derivedPreview(currentVal), mana);
      const canAllocate = unspent > 0;
      const canDeallocate = sessionDelta > 0;

      return `
        <div class="stat-alloc-row" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          margin-bottom: 8px;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid #475569;
          border-radius: 4px;
        ">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <span style="font-weight: bold; color: #fde047; font-size: 13px;">[${meta.hotkeyLetter}] ${meta.label}</span>
              <span style="font-weight: bold; color: #38bdf8; font-size: 15px;">${currentVal}</span>
              ${sessionDelta > 0 ? `<span style="color: #4ade80; font-weight: bold; font-size: 12px;">(+${sessionDelta})</span>` : ''}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              ${fillManaTerms(meta.description, mana)}
            </div>
            <div style="font-size: 11px; color: #a3e635; margin-top: 2px;">
              ${preview}
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button
              class="btn-deallocate-stat win-btn"
              data-attr="${meta.key}"
              ${canDeallocate ? '' : 'disabled'}
              style="
                padding: 5px 10px;
                background: ${canDeallocate ? '#7f1d1d' : '#334155'};
                color: ${canDeallocate ? '#fca5a5' : '#64748b'};
                border: 1px solid ${canDeallocate ? '#ef4444' : '#475569'};
                border-radius: 4px;
                cursor: ${canDeallocate ? 'pointer' : 'not-allowed'};
                font-weight: bold;
                font-size: 12px;
              "
              title="Take back 1 planned point"
            >
              -1
            </button>
            <button
              class="btn-allocate-stat win-btn"
              data-attr="${meta.key}"
              ${canAllocate ? '' : 'disabled'}
              style="
                padding: 5px 12px;
                background: ${canAllocate ? '#16a34a' : '#334155'};
                color: ${canAllocate ? '#ffffff' : '#64748b'};
                border: 1px solid ${canAllocate ? '#22c55e' : '#475569'};
                border-radius: 4px;
                cursor: ${canAllocate ? 'pointer' : 'not-allowed'};
                font-weight: bold;
                font-size: 12px;
              "
            >
              +1 [${meta.hotkeyLetter}]
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Milestone Ability Tree
    const milestones: AttributeMilestoneTrigger[] = manifest?.attributeMilestones ?? [];
    let milestonesHtml = '';
    if (milestones.length > 0) {
      const milestoneItems = milestones.map((m) => {
        const isOffered = Boolean(worldState?.flags?.[`${m.id}_offered`]);
        const currentAttrVal = player[m.attribute] ?? 0;
        const isReady = !isOffered && currentAttrVal >= m.threshold;

        let statusBadge = '';
        let borderColor = '#475569';
        let progressText = '';

        if (isOffered) {
          statusBadge = `<span style="color: #4ade80; font-weight: bold; font-size: 11px;">[Unlocked]</span>`;
          borderColor = '#15803d';
          progressText = `Threshold reached (${m.threshold})`;
        } else if (isReady) {
          statusBadge = `<span style="color: #facc15; font-weight: bold; font-size: 11px;">[Ready to Unlock]</span>`;
          borderColor = '#ca8a04';
          progressText = `Ready! Choice unlocks on your next step.`;
        } else {
          statusBadge = `<span style="color: #94a3b8; font-weight: bold; font-size: 11px;">[Locked]</span>`;
          borderColor = '#334155';
          progressText = `Progress: ${currentAttrVal} / ${m.threshold}`;
        }

        const choiceDef: ChoiceDefinition | undefined = manifest?.choices?.[m.choiceId];
        const choiceTitle = choiceDef ? choiceDef.title : m.id.replace(/_/g, ' ');
        const optionsDesc = choiceDef
          ? choiceDef.options.map((opt) => opt.label).join(' &bull; ')
          : '';

        return `
          <div class="milestone-card" style="
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid ${borderColor};
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 6px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; color: #f8fafc; font-size: 12px; text-transform: capitalize;">
                ${m.attribute.charAt(0).toUpperCase() + m.attribute.slice(1)} ≥ ${m.threshold}: ${choiceTitle}
              </span>
              ${statusBadge}
            </div>
            <div style="font-size: 11px; color: ${isReady ? '#fef08a' : '#cbd5e1'}; margin-top: 3px;">
              ${progressText}
            </div>
            ${optionsDesc ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Choices: ${optionsDesc}</div>` : ''}
          </div>
        `;
      }).join('');

      milestonesHtml = `
        <div style="margin-top: 14px;">
          <h3 style="font-size: 13px; color: #facc15; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em;">
            🌟 Attribute Milestone Abilities
          </h3>
          <div style="max-height: 180px; overflow-y: auto; padding-right: 4px;">
            ${milestoneItems}
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="character-sheet-container" style="padding: 12px; height: 100%; box-sizing: border-box; overflow-y: auto;">
        <div class="character-hero-banner" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #1e293b;
          border: 1px solid #ca8a04;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 12px;
        ">
          <div>
            <span style="font-weight: bold; color: #ffffff; font-size: 15px;">${player.name}</span>
            <span style="color: #94a3b8; margin-left: 8px;">Level ${player.level}</span>
            <span style="color: #38bdf8; margin-left: 8px;">HP: ${player.hp}/${player.maxHp}</span>
            <span style="color: #a855f7; margin-left: 8px;">${mana.unit}: ${player.mana}/${player.maxMana}</span>
          </div>
          <div style="
            background: ${unspent > 0 ? '#ca8a04' : '#334155'};
            color: ${unspent > 0 ? '#000000' : '#94a3b8'};
            font-weight: bold;
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 3px;
          ">
            ${unspent > 0 ? `⭐ ${unspent} Point(s) Available` : '0 Points Available'}
          </div>
        </div>

        ${renderVitals(player, this.state.currentFloor, this.state.turnCount, manifest?.branding?.xpName ?? 'XP', mana.name)}

        <div class="character-attributes-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="font-size: 13px; color: #facc15; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">
              Attributes &amp; Allocation
            </h3>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button
                id="btn-undo-char"
                class="win-btn"
                ${canUndo ? '' : 'disabled'}
                style="
                  padding: 3px 8px;
                  background: ${canUndo ? '#2563eb' : '#334155'};
                  color: ${canUndo ? '#ffffff' : '#64748b'};
                  border: 1px solid ${canUndo ? '#3b82f6' : '#475569'};
                  border-radius: 3px;
                  cursor: ${canUndo ? 'pointer' : 'not-allowed'};
                  font-size: 11px;
                  font-weight: bold;
                "
                title="Undo last allocation (Z)"
              >
                ↶ Undo [Z]
              </button>
              <button
                id="btn-redo-char"
                class="win-btn"
                ${canRedo ? '' : 'disabled'}
                style="
                  padding: 3px 8px;
                  background: ${canRedo ? '#2563eb' : '#334155'};
                  color: ${canRedo ? '#ffffff' : '#64748b'};
                  border: 1px solid ${canRedo ? '#3b82f6' : '#475569'};
                  border-radius: 3px;
                  cursor: ${canRedo ? 'pointer' : 'not-allowed'};
                  font-size: 11px;
                  font-weight: bold;
                "
                title="Redo allocation (Y)"
              >
                ↷ Redo [Y]
              </button>
              <button
                id="btn-reset-char"
                class="win-btn"
                ${canUndo ? '' : 'disabled'}
                style="
                  padding: 3px 8px;
                  background: ${canUndo ? '#475569' : '#334155'};
                  color: ${canUndo ? '#f1f5f9' : '#64748b'};
                  border: 1px solid ${canUndo ? '#64748b' : '#475569'};
                  border-radius: 3px;
                  cursor: ${canUndo ? 'pointer' : 'not-allowed'};
                  font-size: 11px;
                "
                title="Clear every planned point (R)"
              >
                ↺ Reset [R]
              </button>
              <button
                id="btn-accept-char"
                class="win-btn"
                ${planned > 0 ? '' : 'disabled'}
                style="
                  padding: 3px 10px;
                  background: ${planned > 0 ? '#16a34a' : '#334155'};
                  color: ${planned > 0 ? '#ffffff' : '#64748b'};
                  border: 1px solid ${planned > 0 ? '#22c55e' : '#475569'};
                  border-radius: 3px;
                  cursor: ${planned > 0 ? 'pointer' : 'not-allowed'};
                  font-size: 11px;
                  font-weight: bold;
                "
                title="Lock in the planned points (Enter)"
              >
                ✔ Accept [Enter]
              </button>
            </div>
          </div>
          ${planned > 0 ? `<div style="font-size: 11px; color: #fef08a; margin-bottom: 6px;">Planned: ${this.draft.describe()} — press [Enter] or Accept to lock in. Unaccepted points are discarded when you leave this tab.</div>` : ''}
          ${rowsHtml}
        </div>

        ${milestonesHtml}
      </div>
    `;

    // Attach click listeners for allocate and deallocate buttons
    this.container.querySelector('#btn-undo-char')?.addEventListener('click', () => this.undo());
    this.container.querySelector('#btn-redo-char')?.addEventListener('click', () => this.redo());
    this.container.querySelector('#btn-reset-char')?.addEventListener('click', () => this.reset());
    this.container.querySelector('#btn-accept-char')?.addEventListener('click', () => this.accept());

    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.btn-allocate-stat');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const attr = btn.getAttribute('data-attr') as AttributeKey;
        if (attr) {
          this.allocate(attr);
        }
      });
    });

    const deallocButtons = this.container.querySelectorAll<HTMLButtonElement>('.btn-deallocate-stat');
    deallocButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const attr = btn.getAttribute('data-attr') as AttributeKey;
        if (attr) {
          this.deallocate(attr);
        }
      });
    });
  }
}
