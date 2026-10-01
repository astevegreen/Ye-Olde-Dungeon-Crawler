import type { UIModal, ModalStackManager } from '../modalStack';
import type { GameState } from './gameState';
import type { MenuFooter, MenuHost, MenuTab } from './menuTab';
import { keyLabel } from '../keyLabel';
import { resolveBranding } from '../branding';
import { escapeHtml, keyChip as chip } from '../html';

/** Default keys per ACTION_METADATA id, for shells built without a key resolver (tests). */
const DEFAULT_TAB_CODES: Record<string, string[]> = {
  inventory: ['KeyI'],
  character_menu: ['KeyE'],
  cast_spell: ['KeyZ'],
  compendium: ['KeyB'],
  pact: ['KeyP'],
  story: ['KeyO'],
};

/**
 * The character menu (ARCHITECTURE.md §3, §6; ADR-0011): one shell for Inventory,
 * Character, Spellbook, Bestiary, Pacts and Story. It owns every piece of chrome — the
 * tab strip with key chips and badges, the one close button, and the footer of keys and
 * actions — so its tabs draw only their content. Every tab fills the window less a 20px
 * margin (menu.css).
 */
export class CharacterMenuModal implements UIModal {
  public readonly id = 'character-menu';
  public isOpen = false;

  private tabs: MenuTab[] = [];
  public activeTabId: string | null = null;
  private stateSupplier?: () => GameState;
  private modalStack?: ModalStackManager;
  private onCloseCallback?: () => void;
  private resolveCodes?: (actionId: string) => string[];

  private overlayEl: HTMLElement | null = null;
  private windowEl: HTMLElement | null = null;
  private navEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private footerEl: HTMLElement | null = null;

  private readonly host: MenuHost = {
    refreshChrome: () => this.refreshChrome(),
    close: () => this.close(),
  };

  constructor(
    tabs: MenuTab[] = [],
    stateSupplier?: () => GameState,
    onClose?: () => void
  ) {
    this.tabs = tabs;
    this.stateSupplier = stateSupplier;
    this.onCloseCallback = onClose;
    if (tabs.length > 0) {
      this.activeTabId = tabs[0].id;
    }
    for (const tab of tabs) tab.bindHost?.(this.host);
    this.createDom();
  }

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  public setStateSupplier(supplier: () => GameState): void {
    this.stateSupplier = supplier;
  }

  public setOnClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  /** Where the shell reads each tab's keys (the player's keybindings), so chips and
   *  in-menu hotkeys follow rebinding. */
  public setKeyResolver(resolve: (actionId: string) => string[]): void {
    this.resolveCodes = resolve;
    this.renderTabsNav();
  }

  public destroy(): void {
    if (typeof document !== 'undefined') {
      document.getElementById('widescreen-layout')?.classList.remove('character-menu-active');
    }
  }

  public registerTab(tab: MenuTab): void {
    const existingIdx = this.tabs.findIndex((t) => t.id === tab.id);
    if (existingIdx >= 0) {
      this.tabs[existingIdx] = tab;
    } else {
      this.tabs.push(tab);
    }
    tab.bindHost?.(this.host);
    if (!this.activeTabId && this.tabs.length > 0) {
      this.activeTabId = this.tabs[0].id;
    }
    this.renderTabsNav();
  }

  public getTabs(): MenuTab[] {
    return [...this.tabs];
  }

  public getActiveTab(): MenuTab | undefined {
    return this.tabs.find((t) => t.id === this.activeTabId);
  }

