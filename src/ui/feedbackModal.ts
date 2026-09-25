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
import { copyTextToClipboard, defaultPlatformAdapter, browserReportContext } from './platform';
import { showToast as showGlobalToast } from './toast';
import { encodeReplayBlock } from './replayCodec';

export type FeedbackType = 'bug' | 'feature';

export interface FeedbackModalOptions {
  getEngine: () => GameEngine | null;
  getProfile?: () => CharacterProfile | null;
  bulkArchive?: BulkArchive | null;
  modalStack?: ModalStackManager;
  onClosed?: () => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  repoUrl?: string;
}

export interface FeedbackOpenOptions {
  type?: FeedbackType;
  error?: Error | string;
  subject?: string;
  description?: string;
  category?: string;
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
    contents: 'Screen size, pixel ratio and device. No log, map or replay data unless ticked.',
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

    let existing = document.getElementById('feedback-modal');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'feedback-modal';
      existing.className = 'retro-window-overlay';
      existing.style.display = 'none';
      existing.style.zIndex = '220';
      document.body.appendChild(existing);
    }
    this.modalEl = existing;
    // Focusable, so a click anywhere in the overlay (or on a button, which WebKit does not
    // focus) keeps keyboard focus — and keydown — inside the modal.
    this.modalEl.tabIndex = -1;
    this.modalEl.style.outline = 'none';

    this.modalEl.innerHTML = `
      <div class="retro-window" style="width: 620px; max-width: 95vw; box-shadow: 0 0 32px rgba(0, 0, 0, 0.9);">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>💬</span>
            <span id="feedback-modal-title">Send Feedback &amp; Bug Report</span>
          </div>
          <button id="btn-feedback-close-x" class="win-btn win-btn-sm" style="padding: 0 5px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="padding: 12px; gap: 10px; display: flex; flex-direction: column;">
          <!-- Mode Switcher Tabs -->
          <div style="display: flex; gap: 6px; border-bottom: 2px solid #94a3b8; padding-bottom: 6px;">
            <button id="btn-feedback-tab-bug" class="win-btn active-tab primary-btn" style="flex: 1; padding: 6px; font-weight: bold;">
              🐞 Report a Bug
            </button>
            <button id="btn-feedback-tab-feature" class="win-btn" style="flex: 1; padding: 6px; font-weight: bold;">
              💡 Suggest a Feature
            </button>
          </div>

          <!-- Form Fields -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <div style="flex: 2; min-width: 200px;">
                <label class="retro-label" for="feedback-input-title" style="display: block; margin-bottom: 2px;">Subject / Title:</label>
                <input id="feedback-input-title" type="text" class="retro-input" style="width: 100%; box-sizing: border-box;" placeholder="Brief summary of the issue or idea..." />
              </div>
              <div style="flex: 1; min-width: 140px;">
                <label class="retro-label" for="feedback-select-category" style="display: block; margin-bottom: 2px;">Category:</label>
                <select id="feedback-select-category" class="retro-input" style="width: 100%; height: 26px; box-sizing: border-box; background: white; color: black;"></select>
              </div>
            </div>

            <div>
              <label class="retro-label" for="feedback-textarea-desc" id="feedback-desc-label" style="display: block; margin-bottom: 2px;">Details &amp; Observations:</label>
              <textarea id="feedback-textarea-desc" class="retro-input" rows="5" style="width: 100%; height: 110px; resize: vertical; box-sizing: border-box; font-family: monospace; font-size: 12px;" placeholder="What happened? What were you doing when it occurred?"></textarea>
            </div>
          </div>

          <!-- Diagnostic Telemetry Options Panel -->
          <div id="feedback-telemetry-panel" style="background: #1e293b; color: #e2e8f0; padding: 8px 10px; border-radius: 4px; border: 1px solid #334155; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #38bdf8;">📊 Diagnostic Package</span>
              <span id="feedback-telemetry-preview" style="color: #94a3b8; font-family: monospace;">Floor 1 | Turn 0</span>
            </div>
            <div id="feedback-scope-desc" style="color: #38bdf8; font-size: 11px; margin-bottom: 6px;">
              🎯 Includes: full action log, map around the hero, and replay data.
            </div>
            <div style="display: flex; gap: 14px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" id="feedback-check-log" checked />
                <span>Include action log</span>
              </label>
              <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" id="feedback-check-snapshot" checked />
                <span>Include replay data (save + actions since)</span>
              </label>
            </div>
          </div>

          <!-- Action Buttons Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 4px;">
            <div style="display: flex; gap: 6px;">
              <button id="btn-feedback-copy" class="win-btn primary-btn" style="background: #0284c7; color: white;" title="Copy formatted AI-ready markdown report to clipboard">📋 Copy Report for AI</button>
              <button id="btn-feedback-download" class="win-btn" title="Download diagnostic package JSON">💾 Save .json</button>
            </div>
            <div style="display: flex; gap: 6px;">
              <button id="btn-feedback-cancel" class="win-btn" style="min-width: 70px;">Cancel</button>
              <button id="btn-feedback-submit" class="win-btn" style="min-width: 140px; font-weight: bold;">
                🚀 Submit to GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

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
        this.btnBugTab.classList.add('active-tab', 'primary-btn');
        this.btnFeatureTab.classList.remove('active-tab', 'primary-btn');
      } else {
        this.btnFeatureTab.classList.add('active-tab', 'primary-btn');
        this.btnBugTab.classList.remove('active-tab', 'primary-btn');
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
    if (this.currentType !== 'bug') {
      this.scopeDescEl.textContent = '💡 Suggestion: Help us expand and balance the realm!';
      return;
    }
    const cat = this.currentBugCategory();
    this.scopeDescEl.textContent = `🎯 Includes: ${cat.contents}`;
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
    const replay = flightRecorder.getReplayData();
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
  private buildIssueBody(pkg: DiagnosticPackage, description: string, category: string, isBug: boolean): string {
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
    body.push('');
    body.push('> 📋 **Tester: paste the copied report below this line** (Ctrl+V, or long-press → Paste on a phone), then press Submit.');

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
          ? 'Copied full diagnostic JSON to clipboard! 📋'
          : 'Copied AI-Ready bug report to clipboard! 📋',
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

  public submitToGitHub(): void {
    const pkg = this.buildPackage();
    const isBug = this.currentType === 'bug';
    const category = this.categorySelect?.value || 'General';
    const subject = pkg.metadata.subject ?? (isBug ? 'Bug Report' : 'Feature Request');
    const description = sanitizePaths(this.descTextarea?.value.trim() || '*(No description provided)*');

    const repo = this.options.repoUrl ?? 'https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler';
    const baseLabel = isBug ? 'bug' : 'enhancement';
    const categoryLabels = CATEGORY_LABELS[category] ?? ['triage'];
    const labels = [baseLabel, ...categoryLabels];

    const titleText = `[${isBug ? 'Bug' : 'Feature'}]: ${subject}`;
    const url = new URL(`${repo}/issues/new`);
    url.searchParams.set('title', titleText.slice(0, 100));
    url.searchParams.set('body', this.buildIssueBody(pkg, description, category, isBug));
    url.searchParams.set('labels', labels.join(','));

    if (isBug) {
      // Written before window.open, inside the click, so browsers that need a user
      // gesture for clipboard writes (Safari) still allow it.
      const paste = this.buildPasteText(pkg);
      void copyTextToClipboard(paste.text);
      this.notify(
        paste.trimmed
          ? 'Opening GitHub. Report copied without replay data (too large): paste it into the issue, and attach the file from Save .json. 📋'
          : 'Opening GitHub. Report copied: paste it into the issue before submitting. 📋',
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
