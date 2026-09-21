import type { UIModal, ModalStackManager } from '../modalStack';
import type { GameState } from '../flanks/types';
import type { MenuTab } from './menuTab';
import type { ViewportManager } from '../../rendering/viewport';

/**
 * Consolidated Character Menu Shell (ARCHITECTURE.md §3, §6).
 * Unifies Inventory, Character Sheet, Spellbook, Bestiary, Pacts, and Story under a single tabbed UIModal.
 */
export class CharacterMenuModal implements UIModal {
  public readonly id = 'character-menu';
  public isOpen = false;

  private tabs: MenuTab[] = [];
  public activeTabId: string | null = null;
  private stateSupplier?: () => GameState;
  private modalStack?: ModalStackManager;
  private onCloseCallback?: () => void;
  private viewport?: ViewportManager;
  private canvas?: HTMLCanvasElement;
  private detachResizeListener?: () => void;

  private overlayEl: HTMLElement | null = null;
  private windowEl: HTMLElement | null = null;
  private navEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;

  constructor(
    tabs: MenuTab[] = [],
    stateSupplier?: () => GameState,
    onClose?: () => void,
    viewport?: ViewportManager,
    canvas?: HTMLCanvasElement
  ) {
    this.tabs = tabs;
    this.stateSupplier = stateSupplier;
    this.onCloseCallback = onClose;
    this.viewport = viewport;
    this.canvas = canvas;
    if (tabs.length > 0) {
      this.activeTabId = tabs[0].id;
    }
    this.hookResize();
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

  public setViewport(viewport: ViewportManager): void {
    if (this.viewport === viewport) return;
    this.detachResizeListener?.();
    this.viewport = viewport;
    this.hookResize();
    if (this.isOpen) {
      this.updateLayout();
    }
  }

  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    if (this.isOpen) {
      this.updateLayout();
    }
  }

  private hookResize(): void {
    if (!this.viewport || typeof this.viewport.addResizeListener !== 'function') return;
    this.detachResizeListener = this.viewport.addResizeListener(() => {
      if (this.isOpen) {
        this.updateLayout();
      }
    });
  }

  public destroy(): void {
    this.detachResizeListener?.();
    this.detachResizeListener = undefined;
  }

