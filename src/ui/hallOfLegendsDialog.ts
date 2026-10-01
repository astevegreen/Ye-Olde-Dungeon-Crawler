import { Leaderboard, type HallOfFameEntry } from '../engine';
import type { ResolvedBranding } from './branding';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';
import { iconHtml } from './icons';
import { copyTextToClipboard } from './platform';

export interface HallOfLegendsOptions {
  leaderboard: Leaderboard;
  branding: ResolvedBranding;
  onShare: (entry: HallOfFameEntry) => void;
  onImport: () => void;
}

/**
 * The hall of fame (the pack names it, e.g. "Hall of Legends"): every inscribed run, best
 * first, with the selected one's epitaph. Opened from the title screen, in the one dialog
 * frame (ADR-0011). Like the title screen under it, a screen rather than a modal.
 */
export class HallOfLegendsDialog {
  private scrim: HTMLElement | null = null;
  private selectedId: string | null = null;
  private status = '';

  constructor(private readonly options: HallOfLegendsOptions) {}

  public get isOpen(): boolean {
    return this.scrim?.style.display === 'flex';
  }

  public open(): void {
    this.scrim ??= createDialogScrim('valhalla-modal');
    if (!this.scrim) return;
    this.status = '';
    this.render();
    this.scrim.style.display = 'flex';
  }

  public close(): void {
    if (this.scrim) this.scrim.style.display = 'none';
  }

  /** Redraws an open hall, e.g. after a shared saga is inscribed. */
  public refresh(): void {
    if (this.isOpen) this.render();
  }

  private selected(champions: HallOfFameEntry[]): HallOfFameEntry | null {
    return champions.find((c) => c.id === this.selectedId) ?? champions[0] ?? null;
  }

  private render(): void {
    const scrim = this.scrim;
    if (!scrim) return;
    const brand = this.options.branding;
    const champions = this.options.leaderboard.getChampions();
    const chosen = this.selected(champions);
    this.selectedId = chosen?.id ?? null;

    const rows = champions.length
      ? champions.map((c, i) => this.rowHtml(c, i, c.id === chosen?.id)).join('')
      : `<div class="ui-note hall-empty">No champions have yet entered the ${escapeHtml(brand.hallOfFameName)}. Embark on a saga to be recorded!</div>`;
    const epitaph = chosen ? Leaderboard.formatEpitaph(chosen, brand.xpName) : `No records in the ${brand.hallOfFameName}.`;
    const status = this.status || (chosen ? `${chosen.heroName}: ${chosen.score.toLocaleString()} points` : '');

    scrim.innerHTML = dialogHtml({
      title: brand.hallOfFameName,
      titleId: 'valhalla-modal-title',
      kicker: `Legends of ${brand.worldName}`,
      icon: 'trophy',
      closeId: 'btn-valhalla-close-x',
      closeTitle: 'Close',
      size: 'wide',
      body: `
        <div class="hall-grid">
          <div class="ui-col">
            <div class="ui-dialog-label">Champions</div>
            <div id="valhalla-list" class="hall-list ui-options">${rows}</div>
          </div>
          <div class="ui-col">
            <div class="ui-dialog-label">Epitaph</div>
            <pre id="valhalla-epitaph-card" class="ui-epitaph ui-inset">${escapeHtml(epitaph)}</pre>
          </div>
        </div>`,
      footNote: `<span id="valhalla-status">${escapeHtml(status)}</span>`,
      actions: [
        dialogButton('btn-valhalla-copy', 'Copy epitaph', { icon: 'copy', disabled: !chosen }),
        dialogButton('btn-valhalla-share', 'Share saga', { icon: 'share', disabled: !chosen }),
        dialogButton('btn-valhalla-import', 'Import saga', { icon: 'import' }),
        dialogButton('btn-valhalla-close', 'Close', { primary: true }),
      ].join(''),
    });

    scrim.querySelectorAll<HTMLElement>('[data-champion]').forEach((row) =>
      row.addEventListener('click', () => {
        this.selectedId = row.dataset.champion ?? null;
        this.status = '';
        this.render();
      })
    );
    const on = (id: string, fn: () => void) => scrim.querySelector(`#${id}`)?.addEventListener('click', fn);
    on('btn-valhalla-close-x', () => this.close());
    on('btn-valhalla-close', () => this.close());
    on('btn-valhalla-import', () => this.options.onImport());
    if (chosen) {
      on('btn-valhalla-share', () => this.options.onShare(chosen));
      on('btn-valhalla-copy', () => void this.copyEpitaph(chosen, epitaph));
    }
  }

  private rowHtml(c: HallOfFameEntry, index: number, selected: boolean): string {
    const won = c.status === 'victorious';
    return `
      <button type="button" class="ui-option hall-row${selected ? ' is-focused' : ''}" data-champion="${escapeHtml(c.id)}" aria-pressed="${selected}">
        <span class="ui-option-mark ui-num">${index + 1}</span>
        <span class="ui-option-body">
          <span class="ui-option-label">${iconHtml(c.gender === 'female' ? 'heroine' : 'hero')} ${escapeHtml(c.heroName)}</span>
          <span class="ui-option-desc">Level ${c.level} · Floor ${c.deepestFloor}</span>
        </span>
        <span class="hall-side">
          <span class="${won ? 'ui-up' : 'ui-down'}">${won ? 'Victor' : 'Fallen'}</span>
          <span class="ui-num">${c.score.toLocaleString()} pts</span>
        </span>
      </button>`;
  }

  private async copyEpitaph(champ: HallOfFameEntry, epitaph: string): Promise<void> {
    await copyTextToClipboard(epitaph);
    this.status = `Copied ${champ.heroName}'s epitaph.`;
    this.render();
  }
}