  /** The keys that open a tab: the player's bindings for its action, else the defaults. */
  private codesFor(tab: MenuTab): string[] {
    if (!tab.hotkeyActionId) return [];
    const bound = this.resolveCodes?.(tab.hotkeyActionId) ?? [];
    return bound.length > 0 ? bound : (DEFAULT_TAB_CODES[tab.hotkeyActionId] ?? []);
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('character-menu-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'character-menu-modal';
      document.getElementById('app')?.appendChild(overlay);
    }
    overlay.className = 'cm-overlay';
    this.overlayEl = overlay;

    let win = overlay.querySelector<HTMLElement>('.character-menu-window');
    if (!win) {
      win = document.createElement('div');
      win.className = 'cm-window character-menu-window';
      win.setAttribute('role', 'dialog');
      win.setAttribute('aria-modal', 'true');
      overlay.appendChild(win);

      const header = document.createElement('div');
      header.className = 'cm-tabs character-menu-header';
      const nav = document.createElement('nav');
      nav.className = 'cm-tablist character-menu-tabs';
      nav.setAttribute('role', 'tablist');
      header.appendChild(nav);
      const closeBtn = document.createElement('button');
      closeBtn.className = 'cm-close character-menu-close-btn';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.setAttribute('title', 'Close (Esc)');
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
      header.appendChild(closeBtn);
      win.appendChild(header);

      const content = document.createElement('div');
      content.className = 'cm-body character-menu-tab-content';
      content.id = 'character-menu-tab-content';
      content.setAttribute('role', 'tabpanel');
      win.appendChild(content);

      const footer = document.createElement('div');
      footer.className = 'cm-foot';
      win.appendChild(footer);
    }
    this.windowEl = win;
    this.navEl = win.querySelector<HTMLElement>('.character-menu-tabs');
    this.contentEl = win.querySelector<HTMLElement>('.character-menu-tab-content');
    this.footerEl = win.querySelector<HTMLElement>('.cm-foot');

    this.renderTabsNav();
  }

