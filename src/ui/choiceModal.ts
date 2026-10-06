import type { GameEngine } from '../engine';
import type { ChoiceDefinition, ChoiceOption } from '../engine';
import { evaluatePredicate, resolveManaTerms, type ManaTerms } from '../engine';
import { fillManaTerms } from './characterMenu/characterTab';
import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

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
  /** The highlighted option, or -1 before the player has picked one. Highlighting never
   *  commits: only Enter or the Confirm button does, so a stray key can't lock a choice in. */
  private activeIndex: number = -1;
  private openedAt = 0;
  private currentOptions: Array<{ option: ChoiceOption; enabled: boolean; index: number }> = [];

  constructor(onClosedCallback?: () => void) {
    this.onClosedCallback = onClosedCallback;
    this.createDom();
  }

  private createDom(): void {
    this.overlayEl = createDialogScrim('choice-modal-overlay');
  }

  /** The pack's name for the spell resource where a text says `{mana}` (a perk's), as the
   *  mastery modal and the Character tab fill it; a Saga choice printed it raw (R-cotw-5). */
  private mana?: ManaTerms;
  private fill(text: string): string {
    return this.mana ? fillManaTerms(text, this.mana) : text;
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
    this.mana = resolveManaTerms(engine.manifest);
    this.onOptionSelected = onOptionSelected;
    this.onCancel = onCancel;
    this.overlayEl.style.display = 'flex';

    // Evaluate each option's predicate against world state
    this.currentOptions = choice.options.map((option, idx) => ({
      option,
      enabled: evaluatePredicate(option.predicate, engine.worldState),
      index: idx,
    }));

    // Nothing is highlighted until the player picks, so Enter alone can't commit anything.
    this.activeIndex = -1;
    this.openedAt = Date.now();

    // Keys arrive only through the modal stack (handleKeyDown below): main.ts pushes this
    // modal, and InputHandler's window listener routes each key to the stack top. A choice
    // opens only in game, where InputHandler is enabled, so it adds no window listener.
    this.render();
  }

  public focusRoot(): HTMLElement | null {
    return this.overlayEl;
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
   *
   * Number keys deliberately do nothing: a player moving on the number pad when the choice
   * pops up must not pick an option by accident. Arrows only highlight; Enter confirms.
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen || !this.choice) return false;

    // Safety debounce: swallow keys already in flight when the choice opened.
    if (Date.now() - this.openedAt < 200) {
      e.preventDefault();
      return true;
    }

    // Arrow navigation (highlight only)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.advanceFocus(e.key === 'ArrowDown' ? 1 : -1);
      return true;
    }

    // Enter confirms the highlighted option
    if (e.key === 'Enter') {
      e.preventDefault();
      this.confirm();
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

  /** Commits the highlighted option, if any. */
  public confirm(): boolean {
    if (!this.shown) return false;
    const active = this.currentOptions[this.activeIndex];
    if (!active || !active.enabled) return false;
    this.select(active.option.id);
    return true;
  }

  /** Highlights an option without committing it. */
  public highlight(index: number): void {
    const target = this.currentOptions[index];
    if (!target || !target.enabled) return;
    this.activeIndex = index;
    this.render();
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
    const cancelLabel = choice.cancelLabel ?? 'Step away';
    const hasSelection = Boolean(this.currentOptions[this.activeIndex]?.enabled);

    const options = this.currentOptions
      .map(({ option, enabled, index }) => {
        const focused = index === this.activeIndex;
        const state = !enabled ? ' is-disabled choice-option-disabled' : focused ? ' is-focused' : '';
        return `
          <div id="choice-opt-${option.id}" class="ui-option${state}" data-index="${index}">
            <div class="ui-option-mark">${focused ? '▶' : '◇'}</div>
            <div class="ui-option-body">
              <div class="ui-option-label">${option.label}</div>
              ${option.description ? `<div class="ui-option-desc">${this.fill(option.description)}</div>` : ''}
              ${!enabled ? `<div class="ui-option-reason">${escapeHtml(option.disabledReason ?? 'Requirements not met')}</div>` : ''}
            </div>
          </div>`;
      })
      .join('');

    this.overlayEl.innerHTML = dialogHtml({
      title: choice.title,
      titleId: 'choice-modal-title',
      closeId: cancelable ? 'btn-choice-x' : undefined,
      closeTitle: 'Step away (Esc)',
      body: `<div class="ui-dialog-lede">${this.fill(choice.description)}</div><div id="choice-options-list" class="ui-options">${options}</div>`,
      hints: [
        { keys: ['↑', '↓'], label: 'choose' },
        { keys: ['Enter'], label: 'confirm' },
        ...(cancelable ? [{ keys: ['Esc'], label: 'step away' }] : []),
      ],
      actions:
        (cancelable ? dialogButton('btn-choice-cancel', cancelLabel) : '') +
        dialogButton('btn-choice-confirm', 'Confirm', { primary: true, disabled: !hasSelection, key: 'Enter' }),
    });

    // Clicking a row only highlights it; Confirm commits.
    for (const item of this.currentOptions) {
      if (item.enabled) {
        const rowEl = document.getElementById(`choice-opt-${item.option.id}`);
        rowEl?.addEventListener('click', () => this.highlight(item.index));
      }
    }
    document.getElementById('btn-choice-confirm')?.addEventListener('click', () => this.confirm());

    if (cancelable) {
      document.getElementById('btn-choice-x')?.addEventListener('click', () => this.cancel());
      document.getElementById('btn-choice-cancel')?.addEventListener('click', () => this.cancel());
    }
  }

  private advanceFocus(direction: number): void {
    const total = this.currentOptions.length;
    if (total === 0) return;

    // Step past disabled options; from "nothing highlighted", Down lands on the first.
    let next = this.activeIndex < 0 && direction > 0 ? -1 : this.activeIndex;
    for (let i = 0; i < total; i++) {
      next += direction;
      if (next < 0) next = total - 1;
      if (next >= total) next = 0;
      if (this.currentOptions[next].enabled) {
        this.activeIndex = next;
        this.render();
        return;
      }
    }
  }
}
