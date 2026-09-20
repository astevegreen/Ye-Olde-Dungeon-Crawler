import type { GameState } from '../flanks/types';
import type { MenuTab } from './menuTab';
import type { AttributeMilestoneTrigger, ChoiceDefinition } from '../../engine';

export type AttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence';

interface AttributeMeta {
  key: AttributeKey;
  label: string;
  hotkeyNum: string;
  hotkeyLetter: string;
  description: string;
  derivedPreview: (val: number) => string;
}

const ATTRIBUTES: AttributeMeta[] = [
  {
    key: 'strength',
    label: 'Strength',
    hotkeyNum: '1',
    hotkeyLetter: 'S',
    description: 'Increases melee physical damage and inventory carry capacity.',
    derivedPreview: (val) => `Carry: ${val * 10} lbs | Melee Atk: +${Math.floor(val / 2)}`,
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    hotkeyNum: '2',
    hotkeyLetter: 'D',
    description: 'Enhances evasion, ranged strike precision, and physical reflex speed.',
    derivedPreview: (val) => `Evasion: +${Math.floor(val / 2)}% | Ranged Atk: +${Math.floor(val / 2)}`,
  },
  {
    key: 'constitution',
    label: 'Constitution',
    hotkeyNum: '3',
    hotkeyLetter: 'C',
    description: 'Fortifies physical resilience, increasing maximum Hit Points (+2 HP/pt).',
    derivedPreview: (val) => `HP Bonus: +${val * 2}`,
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    hotkeyNum: '4',
    hotkeyLetter: 'I',
    description: 'Expands mystical reservoir (+2 MP/pt) and amplifies spell potency.',
    derivedPreview: (val) => `Mana Bonus: +${val * 2} MP | Spell Amp: +${Math.floor(val / 2)}%`,
  },
];

export class CharacterTab implements MenuTab {
  public readonly id = 'character';
  public readonly label = 'Character';
  public readonly hotkeyActionId = 'character_menu';

  private container: HTMLElement | null = null;
  private state: GameState | null = null;
  public onAllocateCallback?: (attr: AttributeKey) => void;

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState): void {
    this.state = state;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public allocate(attr: AttributeKey): boolean {
    if (!this.state || !this.state.player) return false;
    const player = this.state.player;
    if (player.unspentStatPoints <= 0) return false;

    const success = player.allocateAttribute(attr, 1);
    if (success) {
      this.state.engine.log(
        `Allocated 1 point into ${attr.toUpperCase()} (Total: ${player[attr]}). ${player.unspentStatPoints} point(s) remain.`
      );
      this.onAllocateCallback?.(attr);
      this.render();
      return true;
    }
    return false;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.state || !this.state.player) return false;

    const key = e.key.toUpperCase();
    const code = e.code;

    if (key === '1' || code === 'Digit1' || code === 'Numpad1' || code === 'KeyS') {
      if (this.allocate('strength')) {
        e.preventDefault();
        return true;
      }
    }
    if (key === '2' || code === 'Digit2' || code === 'Numpad2' || code === 'KeyD') {
      if (this.allocate('dexterity')) {
        e.preventDefault();
        return true;
      }
    }
    if (key === '3' || code === 'Digit3' || code === 'Numpad3' || code === 'KeyC') {
      if (this.allocate('constitution')) {
        e.preventDefault();
        return true;
      }
    }
    if (key === '4' || code === 'Digit4' || code === 'Numpad4' || code === 'KeyI') {
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
    const unspent = player.unspentStatPoints;

    const rowsHtml = ATTRIBUTES.map((meta) => {
      const currentVal = player[meta.key];
      const preview = meta.derivedPreview(currentVal);
      const canAllocate = unspent > 0;

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
              <span style="font-weight: bold; color: #fde047; font-size: 13px;">[${meta.hotkeyNum}] ${meta.label}</span>
              <span style="font-weight: bold; color: #38bdf8; font-size: 15px;">${currentVal}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              ${meta.description}
            </div>
            <div style="font-size: 11px; color: #a3e635; margin-top: 2px;">
              ${preview}
            </div>
          </div>
          <div>
            <button
              class="btn-allocate-stat win-btn"
              data-attr="${meta.key}"
              ${canAllocate ? '' : 'disabled'}
              style="
                padding: 6px 12px;
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
            <span style="color: #a855f7; margin-left: 8px;">MP: ${player.mana}/${player.maxMana}</span>
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

        <div class="character-attributes-section">
          ${rowsHtml}
        </div>

        ${milestonesHtml}
      </div>
    `;

    // Attach click listeners for allocate buttons
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
  }
}
