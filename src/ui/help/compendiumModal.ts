import {
  type GameEngine,
  MonsterRegistry,
  type MonsterDefinition,
  type MonsterMasteryTier,
  type MasteryPerkId,
  type MasteryScope,
  MASTERY_PERKS,
  SPECIES_MASTERY_KILLS,
  getMonsterCategory,
  selectMasteryPerk,
} from '../../engine';
import type { UIModal } from '../modalStack';

export class CompendiumModal implements UIModal {
  public readonly id = 'compendium';
  public isOpen = false;
  private overlayEl: HTMLElement | null = null;
  /** Exposes the root DOM element for embedding in the character-menu tab shell. */
  public get rootElement(): HTMLElement | null { return this.overlayEl; }
  private activeFilter: 'all' | 'discovered' | 'mastered' = 'all';
  private selectedMonsterId: string = 'giant_rat';
  private engine?: GameEngine;
  private onCloseCallback?: () => void;

  constructor() {
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('compendium-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'compendium-modal';
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = '130';
      document.getElementById('app')?.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  public open(engine: GameEngine, onClose?: () => void): void {
    this.engine = engine;
    this.onCloseCallback = onClose;
    this.isOpen = true;
    this.render();
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
    }
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
    if (this.onCloseCallback) {
      const cb = this.onCloseCallback;
      this.onCloseCallback = undefined;
      cb();
    }
  }

  public onPop(): void {
    this.close();
  }

  public toggle(engine: GameEngine, onClose?: () => void): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(engine, onClose);
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    if (e.key === 'Escape' || e.code === 'KeyB') {
      this.close();
      return true;
    }

    const monsters = this.getFilteredMonsters();
    const currentIndex = monsters.findIndex((m) => m.id === this.selectedMonsterId);

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        this.selectedMonsterId = monsters[currentIndex - 1].id;
        this.render();
      }
      return true;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < monsters.length - 1) {
        this.selectedMonsterId = monsters[currentIndex + 1].id;
        this.render();
      }
      return true;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const filters: Array<'all' | 'discovered' | 'mastered'> = ['all', 'discovered', 'mastered'];
      const curIdx = filters.indexOf(this.activeFilter);
      this.activeFilter = filters[(curIdx + 1) % filters.length];
      const newFiltered = this.getFilteredMonsters();
      if (newFiltered.length > 0) {
        this.selectedMonsterId = newFiltered[0].id;
      }
      this.render();
      return true;
    }

    return true;
  }

  private getFilteredMonsters(): MonsterDefinition[] {
    const all = this.engine?.registries?.monsters?.getAll() ?? (this.engine?.manifest?.monsters ? (Array.isArray(this.engine.manifest.monsters) ? this.engine.manifest.monsters : Object.values(this.engine.manifest.monsters)) : MonsterRegistry.getAll());
    if (!this.engine) return all;

    const compendium = this.engine.compendium;

    return all.filter((m) => {
      const tier = compendium.getTier(m.id);
      if (this.activeFilter === 'discovered') {
        return tier >= 1;
      }
      if (this.activeFilter === 'mastered') {
        return tier === 3;
      }
      return true;
    });
  }

  public render(): void {
    if (!this.overlayEl || !this.engine) return;

    const compendium = this.engine.compendium;
    const allMonsters = this.engine?.registries?.monsters?.getAll() ?? (this.engine?.manifest?.monsters ? (Array.isArray(this.engine.manifest.monsters) ? this.engine.manifest.monsters : Object.values(this.engine.manifest.monsters)) : MonsterRegistry.getAll());
    const filtered = this.getFilteredMonsters();

    // Ensure selectedMonsterId is valid in filtered set
    if (!filtered.some((m) => m.id === this.selectedMonsterId) && filtered.length > 0) {
      this.selectedMonsterId = filtered[0].id;
    }

    const selectedDef = allMonsters.find((m) => m.id === this.selectedMonsterId) ?? this.engine?.registries?.monsters?.get(this.selectedMonsterId) ?? MonsterRegistry.get(this.selectedMonsterId) ?? allMonsters[0];
    if (!selectedDef) return;
    const selectedEntry = compendium.getEntry(selectedDef.id);
    const tier = selectedEntry.tier;
    const kills = selectedEntry.kills;

    // Counts
    const discoveredCount = allMonsters.filter((m) => compendium.getTier(m.id) >= 1).length;
    const masteredCount = allMonsters.filter((m) => compendium.getTier(m.id) === 3).length;

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="width: 780px; max-height: 88vh;">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>📖</span>
            <span>The Slayer's Compendium &amp; Monster Codex</span>
          </div>
          <button id="btn-compendium-close-x" class="win-btn win-btn-sm" style="padding: 0 5px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="gap: 8px;">
          <div class="retro-banner" style="background: #1e1b4b; padding: 6px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div class="retro-banner-title" style="color: #facc15; font-size: 13px;">THE SLAYER'S CODEX OF MIDGARD</div>
                <div class="retro-banner-sub" style="font-size: 11px;">Encounter fiends to record their habits. Slain foes reveal vulnerabilities. ${SPECIES_MASTERY_KILLS} kills of one creature — or many across its family — earn a Mastery Perk.</div>
              </div>
              <div style="text-align: right; font-size: 11px; font-weight: bold; color: #e2e8f0; white-space: nowrap;">
                <div>Discovered: <span style="color: #38bdf8;">${discoveredCount}/${allMonsters.length}</span></div>
                <div>Mastered: <span style="color: #facc15;">${masteredCount}/${allMonsters.length} ★</span></div>
              </div>
            </div>
          </div>

          <!-- Filter Tabs -->
          <div style="display: flex; gap: 4px; border-bottom: 2px solid #808080; padding-bottom: 4px;">
            <button id="tab-comp-all" class="win-btn win-btn-sm ${this.activeFilter === 'all' ? 'active-tab' : ''}" style="font-weight: bold; ${this.activeFilter === 'all' ? 'background: #000080; color: #fff;' : ''}">
              All Monsters (${allMonsters.length})
            </button>
            <button id="tab-comp-discovered" class="win-btn win-btn-sm ${this.activeFilter === 'discovered' ? 'active-tab' : ''}" style="font-weight: bold; ${this.activeFilter === 'discovered' ? 'background: #000080; color: #fff;' : ''}">
              Discovered (${discoveredCount})
            </button>
            <button id="tab-comp-mastered" class="win-btn win-btn-sm ${this.activeFilter === 'mastered' ? 'active-tab' : ''}" style="font-weight: bold; ${this.activeFilter === 'mastered' ? 'background: #000080; color: #fff;' : ''}">
              ★ Mastered (${masteredCount})
            </button>
          </div>

          <!-- Split View: List on left, details on right -->
          <div style="display: grid; grid-template-columns: 310px 1fr; gap: 10px; height: 350px;">
            <!-- Monster List -->
            <div class="retro-inset-list" style="overflow-y: auto; background: #0f172a; padding: 4px;">
              ${filtered
                .map((m) => {
                  const mEntry = compendium.getEntry(m.id);
                  const isSel = m.id === this.selectedMonsterId;
                  const mTier = mEntry.tier;
                  let badge = '<span style="color: #64748b;">[???]</span>';
                  let nameDisplay = '??? Unknown Fiend';

                  if (mTier === 1) {
                    badge = '<span style="color: #b45309; font-weight: bold;">[BRONZE]</span>';
                    nameDisplay = m.name;
                  } else if (mTier === 2) {
                    badge = `<span style="color: #94a3b8; font-weight: bold;">[SILVER ${mEntry.kills}k]</span>`;
                    nameDisplay = m.name;
                  } else if (mTier === 3) {
                    badge = `<span style="color: #facc15; font-weight: bold;">[GOLD ★]</span>`;
                    nameDisplay = m.name;
                  }

                  return `
                    <div class="compendium-row ${isSel ? 'selected' : ''}" data-id="${m.id}" style="padding: 4px 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; background: ${isSel ? '#1e3a8a' : 'transparent'}; color: ${isSel ? '#ffffff' : '#e2e8f0'}; font-size: 11px;">
                      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px;">${nameDisplay}</span>
                      <span style="font-size: 10px;">${badge}</span>
                    </div>
                  `;
                })
                .join('')}
            </div>

            <!-- Detail Pane -->
            <div class="retro-inset-list" style="overflow-y: auto; background: #090d16; color: #e2e8f0; padding: 12px; font-size: 11px; display: flex; flex-direction: column; gap: 8px;">
              ${this.renderDetailContent(selectedDef, tier, kills)}
            </div>
          </div>

          <div class="retro-statusbar" style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px;">
            <span style="font-size: 11px; color: #374151;">Use Arrow Keys to select, Tab to cycle filters, Esc or B to close.</span>
            <button id="btn-compendium-close" class="win-btn primary-btn" style="padding: 3px 12px;">Close</button>
          </div>
        </div>
      </div>
    `;

    // Hook listeners
    document.getElementById('btn-compendium-close-x')?.addEventListener('click', () => this.close());
    document.getElementById('btn-compendium-close')?.addEventListener('click', () => this.close());

    document.getElementById('tab-comp-all')?.addEventListener('click', () => {
      this.activeFilter = 'all';
      this.render();
    });
    document.getElementById('tab-comp-discovered')?.addEventListener('click', () => {
      this.activeFilter = 'discovered';
      this.render();
    });
    document.getElementById('tab-comp-mastered')?.addEventListener('click', () => {
      this.activeFilter = 'mastered';
      this.render();
    });

    const rows = this.overlayEl.querySelectorAll('.compendium-row');
    rows.forEach((r) => {
      r.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          this.selectedMonsterId = id;
          this.render();
        }
      });
    });

    const perkButtons = this.overlayEl.querySelectorAll('.btn-select-perk');
    perkButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const perkId = el.getAttribute('data-perk') as MasteryPerkId | null;
        const scope = el.getAttribute('data-scope') as MasteryScope | null;
        const masteryId = el.getAttribute('data-mastery');
        if (perkId && scope && masteryId && this.engine) {
          selectMasteryPerk(this.engine, scope, masteryId, perkId);
          this.render();
        }
      });
    });
  }

  /** Progress bar plus the perk picker for one mastery (a monster type or its category). */
  private renderMasteryPanel(opts: {
    scope: MasteryScope;
    masteryId: string;
    title: string;
    subject: string;
    kills: number;
    needed: number;
    perk?: MasteryPerkId;
    /** The perk already active through the other mastery; picking it again adds nothing. */
    otherPerk?: MasteryPerkId;
    note?: string;
  }): string {
    const unlocked = opts.kills >= opts.needed;
    const progressPercent = Math.round((Math.min(opts.kills, opts.needed) / opts.needed) * 100);
    const inTown = (this.engine?.currentFloor ?? 1) === 0;
    const remaining = opts.needed - opts.kills;

    const picker = unlocked
      ? `
        <div style="font-size: 10px; color: #fef08a; font-weight: bold; margin-bottom: 6px;">
          ${opts.perk ? `Mastery perk against ${opts.subject}:` : `Choose a mastery perk against ${opts.subject}:`}
          <span style="font-weight: normal; color: #94a3b8; display: block; margin-top: 2px;">
            ${
              inTown
                ? '🏰 In Town: you may freely choose or switch perks.'
                : opts.perk
                ? '⚔️ In the dungeon your perk is locked. Return to Town to change it.'
                : '⚡ Mastery earned: pick your perk below.'
            }
          </span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 6px;">
          ${Object.values(MASTERY_PERKS)
            .map((perk) => {
              const isSelected = opts.perk === perk.id;
              const canSelect = inTown || !opts.perk;
              const redundant = !isSelected && opts.otherPerk === perk.id;
              return `
                <div style="background: ${isSelected ? '#14532d' : '#0f172a'}; border: 1px solid ${isSelected ? '#22c55e' : '#334155'}; padding: 6px 8px; border-radius: 2px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 13px;">${perk.icon}</span>
                      <b style="color: ${isSelected ? '#86efac' : '#38bdf8'}; font-size: 11px;">${perk.name}</b>
                      <span style="font-size: 9px; color: #94a3b8; font-style: italic;">— ${perk.tagline}</span>
                    </div>
                    <div style="font-size: 10px; color: ${isSelected ? '#dcfce7' : '#cbd5e1'}; margin-top: 2px;">
                      ${perk.description}
                    </div>
                    ${redundant ? `<div style="font-size: 9px; color: #fbbf24; margin-top: 2px;">Already active through your other mastery — it would not stack.</div>` : ''}
                  </div>
                  <div>
                    ${
                      isSelected
                        ? `<span style="display: inline-block; padding: 2px 6px; background: #22c55e; color: #052e16; font-size: 9px; font-weight: bold; border-radius: 2px;">ACTIVE</span>`
                        : canSelect
                        ? `<button class="win-btn win-btn-sm btn-select-perk" data-scope="${opts.scope}" data-mastery="${opts.masteryId}" data-perk="${perk.id}" style="font-size: 10px; padding: 2px 8px; cursor: pointer;">Select</button>`
                        : `<span style="font-size: 9px; color: #64748b;">🔒 In Dungeon</span>`
                    }
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `
      : `
        <div style="font-size: 10px; color: #cbd5e1;">
          Slay ${remaining} more to master ${opts.subject} and choose a perk: <b>Anatomist</b>, <b>Survivor</b>, <b>Trophy Hunter</b>, <b>Essence Siphon</b> or <b>Plunderer</b>.
        </div>
      `;

    return `
      <div style="background: ${unlocked ? '#14251a' : '#1e1b4b'}; border: 1px solid ${unlocked ? '#22c55e' : '#4338ca'}; padding: 10px; border-radius: 3px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-weight: bold; color: ${unlocked ? '#86efac' : '#a5b4fc'}; font-size: 11px;">
            ${unlocked ? '★ ' : ''}${opts.title}
          </span>
          <span style="font-size: 10px; color: #e2e8f0;">${opts.kills}/${opts.needed} Kills (${progressPercent}%)</span>
        </div>
        ${opts.note ? `<div style="font-size: 9px; color: #94a3b8; margin-bottom: 4px;">${opts.note}</div>` : ''}
        <div style="height: 6px; background: #0f172a; border: 1px solid #334155; margin-bottom: 8px;">
          <div style="height: 100%; width: ${progressPercent}%; background: ${unlocked ? '#22c55e' : '#eab308'};"></div>
        </div>
        ${picker}
      </div>
    `;
  }

  private renderDetailContent(def: MonsterDefinition, tier: MonsterMasteryTier, kills: number): string {
    if (tier === 0) {
      return `
        <div style="text-align: center; padding: 40px 10px; color: #64748b;">
          <div style="font-size: 48px; margin-bottom: 8px;">❓</div>
          <div style="font-size: 14px; font-weight: bold; color: #94a3b8; margin-bottom: 6px;">Undiscovered Creature</div>
          <div style="max-width: 320px; margin: 0 auto; font-size: 11px;">You have not yet laid eyes on this creature in the dungeon depths. Explore deeper subterranean floors to encounter it and reveal its profile.</div>
        </div>
      `;
    }

    const tierLabels = [
      'Tier 0: Undiscovered',
      'Tier 1: Encountered (Bronze)',
      'Tier 2: Slain (Silver)',
      'Tier 3: Mastered (Gold ★)',
    ];

    const compendium = this.engine?.compendium;
    const category = this.engine ? getMonsterCategory(this.engine, def.id) : undefined;

    return `
      <div style="border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="color: #38bdf8; font-size: 15px; margin: 0;">${def.name}</h3>
          <span style="font-size: 10px; padding: 2px 6px; background: ${tier === 3 ? '#854d0e' : '#1e293b'}; color: ${tier === 3 ? '#fef08a' : '#94a3b8'}; border: 1px solid ${tier === 3 ? '#eab308' : '#334155'}; font-weight: bold;">
            ${tierLabels[tier]}
          </span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
          Floor Habitat: Floor ${def.minFloor ?? 1}+   |   AI Behavior: ${def.aiType.toUpperCase()}
        </div>
      </div>

      ${this.renderMasteryPanel({
        scope: 'species',
        masteryId: def.id,
        title: `${def.name} Mastery`,
        subject: 'this creature',
        kills,
        needed: SPECIES_MASTERY_KILLS,
        perk: compendium?.getPerk(def.id),
        otherPerk: category ? compendium?.getCategoryPerk(category.id) : undefined,
      })}
      ${
        category && compendium
          ? this.renderMasteryPanel({
              scope: 'category',
              masteryId: category.id,
              title: `${category.icon ?? ''} ${category.name} (Category)`.trim(),
              subject: `every creature of ${category.name}`,
              kills: compendium.getCategoryKills(category),
              needed: category.masteryKills,
              perk: compendium.getCategoryPerk(category.id),
              otherPerk: compendium.getPerk(def.id),
              note: category.description,
            })
          : ''
      }

      <!-- Tier 1 & 2 Attributes -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div style="background: #111827; padding: 6px; border: 1px inset #1e293b;">
          <span style="color: #38bdf8; font-weight: bold;">Vitality &amp; Speed</span>
          <div style="margin-top: 4px; color: #cbd5e1;">
            ${
              tier >= 3
                ? `<div>• Max Hit Points: <b>${def.stats.maxHp} HP</b></div>
                   <div>• Movement Speed: <b>${def.speed}</b></div>
                   <div>• Base Attack: <b>${def.stats.attack}</b> | Defense: <b>${def.stats.defense}</b></div>`
                : tier >= 2
                ? `<div>• Estimated Vitality: ~${Math.round(def.stats.maxHp * 0.8)}-${Math.round(def.stats.maxHp * 1.2)} HP</div>
                   <div>• Speed: ${def.speed > 100 ? 'Fast' : def.speed < 100 ? 'Sluggish' : 'Normal'} (${def.speed})</div>
                   <div>• Combat Threat: Tier ${Math.ceil((def.minFloor ?? 1) / 10) || 1}</div>`
                : `<div>• Speed: ${def.speed > 100 ? 'Fast' : def.speed < 100 ? 'Sluggish' : 'Normal'}</div>
                   <div>• Slay at least once to reveal exact threat ratings!</div>`
            }
          </div>
        </div>

        <div style="background: #111827; padding: 6px; border: 1px inset #1e293b;">
          <span style="color: #38bdf8; font-weight: bold;">Elemental Affinities</span>
          <div style="margin-top: 4px; color: #cbd5e1;">
            ${
              tier >= 2
                ? Object.entries(def.resistances ?? {}).length > 0
                  ? Object.entries(def.resistances!)
                      .filter(([, aff]) => Boolean(aff))
                      .map(([elem, aff]) => `<div>• ${elem.toUpperCase()}: <b style="color: ${aff === 'weak' ? '#ef4444' : aff === 'absorbing' ? '#22c55e' : '#38bdf8'}">${(aff ?? '').toUpperCase()}</b></div>`)
                      .join('')
                  : '<div>• No special elemental vulnerabilities.</div>'
                : '<div>• <i style="color: #64748b;">Requires Tier 2 (First Slain) to unlock elemental analysis.</i></div>'
            }
          </div>
        </div>
      </div>

      <!-- Tier 3 Special Abilities & Drop Hints -->
      <div style="background: #111827; padding: 6px; border: 1px inset #1e293b;">
        <span style="color: #38bdf8; font-weight: bold;">Abilities &amp; Drops</span>
        <div style="margin-top: 4px; color: #cbd5e1;">
          ${
            tier >= 3
              ? `<div>• Spells / Wind-Ups: ${def.spells && def.spells.length > 0 ? def.spells.join(', ') : 'Melee attack only'}</div>
                 <div>• Status On-Hit: ${def.onHitAffliction ? `${def.onHitAffliction.type} (${Math.round(def.onHitAffliction.chance * 100)}% chance)` : 'None'}</div>
                 <div>• Drop Table: ${def.lootTable.length} potential items (Megin Value: ${def.xpValue})</div>`
              : tier >= 2
              ? `<div>• Status Affliction: ${def.onHitAffliction ? `${def.onHitAffliction.type}` : 'None known'}</div>
                 <div>• Known to carry gold and equipment into battle.</div>`
              : `<div>• <i style="color: #64748b;">Defeat this creature to reveal special techniques and drop tables.</i></div>`
          }
        </div>
      </div>
    `;
  }
}
