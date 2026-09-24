import type { GameEngine } from '../engine';
import type { ChoiceDefinition, ChoiceOption } from '../engine';
import { evaluatePredicate } from '../engine';
import type { UIModal } from './modalStack';

export class ChoiceModal implements UIModal {
  public readonly id = 'choice';
  private overlayEl: HTMLElement | null = null;
  public isOpen: boolean = false;
  /** Whether the modal is showing. Kept apart from `isOpen`, which the modal stack clears
   *  before it calls `close()`, so a stack-driven close still hides it, and the closed
   *  callback runs once however the modal closes. */
  private shown = false;
  private onClosedCallback?: () => void;
  private choice: ChoiceDefinition | null = null;
  private onOptionSelected?: (optionId: string) => void;
  private onCancel?: () => void;
  private activeIndex: number = 0;
  private currentOptions: Array<{ option: ChoiceOption; enabled: boolean; index: number }> = [];

  constructor(onClosedCallback?: () => void) {
    this.onClosedCallback = onClosedCallback;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('choice-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'choice-modal-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 170;
        pointer-events: auto;
      `;
      document.body.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  public open(
    choice: ChoiceDefinition,
    engine: GameEngine,
    onOptionSelected: (optionId: string) => void,
    onCancel?: () => void
  ): void {
    if (!this.overlayEl) return;

    this.isOpen = true;
    this.shown = true;
    this.choice = choice;
    this.onOptionSelected = onOptionSelected;
    this.onCancel = onCancel;
    this.overlayEl.style.display = 'flex';

    // Evaluate each option's predicate against world state
    this.currentOptions = choice.options.map((option, idx) => ({
      option,
      enabled: evaluatePredicate(option.predicate, engine.worldState),
      index: idx,
    }));

    // Focus first enabled option
    const firstEnabled = this.currentOptions.findIndex((o) => o.enabled);
    this.activeIndex = firstEnabled >= 0 ? firstEnabled : 0;

    // Keys arrive only through the modal stack (handleKeyDown below): main.ts pushes this
    // modal, and InputHandler's window listener routes each key to the stack top. A choice
    // opens only in game, where InputHandler is enabled, so it adds no window listener.
    this.render();
  }

  public close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.isOpen = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
      this.overlayEl.innerHTML = '';
    }
    if (this.onClosedCallback) {
      this.onClosedCallback();
    }
  }

  /**
   * Consumes every key while open, Escape included: returning false for Escape would let
   * the stack pop the modal itself, dismissing a choice that cannot be cancelled and
   * skipping the pack's `onCancel`.
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen || !this.choice) return false;

    // Number keys 1-9
    if (/^[1-9]$/.test(e.key)) {
      const target = this.currentOptions[parseInt(e.key, 10) - 1];
      if (target && target.enabled) {
        e.preventDefault();
        this.select(target.option.id);
      }
      return true;
    }

    // Arrow navigation
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.advanceFocus(e.key === 'ArrowDown' ? 1 : -1);
      return true;
    }

    // Enter key
    if (e.key === 'Enter') {
      e.preventDefault();
      const active = this.currentOptions[this.activeIndex];
      if (active && active.enabled) {
        this.select(active.option.id);
      }
      return true;
    }

    // Escape key
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.choice.cancelable ?? true) {
        this.cancel();
      }
      return true;
    }

    return true;
  }

  private select(optionId: string): void {
    const onOptionSelected = this.onOptionSelected;
    this.close();
    onOptionSelected?.(optionId);
  }

  private cancel(): void {
    const onCancel = this.onCancel;
    this.close();
    onCancel?.();
  }

  private render(): void {
    if (!this.overlayEl || !this.choice) return;

    const choice = this.choice;
    const cancelable = choice.cancelable ?? true;
    const cancelLabel = choice.cancelLabel ?? 'Cancel / Step Away';

    this.overlayEl.innerHTML = `
      <div style="
        width: 620px;
        max-width: 95vw;
        background: var(--ui-panel, #c0c0c0);
        border: 2px solid var(--ui-border-light, #ffffff);
        border-right-color: var(--ui-border-dark, #000000);
        border-bottom-color: var(--ui-border-dark, #000000);
        box-shadow: 6px 6px 20px rgba(0,0,0,0.85);
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', Tahoma, monospace, sans-serif;
        color: var(--ui-text, #000000);
        user-select: none;
      ">
        <!-- Title Bar -->
        <div style="
          background: linear-gradient(90deg, #000080, #1084d0);
          color: #ffffff;
          padding: 6px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 14px;
        ">
          <span id="choice-modal-title">⛩ ${choice.title}</span>
          ${
            cancelable
              ? `<button id="btn-choice-x" style="
                  background: #c0c0c0; border: 1px solid #fff; border-right-color: #000; border-bottom-color: #000;
                  font-size: 12px; font-weight: bold; cursor: pointer; width: 20px; height: 20px; line-height: 14px;
                ">✕</button>`
              : ''
          }
        </div>

        <!-- Narrative Description -->
        <div style="
          padding: 14px 16px;
          background: #f8fafc;
          border-bottom: 2px solid #808080;
          font-size: 13px;
          line-height: 1.5;
          color: #1e293b;
        ">
          ${choice.description}
        </div>

        <!-- Options Container -->
        <div id="choice-options-list" style="
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: var(--ui-panel, #c0c0c0);
        ">
          ${this.currentOptions
            .map(({ option, enabled, index }) => {
              const num = index + 1;
              const isFocused = index === this.activeIndex;
              const bg = !enabled
                ? '#94a3b8'
                : isFocused
                ? '#fef08a'
                : '#ffffff';
              const border = isFocused ? '2px solid #ca8a04' : '2px solid #808080';
              const cursor = enabled ? 'pointer' : 'not-allowed';
              const opacity = enabled ? '1' : '0.6';

              return `
                <div id="choice-opt-${option.id}" class="choice-option-row" data-index="${index}" style="
                  display: flex;
                  align-items: flex-start;
                  gap: 12px;
                  background: ${bg};
                  border: ${border};
                  padding: 10px 12px;
                  cursor: ${cursor};
                  opacity: ${opacity};
                  transition: background 0.1s ease;
                ">
                  <div style="
                    background: ${enabled ? '#000080' : '#64748b'};
                    color: #ffffff;
                    font-weight: bold;
                    font-size: 12px;
                    padding: 2px 8px;
                    border: 1px solid #ffffff;
                    border-right-color: #000000;
                    border-bottom-color: #000000;
                    border-radius: 2px;
                    min-width: 24px;
                    text-align: center;
                  ">[${num}]</div>

                  <div style="flex: 1;">
                    <div style="
                      font-weight: bold;
                      font-size: 13px;
                      color: ${enabled ? '#0f172a' : '#475569'};
                      ${!enabled ? 'text-decoration: line-through;' : ''}
                    ">
                      ${option.label}
                    </div>
                    ${
                      option.description
                        ? `<div style="font-size: 12px; color: ${enabled ? '#334155' : '#64748b'}; margin-top: 3px;">
                            ${option.description}
                           </div>`
                        : ''
                    }
                    ${
                      !enabled
                        ? `<div style="font-size: 11px; color: #b91c1c; font-style: italic; margin-top: 4px;">
                            ⚠️ ${option.disabledReason ?? 'Requirements not met'}
                           </div>`
                        : ''
                    }
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>

        <!-- Footer -->
        <div style="
          padding: 10px 16px;
          background: #c0c0c0;
          border-top: 2px solid #ffffff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="font-size: 11px; color: #475569;">
            ⌨ Press [1-${this.currentOptions.length}]${cancelable ? ', [↑/↓] + Enter, or [Esc]' : ' or [↑/↓] + Enter'}
          </div>
          ${
            cancelable
              ? `<button id="btn-choice-cancel" style="
                  padding: 6px 16px;
                  background: #e2e8f0;
                  border: 2px solid #fff;
                  border-right-color: #000;
                  border-bottom-color: #000;
                  font-weight: bold;
                  font-size: 12px;
                  cursor: pointer;
                ">${cancelLabel}</button>`
              : ''
          }
        </div>
      </div>
    `;

    // Click events for rows
    for (const item of this.currentOptions) {
      if (item.enabled) {
        const rowEl = document.getElementById(`choice-opt-${item.option.id}`);
        rowEl?.addEventListener('click', () => this.select(item.option.id));
      }
    }

    if (cancelable) {
      document.getElementById('btn-choice-x')?.addEventListener('click', () => this.cancel());
      document.getElementById('btn-choice-cancel')?.addEventListener('click', () => this.cancel());
    }
  }

  private advanceFocus(direction: number): void {
    const total = this.currentOptions.length;
    if (total === 0) return;

    let next = this.activeIndex + direction;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;

    this.activeIndex = next;
    this.render();
  }
}