  public registerTab(tab: MenuTab): void {
    const existingIdx = this.tabs.findIndex((t) => t.id === tab.id);
    if (existingIdx >= 0) {
      this.tabs[existingIdx] = tab;
    } else {
      this.tabs.push(tab);
    }
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

  public updateLayout(): void {
    if (!this.windowEl || typeof document === 'undefined') return;

    const virtualWidth = this.viewport?.virtualWidth ?? 960;
    const virtualHeight = this.viewport?.virtualHeight ?? 600;
    const modalVirtualW = Math.min(virtualWidth - 20, 920);
    const modalVirtualH = Math.min(virtualHeight - 24, 576);
    const modalVirtualX = Math.floor((virtualWidth - modalVirtualW) / 2);
    const modalVirtualY = Math.floor((virtualHeight - modalVirtualH) / 2);

    const canvas =
      this.canvas ??
      this.viewport?.canvasElement ??
      (typeof document.getElementById === 'function'
        ? (document.getElementById('game-canvas') as HTMLCanvasElement | null)
        : null);

    if (
      canvas &&
      typeof canvas.getBoundingClientRect === 'function' &&
      this.overlayEl &&
      typeof this.overlayEl.getBoundingClientRect === 'function'
    ) {
      const canvasRect = canvas.getBoundingClientRect();
      const overlayRect = this.overlayEl.getBoundingClientRect();

      const scale =
        this.viewport?.scale ??
        (canvasRect.width > 0 && virtualWidth > 0 ? canvasRect.width / virtualWidth : 1);

      const cssW = Math.round(modalVirtualW * scale);
      const cssH = Math.round(modalVirtualH * scale);
      const cssLeft = Math.round(canvasRect.left - overlayRect.left + modalVirtualX * scale);
      const cssTop = Math.round(canvasRect.top - overlayRect.top + modalVirtualY * scale);

      this.windowEl.style.position = 'absolute';
      this.windowEl.style.margin = '0';
      this.windowEl.style.left = `${cssLeft}px`;
      this.windowEl.style.top = `${cssTop}px`;
      this.windowEl.style.width = `${cssW}px`;
      this.windowEl.style.height = `${cssH}px`;
    } else {
      const scale = this.viewport?.scale ?? 1;
      this.windowEl.style.position = 'absolute';
      this.windowEl.style.margin = '0';
      this.windowEl.style.width = `${Math.round(modalVirtualW * scale)}px`;
      this.windowEl.style.height = `${Math.round(modalVirtualH * scale)}px`;
    }
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('character-menu-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'character-menu-modal';
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = '140';
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      document.getElementById('app')?.appendChild(overlay);
    }
    this.overlayEl = overlay;

    // Window Shell
    let win = overlay.querySelector<HTMLElement>('.character-menu-window');
    if (!win) {
      win = document.createElement('div');
      win.className = 'retro-window character-menu-window';
      win.style.position = 'absolute';
      win.style.margin = '0';
      win.style.display = 'flex';
      win.style.flexDirection = 'column';
      win.style.fontFamily = '"Courier New", Courier, monospace';
      win.style.color = '#e2e8f0';
      win.style.borderRadius = '6px';
      win.style.overflow = 'hidden';
      win.style.boxSizing = 'border-box';
      overlay.appendChild(win);
    }
    this.windowEl = win;
    this.updateLayout();

    // Header with Tabs
    let header = win.querySelector<HTMLElement>('.character-menu-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'character-menu-header';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.background = '#1e293b';
      header.style.borderBottom = '2px solid #ca8a04';
      header.style.padding = '6px 10px';
      header.style.userSelect = 'none';

      const nav = document.createElement('nav');
      nav.className = 'character-menu-tabs';
      nav.setAttribute('role', 'tablist');
      nav.style.display = 'flex';
      nav.style.gap = '4px';
      nav.style.flexWrap = 'wrap';
      header.appendChild(nav);
      this.navEl = nav;

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.alignItems = 'center';
      controls.style.gap = '8px';

      const hint = document.createElement('span');
      hint.style.fontSize = '11px';
      hint.style.color = '#94a3b8';
      hint.textContent = '[Tab] Cycle · [Esc] Close';
      controls.appendChild(hint);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'character-menu-close-btn win-btn win-btn-sm';
      closeBtn.textContent = '✕';
      closeBtn.style.padding = '0 6px';
      closeBtn.style.fontWeight = 'bold';
      closeBtn.style.cursor = 'pointer';
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
      controls.appendChild(closeBtn);

      header.appendChild(controls);
      win.appendChild(header);
    } else {
      this.navEl = header.querySelector('.character-menu-tabs');
    }

    // Tab Content Container
    let content = win.querySelector<HTMLElement>('.character-menu-tab-content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'character-menu-tab-content';
      content.id = 'character-menu-tab-content';
      content.style.flex = '1';
      content.style.minHeight = '0';
      content.style.position = 'relative';
      content.style.overflow = 'hidden';
      content.style.boxSizing = 'border-box';
      win.appendChild(content);
    }
    this.contentEl = content;

    this.renderTabsNav();
  }

  private renderTabsNav(): void {
    if (!this.navEl) return;
    this.navEl.innerHTML = '';

    const hotkeyHints: Record<string, string> = {
      inventory: '[I]',
      character: '[E]',
      spellbook: '[Z]',
      bestiary: '[B]',
      pacts: '[P]',
    };

    for (const tab of this.tabs) {
      const btn = document.createElement('button');
      const isActive = tab.id === this.activeTabId;
      btn.className = `character-menu-tab-btn win-btn win-btn-sm ${isActive ? 'active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-tab-id', tab.id);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

      const hint = hotkeyHints[tab.id] ? ` ${hotkeyHints[tab.id]}` : '';
      btn.textContent = `${tab.label}${hint}`;

      btn.style.padding = '5px 10px';
      btn.style.fontSize = '12px';
      btn.style.fontWeight = 'bold';
      btn.style.cursor = 'pointer';
      btn.style.fontFamily = 'inherit';
      btn.style.background = isActive ? '#ca8a04' : '#334155';
      btn.style.color = isActive ? '#000000' : '#e2e8f0';
      btn.style.border = isActive ? '1px solid #facc15' : '1px solid #475569';
      btn.style.borderRadius = '3px';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.activateTab(tab.id);
      });

      this.navEl.appendChild(btn);
    }
  }

  public activateTab(tabId: string): boolean {
    const targetTab = this.tabs.find((t) => t.id === tabId);
    if (!targetTab) return false;

    // Unmount current active tab
    const previousTab = this.getActiveTab();
    if (previousTab && previousTab.id !== targetTab.id) {
      previousTab.unmount();
    }

    this.activeTabId = targetTab.id;
    this.renderTabsNav();

    if (this.overlayEl && this.windowEl && this.contentEl) {
      if (targetTab.id === 'inventory') {
        // Inventory overlay renders onto the HTML5 Canvas underneath
        this.overlayEl.style.backgroundColor = 'transparent';
        this.overlayEl.style.pointerEvents = 'none';
        this.windowEl.style.backgroundColor = 'transparent';
        this.windowEl.style.border = '2px solid transparent';
        this.windowEl.style.boxShadow = 'none';
        if (this.navEl?.parentElement) {
          this.navEl.parentElement.style.pointerEvents = 'auto';
        }
        this.contentEl.style.display = 'none';
      } else {
        this.overlayEl.style.backgroundColor = 'rgba(10, 11, 16, 0.82)';
        this.overlayEl.style.pointerEvents = 'auto';
        this.windowEl.style.backgroundColor = '#0f172a';
        this.windowEl.style.border = '2px solid #ca8a04';
        this.windowEl.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.9), 0 0 15px rgba(202, 138, 4, 0.3)';
        this.contentEl.style.display = 'block';
      }

      this.contentEl.innerHTML = '';
      targetTab.mount(this.contentEl);
      if (this.stateSupplier) {
        targetTab.onActivate(this.stateSupplier());
      }
      this.updateLayout();
    }

    return true;
  }

  public open(tabId?: string): void {
    this.isOpen = true;
    if (!this.overlayEl) {
      this.createDom();
    }
    if (this.overlayEl) {
      this.overlayEl.style.display = 'block';
    }
    this.updateLayout();

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

    const currentTab = this.getActiveTab();
    if (currentTab) {
      currentTab.unmount();
    }

    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
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

    // 1. Tab / Shift+Tab cycle tabs with wrap-around
    if (key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (this.tabs.length > 1) {
        const curIdx = this.tabs.findIndex((t) => t.id === this.activeTabId);
        const nextIdx = e.shiftKey
          ? (curIdx - 1 + this.tabs.length) % this.tabs.length
          : (curIdx + 1) % this.tabs.length;
        this.activateTab(this.tabs[nextIdx].id);
      }
      return true;
    }

    // 2. Escape closes the whole shell
    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return true;
    }

    // 3. Active tab gets first refusal on every other key
    const activeTab = this.getActiveTab();
    if (activeTab) {
      const handled = activeTab.handleKeyDown(e);
      if (handled) {
        return true;
      }
    }

    // 4. Hotkeys to switch to or toggle specific tabs
    const hotkeyMap: Record<string, string> = {
      KeyI: 'inventory',
      KeyE: 'character',
      KeyZ: 'spellbook',
      KeyB: 'bestiary',
      KeyP: 'pacts',
    };

    const targetTabId = hotkeyMap[code];
    if (targetTabId && this.tabs.some((t) => t.id === targetTabId)) {
      e.preventDefault();
      e.stopPropagation();
      if (this.activeTabId === targetTabId) {
        // Toggle close when pressing the active tab's hotkey
        this.close();
      } else {
        this.activateTab(targetTabId);
      }
      return true;
    }

    // 5. Unhandled keys are trapped to prevent leaking into game simulation
    e.preventDefault();
    e.stopPropagation();
    return true;
  }
}
