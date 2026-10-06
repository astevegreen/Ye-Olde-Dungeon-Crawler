import {
  flightRecorder,
  type GameEngine,
  type CharacterProfile,
  type BulkArchive,
  type BugReportScope,
  type DiagnosticPackage,
  type DiagnosticPackageOptions,
  sanitizePaths,
} from '../engine';
import type { UIModal, ModalStackManager } from './modalStack';
import { copyTextToClipboard, defaultPlatformAdapter, browserReportContext, downloadDataUrl } from './platform';
import { showToast as showGlobalToast } from './toast';
import { encodeReplayBlock } from './replayCodec';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';

export type FeedbackType = 'bug' | 'feature';

export interface FeedbackModalOptions {
  getEngine: () => GameEngine | null;
  getProfile?: () => CharacterProfile | null;
  bulkArchive?: BulkArchive | null;
  modalStack?: ModalStackManager;
  onClosed?: () => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  repoUrl?: string;
  /** A PNG data URL of the game view as it is now, or null when there's no game on screen. */
  captureScreenshot?: () => string | null;
  /**
   * Bug-report relay (relay/): files the issue itself, so testers need no GitHub account
   * and never paste. Unset, or unreachable, falls back to opening GitHub's new-issue page.
   */
  relayUrl?: string;
}

export interface FeedbackOpenOptions {
  type?: FeedbackType;
  error?: Error | string;
  subject?: string;
  description?: string;
  category?: string;
  /** Build of the session being reported, when it isn't this one (a recovered freeze). */
  buildId?: string;
  appVersion?: string;
}

interface BugCategory {
  label: string;
  scope: BugReportScope;
  /** What the report will contain, shown under the form; keep it true to FlightRecorder. */
  contents: string;
  includeLog: boolean;
  includeReplay: boolean;
}

const BUG_CATEGORIES: readonly BugCategory[] = [
  {
    label: 'Crash / Freeze',
    scope: 'crash',
    contents: 'Error and stack, full action log, map around the hero, and replay data (a save plus every action since it).',
    includeLog: true,
    includeReplay: true,
  },
  {
    label: 'Combat & Spells',
    scope: 'combat',
    contents: 'Combat, spell and movement log, map around the hero, hero stats, and replay data.',
    includeLog: true,
    includeReplay: true,
  },
  {
    label: 'Items & Inventory',
    scope: 'items',
    contents: "Item and loot log, and the hero's equipment and encumbrance. No map; replay data only if ticked.",
    includeLog: true,
    includeReplay: false,
  },
  {
    label: 'Map & Movement',
    scope: 'map',
    contents: 'Movement, stairs and door log, floor changes, map around the hero, and replay data.',
    includeLog: true,
    includeReplay: true,
  },
  {
    label: 'Visual & UI',
    scope: 'visual',
    contents: 'Screen size, pixel ratio and device, plus a screenshot you attach. No log, map or replay data unless ticked.',
    includeLog: false,
    includeReplay: false,
  },
  {
    label: 'Balance & Rules',
    scope: 'balance',
    contents: 'Full action log, map around the hero, hero stats, and replay data.',
    includeLog: true,
    includeReplay: true,
  },
  {
    label: 'Other',
    scope: 'other',
    contents: 'Full action log, map around the hero, hero stats, and replay data.',
    includeLog: true,
    includeReplay: true,
  },
];

/** A GitHub new-issue URL much past ~8k characters is rejected; leave room for title and labels. */
const ISSUE_URL_BODY_BUDGET = 6000;
/** GitHub caps an issue body at 65,536 characters; the prefilled body takes some of that. */
const ISSUE_PASTE_BUDGET = 55000;

const FEATURE_CATEGORIES = [
  'Gameplay & Mechanics',
  'Items & Equipment',
  'Spells & Magic',
  'Quality of Life',
  'Aesthetics & Sound',
  'Content & Lore',
  'Other',
];