  private renderTabsNav(): void {
    if (!this.navEl) return;
    this.navEl.innerHTML = '';
    const state = this.isOpen && this.stateSupplier ? this.stateSupplier() : undefined;

    for (const tab of this.tabs) {
      const btn = document.createElement('button');
      const isActive = tab.id === this.activeTabId;
      btn.className = 'cm-tab character-menu-tab-btn';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-tab-id', tab.id);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      const code = this.codesFor(tab)[0];
      const badge = state ? tab.badge?.(state) : null;
      btn.innerHTML =
        (code ? chip(keyLabel(code)) : '') +
        `<span>${escapeHtml(tab.label)}</span>` +
        (badge ? `<span class="cm-badge">${escapeHtml(badge)}</span>` : '');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.activateTab(tab.id);
      });
      this.navEl.appendChild(btn);
    }
  }

  private renderFooter(): void {
    if (!this.footerEl) return;
    const tab = this.getActiveTab();
    const footer: MenuFooter = tab?.footer?.() ?? {};
    const hints = [
      ...(footer.keys ?? []),
      { keys: ['Tab'], label: tab?.claimsTabKey ? 'next panel' : 'next tab' },
      { keys: ['Esc'], label: footer.escLabel ?? 'close' },
    ];
    const keysHtml = hints
      .map((h) => `<span class="cm-hint">${h.keys.map(chip).join('')} ${escapeHtml(h.label)}</span>`)
      .join('');
    const actions = footer.actions ?? [];
    const actionsHtml = actions
      .map(
        (a, i) =>
          `<button type="button" class="ui-btn ${a.primary ? 'ui-btn--primary' : 'ui-btn--ghost'}" data-action-index="${i}"${a.disabled ? ' disabled' : ''}>` +
          `${escapeHtml(a.label)}${a.key ? ` ${chip(a.key)}` : ''}</button>`
      )
      .join('');
    this.footerEl.innerHTML =
      `<div class="cm-foot-keys">${keysHtml}</div>` +
      (footer.note ? `<div class="cm-foot-note">${escapeHtml(footer.note)}</div>` : '') +
      (actionsHtml ? `<div class="cm-foot-actions">${actionsHtml}</div>` : '');
    if (typeof this.footerEl.querySelectorAll !== 'function') return;
    this.footerEl.querySelectorAll<HTMLButtonElement>('button[data-action-index]').forEach((btn) => {
      const action = actions[Number(btn.getAttribute('data-action-index'))];
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (action && !action.disabled) action.run();
      });
    });
  }

  /** Redraws the badges and the footer; tabs call it (through MenuHost) when their state changes. */
  public refreshChrome(): void {
    this.renderTabsNav();
    this.renderFooter();
  }

  /** The pack's ornament rule for section headings (branding), as a CSS string. */
  private applyOrnament(): void {
    const style = this.windowEl?.style;
    if (!style || typeof style.setProperty !== 'function' || !this.stateSupplier) return;
    const ornament = resolveBranding(this.stateSupplier().manifest).ornament;
    style.setProperty('--ui-ornament', JSON.stringify(ornament));
  }

  public activateTab(tabId: string, entry: 'forward' | 'backward' = 'forward'): boolean {
    const targetTab = this.tabs.find((t) => t.id === tabId);
    if (!targetTab) return false;

    const previousTab = this.getActiveTab();
    if (previousTab && previousTab.id !== targetTab.id) {
      previousTab.unmount();
    }

    this.activeTabId = targetTab.id;
    if (this.overlayEl) {
      this.overlayEl.className = `cm-overlay${this.isOpen ? ' is-open' : ''}`;
    }

    if (this.contentEl) {
      this.contentEl.innerHTML = '';
      targetTab.mount(this.contentEl);
      if (this.stateSupplier) {
        targetTab.onActivate(this.stateSupplier(), entry);
      }
    }
    this.refreshChrome();
    return true;
  }

  public open(tabId?: string): void {
    this.isOpen = true;
    if (typeof document !== 'undefined') {
      document.getElementById('widescreen-layout')?.classList.add('character-menu-active');
    }
    if (!this.overlayEl) {
      this.createDom();
    }
    this.applyOrnament();

    const targetTabId =
      tabId && this.tabs.some((t) => t.id === tabId)
        ? tabId
        : this.activeTabId && this.tabs.some((t) => t.id === this.activeTabId)
        ? this.activeTabId
        : this.tabs[0]?.id;

    if (targetTabId) {
      this.activateTab(targetTabId);
    }
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (typeof document !== 'undefined') {
      document.getElementById('widescreen-layout')?.classList.remove('character-menu-active');
    }

    const currentTab = this.getActiveTab();
    if (currentTab) {
      currentTab.unmount();
    }

    if (this.overlayEl) {
      this.overlayEl.className = 'cm-overlay';
    }
    if (this.modalStack) {
      this.modalStack.remove(this.id);
    }
    this.onCloseCallback?.();
  }

  public onPop(): void {
    this.close();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    const key = e.key;
    const code = e.code;

    // 1. Tab / Shift+Tab cycle tabs with wrap-around, unless the active tab uses Tab itself.
    if (key === 'Tab' && this.getActiveTab()?.claimsTabKey && this.getActiveTab()?.handleKeyDown(e)) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    if (key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (this.tabs.length > 1) {
        const curIdx = this.tabs.findIndex((t) => t.id === this.activeTabId);
        const nextIdx = e.shiftKey
          ? (curIdx - 1 + this.tabs.length) % this.tabs.length
          : (curIdx + 1) % this.tabs.length;
        this.activateTab(this.tabs[nextIdx].id, e.shiftKey ? 'backward' : 'forward');
      }
      return true;
    }

    // 2. Escape closes the whole shell — unless the active tab uses it to back out of
    //    something first (the inventory clears a selection before closing).
    if (key === 'Escape' && this.getActiveTab()?.handleKeyDown(e)) {
      return true;
    }
    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return true;
    }

    // 3. Active tab gets first refusal on every other key
    const activeTab = this.getActiveTab();
    if (activeTab?.handleKeyDown(e)) {
      return true;
    }

    // 4. A tab's key switches to it; the active tab's own key closes the menu.
    const pressed = e.shiftKey ? `Shift+${code}` : code;
    const target = this.tabs.find((t) => this.codesFor(t).includes(pressed));
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      if (this.activeTabId === target.id) {
        this.close();
      } else {
        this.activateTab(target.id);
      }
      return true;
    }

    // 5. Unhandled keys are trapped to prevent leaking into game simulation
    e.preventDefault();
    e.stopPropagation();
    return true;
  }
}
