import type { GameEngine } from '../engine/engine';
import type { SpellDefinition } from '../engine/magic/types';
import { getSpell } from '../engine/magic/spellRegistry';
import type { UIModal } from './modalStack';

export interface SpellbookModalOptions {
  onCastSpell: (spell: SpellDefinition) => void;
  onQuickSpellsChanged: () => void;
  onClose?: () => void;
}

export class SpellbookModal implements UIModal {
  public readonly id = 'spellbook';
  private container: HTMLElement;
  private options: SpellbookModalOptions;
  public isOpen: boolean = false;
  private engine?: GameEngine;
  private spells: SpellDefinition[] = [];
  private selectedIndex: number = 0;

  constructor(options: SpellbookModalOptions) {
    this.options = options;
    this.container = document.createElement('div');
    this.container.id = 'spellbook-modal';
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('role', 'dialog');
    this.applyStyles();
  }

  private applyStyles(): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(4px)',
      zIndex: '150',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Courier New", Courier, monospace',
      color: '#e2e8f0',
      userSelect: 'none',
    });
  }

  public open(engine: GameEngine): void {
    (document.activeElement as HTMLElement)?.blur();
    this.engine = engine;
    this.isOpen = true;
    this.container.style.display = 'flex';

    // Populate spells known
    this.spells = [];
    for (const spellId of engine.player.spellsKnown) {
      const spell = engine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
      if (spell) {
        this.spells.push(spell);
      }
    }
    if (this.selectedIndex >= this.spells.length) {
      this.selectedIndex = Math.max(0, this.spells.length - 1);
    }

    this.render();
  }

  public close(): void {
    if (!this.isOpen && this.container.style.display === 'none') return;
    this.isOpen = false;
    this.container.style.display = 'none';
    (document.activeElement as HTMLElement)?.blur();
    if (typeof document !== 'undefined') {
      document.getElementById('game-canvas')?.focus();
    }
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  public mount(parent: HTMLElement): void {
    if (!parent.contains(this.container)) {
      parent.appendChild(this.container);
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    // Preserve browser modifier combinations (e.g. Ctrl+W, Ctrl+R, Ctrl+T) and Tab focus traversal
    if (e.ctrlKey || e.metaKey || e.altKey || e.code === 'Tab') {
      return false;
    }

    const code = e.code;
    const isHandledKey =
      code === 'Escape' ||
      code === 'KeyZ' ||
      code === 'ArrowUp' ||
      code === 'KeyW' ||
      code === 'KeyK' ||
      code === 'Numpad8' ||
      code === 'ArrowDown' ||
      code === 'KeyS' ||
      code === 'KeyJ' ||
      code === 'Numpad2' ||
      code.startsWith('Digit') ||
      code === 'Enter' ||
      code === 'Space';

    if (isHandledKey) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (code === 'Escape' || code === 'KeyZ') {
      this.close();
      return true;
    }

    if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyK' || code === 'Numpad8') {
      if (this.spells.length > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.spells.length) % this.spells.length;
        this.render();
      }
      return true;
    }

    if (code === 'ArrowDown' || code === 'KeyS' || code === 'KeyJ' || code === 'Numpad2') {
      if (this.spells.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.spells.length;
        this.render();
      }
      return true;
    }

    // Assign slot via top-row Digit1 - Digit0 only (never intercept Numpad1-9)
    if (code.startsWith('Digit')) {
      const digitStr = code.replace('Digit', '');
      const digit = parseInt(digitStr, 10);
      const slotIndex = digit === 0 ? 9 : digit - 1;
      this.assignCurrentSpellToSlot(slotIndex);
      return true;
    }

    // Cast spell on Enter / Space
    if (code === 'Enter' || code === 'Space') {
      this.castCurrentSpell();
      return true;
    }

    // Absorb all other keys while spellbook modal is open
    return true;
  }

  private assignCurrentSpellToSlot(slotIndex: number): void {
    if (!this.engine || this.spells.length === 0) return;
    const currentSpell = this.spells[this.selectedIndex];
    if (!currentSpell) return;

    const player = this.engine.player;
    if (!player.quickSpells) {
      player.quickSpells = Array(10).fill(null);
    }

    if (player.quickSpells[slotIndex] === currentSpell.id) {
      // Toggle off
      player.quickSpells[slotIndex] = null;
    } else {
      player.quickSpells[slotIndex] = currentSpell.id;
    }

    this.options.onQuickSpellsChanged();
    this.render();
  }

  private castCurrentSpell(): void {
    if (this.spells.length === 0) return;
    const currentSpell = this.spells[this.selectedIndex];
    if (!currentSpell) return;

    this.close();
    this.options.onCastSpell(currentSpell);
  }

  private render(): void {
    if (!this.engine) return;
    const player = this.engine.player;
    const currentSpell = this.spells[this.selectedIndex];
    const quickSpells = player.quickSpells ?? [];
    const slotLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      width: '720px',
      maxWidth: '92vw',
      height: '520px',
      maxHeight: '90vh',
      backgroundColor: '#0f172a',
      border: '2px solid #38bdf8',
      borderRadius: '8px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '12px 18px',
      background: 'linear-gradient(90deg, #1e3a8a 0%, #0f172a 100%)',
      borderBottom: '1px solid #38bdf8',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });
    header.innerHTML = `
      <div style="font-weight: bold; font-size: 16px; color: #f8fafc; letter-spacing: 0.05em;">
        📜 ARCANE SPELLBOOK & QUICKBAR ASSIGNMENT
      </div>
      <div style="font-size: 12px; color: #67e8f9;">
        Mana: <span style="font-weight: bold; color: #38bdf8;">${player.mana}</span> / ${player.maxMana} MP
      </div>
    `;
    dialog.appendChild(header);

    // Body content (2-column layout)
    const body = document.createElement('div');
    Object.assign(body.style, {
      flex: '1',
      display: 'flex',
      flexDirection: 'row',
      minHeight: '0',
    });

    // Left column: Spell list
    const leftCol = document.createElement('div');
    Object.assign(leftCol.style, {
      width: '260px',
      borderRight: '1px solid #334155',
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      overflowY: 'auto',
      padding: '8px 0',
    });

    if (this.spells.length === 0) {
      leftCol.innerHTML = `<div style="padding: 16px; color: #64748b; font-style: italic; text-align: center;">No spells known yet.</div>`;
    } else {
      this.spells.forEach((spell, idx) => {
        const isSelected = idx === this.selectedIndex;
        const assignedSlot = quickSpells.indexOf(spell.id);
        const slotBadge = assignedSlot >= 0 ? `<span style="background: #facc15; color: #0f172a; padding: 1px 4px; border-radius: 2px; font-size: 9px; font-weight: bold; margin-right: 6px;">[${slotLabels[assignedSlot]}]</span>` : '';
        const itemEl = document.createElement('div');
        Object.assign(itemEl.style, {
          padding: '8px 14px',
          cursor: 'pointer',
          backgroundColor: isSelected ? '#1e293b' : 'transparent',
          borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          transition: 'background 0.1s',
        });

        itemEl.innerHTML = `
          <div style="display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${slotBadge}
            <span style="font-weight: ${isSelected ? 'bold' : 'normal'}; color: ${isSelected ? '#38bdf8' : '#e2e8f0'};">${spell.name}</span>
          </div>
          <span style="font-size: 10px; color: #64748b; margin-left: 8px;">${spell.manaCost ?? 0}m</span>
        `;

        itemEl.addEventListener('click', () => {
          this.selectedIndex = idx;
          this.render();
        });

        leftCol.appendChild(itemEl);
      });
    }
    body.appendChild(leftCol);

    // Right column: Spell details and slot assignment
    const rightCol = document.createElement('div');
    Object.assign(rightCol.style, {
      flex: '1',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: '#090d16',
      overflowY: 'auto',
    });

    if (!currentSpell) {
      rightCol.innerHTML = `<div style="color: #64748b; font-style: italic; margin-top: 40px; text-align: center;">Select a spell to view details.</div>`;
    } else {
      const detailsContainer = document.createElement('div');

      detailsContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
          <h2 style="margin: 0; font-size: 18px; color: #38bdf8; font-weight: bold;">${currentSpell.name}</h2>
          <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">School: ${currentSpell.school}</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; margin-bottom: 16px; font-size: 12px;">
          <div><span style="color: #64748b;">Mana Cost:</span> <span style="font-weight: bold; color: #facc15;">${currentSpell.manaCost ?? 0} MP</span></div>
          <div><span style="color: #64748b;">Element:</span> <span style="font-weight: bold; color: #38bdf8;">${currentSpell.element ?? 'Arcane'}</span></div>
          <div><span style="color: #64748b;">Range:</span> <span style="font-weight: bold; color: #e2e8f0;">${currentSpell.range ? `${currentSpell.range} tiles` : 'Self / Touch'}</span></div>
          <div><span style="color: #64748b;">Base Power:</span> <span style="font-weight: bold; color: #f87171;">${currentSpell.basePower ?? 0}</span></div>
          <div><span style="color: #64748b;">Area of Effect:</span> <span style="font-weight: bold; color: #e2e8f0;">${currentSpell.areaOfEffect ? `${currentSpell.areaOfEffect} radius` : 'Single Target'}</span></div>
          <div><span style="color: #64748b;">Reflective:</span> <span style="font-weight: bold; color: #e2e8f0;">${currentSpell.reflects ? 'Yes (Bounces off walls)' : 'No'}</span></div>
        </div>

        <div style="font-size: 12px; line-height: 1.5; color: #cbd5e1; margin-bottom: 20px; background: rgba(30, 41, 59, 0.4); padding: 10px; border-radius: 4px; border: 1px solid #1e293b;">
          ${currentSpell.description || 'Chants sacred words of power to manipulate planar currents and weave mystical energy.'}
        </div>

        <div style="margin-top: 10px;">
          <div style="font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">
            Assign to Quickbar Slot [1-0]:
          </div>
        </div>
      `;

      const slotButtonsContainer = document.createElement('div');
      slotButtonsContainer.id = 'quickbar-slot-buttons';
      Object.assign(slotButtonsContainer.style, {
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
      });
      detailsContainer.appendChild(slotButtonsContainer);
      rightCol.appendChild(detailsContainer);

      // Populate slot buttons
      for (let s = 0; s < 10; s++) {
        const slotKey = slotLabels[s];
        const isCurrentAssigned = quickSpells[s] === currentSpell.id;
        const otherSpellId = quickSpells[s];
        const btn = document.createElement('button');
        btn.type = 'button';
        Object.assign(btn.style, {
          padding: '6px 10px',
          background: isCurrentAssigned ? '#facc15' : otherSpellId ? '#1e293b' : 'rgba(15, 23, 42, 0.6)',
          color: isCurrentAssigned ? '#0f172a' : otherSpellId ? '#94a3b8' : '#64748b',
          border: isCurrentAssigned ? '1px solid #eab308' : '1px solid #334155',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
        });
        btn.textContent = `[${slotKey}]`;
        btn.title = isCurrentAssigned ? `Assigned to Slot ${slotKey} (Click to unassign)` : `Assign to Slot ${slotKey}`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.assignCurrentSpellToSlot(s);
        });
        slotButtonsContainer.appendChild(btn);
      }
    }

    body.appendChild(rightCol);
    dialog.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      padding: '10px 18px',
      background: '#090d16',
      borderTop: '1px solid #1e293b',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });

    const hints = document.createElement('div');
    hints.style.fontSize = '11px';
    hints.style.color = '#64748b';
    hints.innerHTML = `[↑↓] Select Spell | [1-0] Assign Slot | [Enter] Cast | [Esc/Z] Close`;

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';

    if (currentSpell) {
      const castBtn = document.createElement('button');
      castBtn.type = 'button';
      Object.assign(castBtn.style, {
        padding: '6px 14px',
        backgroundColor: '#0284c7',
        color: '#f8fafc',
        border: '1px solid #38bdf8',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '11px',
        fontFamily: 'inherit',
        cursor: 'pointer',
      });
      castBtn.textContent = '⚡ Cast Spell [Enter]';
      castBtn.addEventListener('click', () => this.castCurrentSpell());
      btnGroup.appendChild(castBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    Object.assign(closeBtn.style, {
      padding: '6px 14px',
      backgroundColor: '#1e293b',
      color: '#e2e8f0',
      border: '1px solid #475569',
      borderRadius: '4px',
      fontWeight: 'bold',
      fontSize: '11px',
      fontFamily: 'inherit',
      cursor: 'pointer',
    });
    closeBtn.textContent = 'Close [Esc]';
    closeBtn.addEventListener('click', () => this.close());
    btnGroup.appendChild(closeBtn);

    footer.appendChild(hints);
    footer.appendChild(btnGroup);
    dialog.appendChild(footer);

    this.container.innerHTML = '';
    this.container.appendChild(dialog);
  }
}