export const CATEGORY_LABELS: Record<string, string[]> = {
  // Bug categories
  'Crash / Freeze': ['crash'],
  'Combat & Spells': ['area:combat', 'area:magic'],
  'Items & Inventory': ['area:inventory'],
  'Map & Movement': ['area:map'],
  'Visual & UI': ['area:ui'],
  'Balance & Rules': ['balance'],

  // Feature categories
  'Gameplay & Mechanics': ['gameplay'],
  'Items & Equipment': ['area:inventory'],
  'Spells & Magic': ['area:magic'],
  'Quality of Life': ['quality-of-life'],
  'Aesthetics & Sound': ['area:ui'],
  'Content & Lore': ['content'],

  // Fallback
  'Other': ['triage'],
};

export class FeedbackModal implements UIModal {
  public readonly id = 'feedback-modal';
  public isOpen = false;

  private modalEl: HTMLElement | null = null;
  private titleInput: HTMLInputElement | null = null;
  private categorySelect: HTMLSelectElement | null = null;
  private descTextarea: HTMLTextAreaElement | null = null;
  private btnBugTab: HTMLButtonElement | null = null;
  private btnFeatureTab: HTMLButtonElement | null = null;
  private telemetryContainer: HTMLElement | null = null;
  private checkIncludeLog: HTMLInputElement | null = null;
  private checkIncludeSnapshot: HTMLInputElement | null = null;
  private telemetryPreview: HTMLElement | null = null;
  private scopeDescEl: HTMLElement | null = null;

  private currentType: FeedbackType = 'bug';
  private errorContext?: Error | string;
  private buildOverride: { buildId?: string; appVersion?: string } = {};
  /** The game view when the window opened, before the tester's next move changes it. */
  private screenshot: string | null = null;
  /** Set when the relay couldn't take a report; the next Submit goes through GitHub. */
  private relayFailed = false;
  private sending = false;
  /** Replay data gzip+base64-encoded ahead of Submit, which must write the clipboard synchronously. */
  private compressedReplay: string | null = null;
  private compressing: Promise<void> = Promise.resolve();
  /** Whether the window is showing. Kept apart from `isOpen`, which the modal stack
   *  clears before it calls `close()`, so a stack-driven close still hides the window. */
  private shown = false;

  constructor(private readonly options: FeedbackModalOptions) {
    this.createDom();
    this.bindEvents();
  }

  public setModalStack(stack: ModalStackManager): void {
    this.options.modalStack = stack;
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    this.modalEl = createDialogScrim('feedback-modal', 'system');
    if (!this.modalEl) return;
    // Focusable, so a click anywhere in the overlay (or on a button, which WebKit does not
    // focus) keeps keyboard focus — and keydown — inside the modal.
    this.modalEl.tabIndex = -1;
    this.modalEl.style.outline = 'none';

    this.modalEl.innerHTML = dialogHtml({
      title: 'Send feedback',
      titleId: 'feedback-modal-title',
      closeId: 'btn-feedback-close-x',
      body: `
        <div class="st-subtabs" role="tablist">
          <button type="button" id="btn-feedback-tab-bug" class="st-subtab" role="tab" aria-selected="true">Report a bug</button>
          <button type="button" id="btn-feedback-tab-feature" class="st-subtab" role="tab" aria-selected="false">Suggest a feature</button>
        </div>
        <div class="fb-row">
          <label class="ui-field fb-grow"><span class="ui-dialog-label">Title</span>
            <input id="feedback-input-title" type="text" class="ui-input" placeholder="A short summary" /></label>
          <label class="ui-field"><span class="ui-dialog-label">Category</span>
            <select id="feedback-select-category" class="ui-select"></select></label>
        </div>
        <label class="ui-field"><span class="ui-dialog-label" id="feedback-desc-label">What happened</span>
          <textarea id="feedback-textarea-desc" class="ui-textarea" rows="5" placeholder="What happened? What were you doing when it occurred?"></textarea></label>
        <div id="feedback-telemetry-panel" class="ui-fact">
          <div class="fb-row fb-between"><b>Diagnostic package</b><span id="feedback-telemetry-preview" class="ui-num ui-faint">Floor 1 | Turn 0</span></div>
          <div id="feedback-scope-desc" class="ui-note">Includes: full action log, map around the hero, and replay data.</div>
          <div class="fb-row">
            <label class="fb-check"><input type="checkbox" id="feedback-check-log" checked /> Include the action log</label>
            <label class="fb-check"><input type="checkbox" id="feedback-check-snapshot" checked /> Include replay data (save and actions since)</label>
          </div>
        </div>
        <div class="fb-row">
          ${dialogButton('btn-feedback-copy', 'Copy report for AI', { attrs: 'title="Copy the report as markdown"' })}
          ${dialogButton('btn-feedback-download', 'Save .json', { attrs: 'title="Download the diagnostic package"' })}
          ${dialogButton('btn-feedback-screenshot', 'Save screenshot', { attrs: 'title="Save a picture of the game view, taken when this window opened"' })}
        </div>`,
      actions: dialogButton('btn-feedback-cancel', 'Cancel') + dialogButton('btn-feedback-submit', 'Submit', { primary: true }),
    });

    this.titleInput = this.modalEl.querySelector('#feedback-input-title');
    this.categorySelect = this.modalEl.querySelector('#feedback-select-category');
    this.descTextarea = this.modalEl.querySelector('#feedback-textarea-desc');
    this.btnBugTab = this.modalEl.querySelector('#btn-feedback-tab-bug');
    this.btnFeatureTab = this.modalEl.querySelector('#btn-feedback-tab-feature');
    this.telemetryContainer = this.modalEl.querySelector('#feedback-telemetry-panel');
    this.checkIncludeLog = this.modalEl.querySelector('#feedback-check-log');
    this.checkIncludeSnapshot = this.modalEl.querySelector('#feedback-check-snapshot');
    this.telemetryPreview = this.modalEl.querySelector('#feedback-telemetry-preview');
    this.scopeDescEl = this.modalEl.querySelector('#feedback-scope-desc');

    this.populateCategories();
  }

  private bindEvents(): void {
    if (!this.modalEl) return;

    // The modal's one input path. The overlay covers the screen and holds focus while
    // open, so every keystroke starts inside it; handleKeyDown stops propagation, so
    // InputHandler's window listener never sees the same key. This also works on the
    // main menu, where InputHandler is disabled and the modal stack routes nothing.
    this.modalEl.addEventListener('keydown', (e) => this.handleKeyDown(e as KeyboardEvent));

    this.modalEl.querySelector('#btn-feedback-close-x')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btn-feedback-cancel')?.addEventListener('click', () => this.close());

    this.btnBugTab?.addEventListener('click', () => this.switchType('bug'));
    this.btnFeatureTab?.addEventListener('click', () => this.switchType('feature'));

    this.categorySelect?.addEventListener('change', () => {
      this.updateScopeDescription();
    });

    this.modalEl.querySelector('#btn-feedback-submit')?.addEventListener('click', () => {
      this.submitToGitHub();
    });

    this.modalEl.querySelector('#btn-feedback-copy')?.addEventListener('click', () => {
      void this.copyReport();
    });

    this.modalEl.querySelector('#btn-feedback-download')?.addEventListener('click', () => {
      this.downloadReport();
    });

    this.modalEl.querySelector('#btn-feedback-screenshot')?.addEventListener('click', () => {
      this.saveScreenshot();
    });
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    if (e.key === 'Escape' || e.code === 'F3') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return true;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.submitToGitHub();
      return true;
    }

    // Stop hotkeys from bleeding into the game while typing
    e.stopPropagation();
    return true;
  }

  public open(opts: FeedbackOpenOptions = {}): void {
    if (!this.modalEl) {
      this.createDom();
      this.bindEvents();
    }
    if (!this.modalEl) return;

    this.isOpen = true;
    this.shown = true;
    this.errorContext = opts.error;
    this.relayFailed = false;
    this.setSubmitLabel(this.options.relayUrl ? 'Send report' : 'Submit on GitHub', false);
    this.screenshot = this.options.captureScreenshot?.() ?? null;
    const shotBtn = this.modalEl.querySelector<HTMLElement>('#btn-feedback-screenshot');
    if (shotBtn) shotBtn.style.display = this.screenshot ? '' : 'none';
    this.buildOverride = {
      ...(opts.buildId ? { buildId: opts.buildId } : {}),
      ...(opts.appVersion ? { appVersion: opts.appVersion } : {}),
    };
    this.modalEl.style.display = 'flex';

    if (this.options.modalStack && !this.options.modalStack.has(this.id)) {
      this.options.modalStack.push(this);
    }

    this.switchType(opts.type ?? (opts.error ? 'bug' : 'bug'));

    const engine = this.options.getEngine();
    const floor = engine?.currentFloor ?? 1;
    const turn = engine?.turnCount ?? 0;
    const initialCategory = opts.category ?? this.categorySelect?.value ?? 'Combat & Spells';

    if (this.titleInput) {
      this.titleInput.value = opts.subject ?? (opts.error ? `Crash: ${opts.error instanceof Error ? opts.error.message : String(opts.error)}` : '');
      this.titleInput.placeholder = `[Floor ${floor} | Turn ${turn}] ${initialCategory} (or leave blank to auto-generate)`;
    }

    if (this.descTextarea) {
      this.descTextarea.value = opts.description ?? '';
    }

    if (opts.category && this.categorySelect) {
      this.categorySelect.value = opts.category;
    }

    this.updateTelemetryPreview();
    this.updateScopeDescription();
    this.prepareCompressedReplay();

    // Focus the title input, which also puts keystrokes on the modal's own listener.
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(() => {
        this.titleInput?.focus();
      }, 50);
    }
  }

  public close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.isOpen = false;
    if (this.modalEl) {
      // Release focus from the form, or game keys would keep landing in a hidden field.
      const focused = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
      if (focused && typeof this.modalEl.contains === 'function' && this.modalEl.contains(focused)) {
        focused.blur();
      }
      this.modalEl.style.display = 'none';
    }

    if (this.options.modalStack?.has(this.id)) {
      this.options.modalStack.remove(this.id);
    }

    if (this.options.onClosed) {
      this.options.onClosed();
    }
  }

  public switchType(type: FeedbackType): void {
    this.currentType = type;
    const isBug = type === 'bug';

    if (this.btnBugTab && this.btnFeatureTab) {
      if (isBug) {
        this.btnBugTab.setAttribute('aria-selected', 'true');
        this.btnFeatureTab.setAttribute('aria-selected', 'false');
      } else {
        this.btnFeatureTab.setAttribute('aria-selected', 'true');
        this.btnBugTab.setAttribute('aria-selected', 'false');
      }
    }

    if (this.telemetryContainer) {
      this.telemetryContainer.style.display = isBug ? 'block' : 'none';
    }

    const descLabel = this.modalEl?.querySelector('#feedback-desc-label');
    if (descLabel && this.descTextarea) {
      if (isBug) {
        descLabel.textContent = 'Details & Steps to Reproduce:';
        this.descTextarea.placeholder = 'What happened? What were you doing right before the issue occurred?';
      } else {
        descLabel.textContent = 'Feature Proposal & Impact:';
        this.descTextarea.placeholder = 'Describe your idea and how it improves the dungeon crawling experience...';
      }
    }

    this.populateCategories();
    this.updateScopeDescription();
  }

  private populateCategories(): void {
    if (!this.categorySelect) return;
    const categories = this.currentType === 'bug' ? BUG_CATEGORIES.map((c) => c.label) : FEATURE_CATEGORIES;
    this.categorySelect.innerHTML = categories
      .map((cat) => `<option value="${cat}">${cat}</option>`)
      .join('');
    if (!categories.includes(this.categorySelect.value)) {
      this.categorySelect.value = categories[0] ?? 'Other';
    }
  }

  private currentBugCategory(): BugCategory {
    const label = this.categorySelect?.value;
    return BUG_CATEGORIES.find((c) => c.label === label) ?? BUG_CATEGORIES[BUG_CATEGORIES.length - 1];
  }

  private updateScopeDescription(): void {
    if (!this.scopeDescEl) return;
    // "Send report" files the issue for the player: say plainly that it is public.
    const publicNote = this.options.relayUrl ? ' Sent reports become public GitHub issues, your hero’s name included.' : '';
    if (this.currentType !== 'bug') {
      this.scopeDescEl.textContent = `Suggestion: help us expand and balance the realm!${publicNote}`;
      return;
    }
    const cat = this.currentBugCategory();
    this.scopeDescEl.textContent = `Includes: ${cat.contents}${publicNote}`;
    if (this.checkIncludeLog) this.checkIncludeLog.checked = cat.includeLog;
    if (this.checkIncludeSnapshot) this.checkIncludeSnapshot.checked = cat.includeReplay;
  }

  private updateTelemetryPreview(): void {
    if (!this.telemetryPreview) return;
    const engine = this.options.getEngine();
    if (engine && engine.player) {
      this.telemetryPreview.textContent = `Floor ${engine.currentFloor} | Turn ${engine.turnCount} | Level ${engine.player.level} (${engine.manifest?.id ?? 'cotw'})`;
    } else {
      this.telemetryPreview.textContent = 'No active dungeon simulation loaded';
    }
  }

  private notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (this.options.showToast) {
      this.options.showToast(message, type);
    } else {
      showGlobalToast(message, type);
    }
  }

  private reportOptions(): DiagnosticPackageOptions {
    const engine = this.options.getEngine() ?? undefined;
    const isBug = this.currentType === 'bug';
    const includeLog = isBug && (this.checkIncludeLog?.checked ?? true);
    const includeReplay = isBug && (this.checkIncludeSnapshot?.checked ?? true);

    const category = this.categorySelect?.value || 'Other';
    const floor = engine?.currentFloor ?? 1;
    const turn = engine?.turnCount ?? 0;
    const defaultSubject = isBug ? `[Floor ${floor} | Turn ${turn}] ${category} Issue` : 'Feature Request';
    const subject = this.titleInput?.value.trim() || defaultSubject;
    const rawDescription = this.descTextarea?.value.trim() || '*(No details provided)*';

    return {
      scope: isBug ? this.currentBugCategory().scope : undefined,
      includeSnapshot: includeReplay,
      includeReplay,
      // Unset for bugs: the scope decides whether the surrounding map is relevant.
      includeMap: isBug ? undefined : false,
      maxEvents: includeLog ? 50 : 0,
      error: this.errorContext,
      subject,
      category,
      userNotes: sanitizePaths(rawDescription),
      ...browserReportContext(),
      ...this.buildOverride,
    };
  }

  private buildPackage(): DiagnosticPackage {
    return flightRecorder.generatePackage(
      this.options.getEngine() ?? undefined,
      this.options.getProfile?.() ?? undefined,
      this.reportOptions()
    );
  }

  private prepareCompressedReplay(): void {
    this.compressedReplay = null;
    const replay = flightRecorder.getReplayData(this.options.getEngine() ?? undefined);
    if (!replay || typeof CompressionStream === 'undefined') return;
    this.compressing = encodeReplayBlock(JSON.stringify(replay))
      .then((block) => {
        this.compressedReplay = block;
      })
      .catch(() => undefined);
  }

  /** Resolves once the replay data opened with the modal has been compressed. */
  public whenReplayCompressed(): Promise<void> {
    return this.compressing;
  }

  /**
   * The report the tester pastes into the issue, within GitHub's body limit. In order of
   * preference: the full report with readable replay JSON; the report with the replay
   * data compressed; the report without replay data (Save .json still has it).
   */
  private buildPasteText(pkg: DiagnosticPackage): { text: string; trimmed: boolean } {
    const full = pkg.markdownReport ?? pkg.summary;
    if (full.length <= ISSUE_PASTE_BUDGET) return { text: full, trimmed: false };
    const lean = flightRecorder.generateReport(this.options.getEngine() ?? undefined, this.options.getProfile?.() ?? undefined, {
      ...this.reportOptions(),
      includeReplay: false,
      includeSnapshot: false,
    });
    if (pkg.reproduction?.replay && this.compressedReplay) {
      const section =
        '\n## 5. Replay Data (gzip + base64: read by F2 > Load State From Report and scripts/replay-report.ts)\n' +
        '```replay-gz\n' + this.compressedReplay + '\n```\n';
      if (lean.length + section.length <= ISSUE_PASTE_BUDGET) return { text: lean + section, trimmed: false };
    }
    return { text: lean.slice(0, ISSUE_PASTE_BUDGET), trimmed: !!pkg.reproduction?.replay };
  }

  /**
   * The prefilled issue body. It travels in the URL, so it holds what a developer needs
   * first (what happened, where, the error, the last actions) and leaves out sections
   * that don't fit; the tester pastes the full report beneath it.
   */
  private buildIssueBody(pkg: DiagnosticPackage, description: string, category: string, isBug: boolean, forRelay = false): string {
    const body: string[] = [
      '### Description',
      description,
      '',
      `- **Category**: ${category}`,
      `- **Type**: ${isBug ? 'Bug Report' : 'Feature Request'}`,
    ];
    if (!isBug) return body.join('\n');

    const m = pkg.metadata;
    const r = pkg.reproduction;
    body.push(`- **Build**: \`${m.engineVersion}\` (commit \`${m.buildId ?? 'unknown'}\`)`);
    if (!forRelay) {
      // The relay sends the full report and screenshot itself; only the GitHub page needs these.
      body.push('');
      body.push('> 📋 **Tester: paste the copied report below this line** (Ctrl+V, or long-press → Paste on a phone), then press Submit.');
      body.push(
        pkg.metadata.scope === 'visual'
          ? '> 📸 **A screenshot matters most for this kind of bug.** Use *Save Screenshot* in the report window, or your device\'s own screenshot, then drag it into this box (or tap the attach button on a phone).'
          : '> 📸 A screenshot helps too (*Save Screenshot* in the report window, or your device\'s own); drag it into this box to attach.'
      );
    }

    const optional: string[][] = [];
    const err = this.errorContext;
    if (err) {
      const message = sanitizePaths(err instanceof Error ? err.message : String(err));
      const stack = err instanceof Error && err.stack ? sanitizePaths(err.stack.split('\n').slice(0, 6).join('\n')) : '';
      optional.push(['### ⚠️ Error', `\`${message}\``, ...(stack ? ['```', stack, '```'] : [])]);
    }
    if (r) {
      optional.push([
        '### Where',
        `Floor \`${r.floor}\`, turn \`${r.turn}\`, hero at \`(${r.playerCoords.x}, ${r.playerCoords.y})\`, manifest \`${r.manifestId}\`, PRNG \`${r.prngState ?? 'unknown'}\``,
      ]);
      if (r.recentActions.length > 0) {
        optional.push(['### Last player actions (oldest first)', ...r.recentActions.map((a, i) => `${i + 1}. \`${a}\``)]);
      }
    }
    optional.push(['### Device', `\`${m.display ?? ''}\` · \`${m.userAgent ?? ''}\``]);
    if (pkg.asciiMap) optional.push(['### Map around the hero', '```text', pkg.asciiMap, '```']);

    const encodedLength = (lines: string[]): number => encodeURIComponent(lines.join('\n')).length;
    for (const section of optional) {
      const candidate = [...body, '', ...section];
      if (encodedLength(candidate) <= ISSUE_URL_BODY_BUDGET) body.splice(0, body.length, ...candidate);
    }
    let text = body.join('\n');
    // Only a very long description gets here; cut it rather than lose the rest.
    while (encodeURIComponent(text).length > ISSUE_URL_BODY_BUDGET) text = text.slice(0, Math.floor(text.length * 0.9));
    return text;
  }

  public async copyReport(format: 'markdown' | 'json' = 'markdown'): Promise<void> {
    const pkg = this.buildPackage();
    const textToCopy = format === 'json'
      ? JSON.stringify(pkg, null, 2)
      : (pkg.markdownReport ?? pkg.summary);

    const success = await copyTextToClipboard(textToCopy);
    if (success) {
      this.notify(
        format === 'json'
          ? 'Copied full diagnostic JSON to clipboard!'
          : 'Copied AI-Ready bug report to clipboard!',
        'success'
      );
    } else {
      this.notify('Failed to copy to clipboard.', 'error');
    }
  }

  public downloadReport(): void {
    const pkg = this.buildPackage();
    const json = JSON.stringify(pkg, null, 2);
    const filename = `yodc-${this.currentType}-${Date.now()}.json`;
    defaultPlatformAdapter.triggerFileDownload(filename, json, 'application/json');
    this.notify(`Downloaded ${filename}`, 'success');
  }

  public saveScreenshot(): void {
    if (!this.screenshot) {
      this.notify('No game view to capture. Use your device\'s screenshot instead.', 'warning');
      return;
    }
    const filename = `yodc-screenshot-${Date.now()}.png`;
    downloadDataUrl(filename, this.screenshot);
    this.notify(`Saved ${filename}. Attach it to the issue.`, 'success');
  }

  private setSubmitLabel(label: string, disabled: boolean): void {
    const btn = this.modalEl?.querySelector<HTMLButtonElement>('#btn-feedback-submit');
    if (!btn) return;
    btn.textContent = label;
    btn.disabled = disabled;
  }

  private issueTitleAndLabels(pkg: DiagnosticPackage): { title: string; labels: string[]; category: string; isBug: boolean } {
    const isBug = this.currentType === 'bug';
    const category = this.categorySelect?.value || 'General';
    const subject = pkg.metadata.subject ?? (isBug ? 'Bug Report' : 'Feature Request');
    const labels = [isBug ? 'bug' : 'enhancement', ...(CATEGORY_LABELS[category] ?? ['triage'])];
    return { title: `[${isBug ? 'Bug' : 'Feature'}]: ${subject}`.slice(0, 100), labels, category, isBug };
  }

  /** Submit: through the relay when one is configured and reachable, else via GitHub's page. */
  public submitToGitHub(): void {
    if (this.options.relayUrl && !this.relayFailed) {
      void this.submitViaRelay(this.options.relayUrl);
      return;
    }
    this.openGitHubIssue();
  }

  private async submitViaRelay(relayUrl: string): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    const pkg = this.buildPackage();
    const { title, labels, category, isBug } = this.issueTitleAndLabels(pkg);
    const description = sanitizePaths(this.descTextarea?.value.trim() || '*(No description provided)*');
    const payload = {
      type: isBug ? 'bug' : 'feature',
      title,
      labels,
      body: this.buildIssueBody(pkg, description, category, isBug, true).slice(0, 19000),
      report: isBug ? this.buildPasteText(pkg).text : undefined,
      screenshot: isBug && this.screenshot ? this.screenshot : undefined,
    };
    this.setSubmitLabel('Sending…', true);
    try {
      const res = await fetch(`${relayUrl.replace(/\/$/, '')}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(20000) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; number?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      this.notify(`Report sent. Thank you! (issue #${data.number})`, 'success');
      this.close();
    } catch (err) {
      // Nothing was filed. Opening GitHub now would be a popup outside the click, which
      // browsers block, so the next press of the same button goes there instead.
      this.relayFailed = true;
      this.setSubmitLabel('Submit on GitHub instead', false);
      this.notify(
        `Couldn't send the report (${(err as Error).message}). Press the button again to send it through GitHub instead.`,
        'warning'
      );
    } finally {
      this.sending = false;
    }
  }

  private openGitHubIssue(): void {
    const pkg = this.buildPackage();
    const { title, labels, category, isBug } = this.issueTitleAndLabels(pkg);
    const description = sanitizePaths(this.descTextarea?.value.trim() || '*(No description provided)*');

    const repo = this.options.repoUrl ?? 'https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler';
    const url = new URL(`${repo}/issues/new`);
    url.searchParams.set('title', title);
    url.searchParams.set('body', this.buildIssueBody(pkg, description, category, isBug));
    url.searchParams.set('labels', labels.join(','));

    if (isBug) {
      // Written before window.open, inside the click, so browsers that need a user
      // gesture for clipboard writes (Safari) still allow it.
      const paste = this.buildPasteText(pkg);
      void copyTextToClipboard(paste.text);
      this.notify(
        paste.trimmed
          ? 'Opening GitHub. Report copied without replay data (too large): paste it into the issue, and attach the file from Save .json.'
          : 'Opening GitHub. Report copied: paste it into the issue before submitting.',
        'success'
      );
    } else {
      this.notify('Opening GitHub…', 'success');
    }

    if (typeof window !== 'undefined') {
      window.open(url.toString(), '_blank');
    }

    this.close();
  }
}
