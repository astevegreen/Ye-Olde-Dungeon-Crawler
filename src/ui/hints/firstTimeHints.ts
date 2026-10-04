import type { FirstTimeHintId, GameEngine } from '../../engine';
import { iconElement } from '../icons';
import { hintFlag, resolveHintText, unseenHints } from './hintModel';

export interface FirstTimeHintsOptions {
  /** The label of the key bound to a command (`{key:<action>}` in hint text). */
  keyFor: (action: string) => string | undefined;
  /** The player's "First-time hints" setting. */
  enabled: () => boolean;
}

const ALL_HINTS: readonly FirstTimeHintId[] = [
  'altar', 'killRite', 'pactKeeper', 'companion', 'renown', 'runeOfReturn', 'factionStanding', 'story', 'grimoire',
];

/**
 * First-time hints: the pack's short note on a system (`manifest.firstTimeHints`) the first
 * time this hero meets it, shown as a card at the foot of the combat sidebar. Never modal:
 * play goes on around it, and it stays until dismissed. Several at once queue behind it.
 * A hint is recorded as shown (`Player.tutorialFlags`, saved with the hero) when queued.
 */
export class FirstTimeHints {
  public readonly element: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly nextBtn: HTMLButtonElement;
  private queue: Array<{ title: string; text: string }> = [];

  constructor(private readonly options: FirstTimeHintsOptions) {
    this.element = document.createElement('section');
    this.element.className = 'sb-sec sb-hint';
    this.element.setAttribute('aria-live', 'polite');
    this.element.hidden = true;

    const head = document.createElement('div');
    head.className = 'sb-title';
    this.titleEl = document.createElement('span');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'sb-hint-close';
    close.title = 'Dismiss this hint';
    close.setAttribute('aria-label', 'Dismiss this hint');
    close.textContent = '×';
    close.addEventListener('click', () => this.dismiss());
    head.append(this.titleEl, close);

    this.textEl = document.createElement('p');
    this.textEl.className = 'sb-hint-text';

    this.nextBtn = document.createElement('button');
    this.nextBtn.type = 'button';
    this.nextBtn.className = 'sb-hint-next';
    this.nextBtn.addEventListener('click', () => this.dismiss());

    this.element.append(head, this.textEl, this.nextBtn);
  }

  /** Queues the pack's hint for each of `ids` this hero hasn't been shown. */
  public offer(engine: GameEngine, ids: readonly FirstTimeHintId[]): void {
    if (ids.length === 0 || !engine?.player || !this.options.enabled()) return;
    const hints = engine.manifest.firstTimeHints ?? {};
    for (const id of unseenHints(engine, ids)) {
      const hint = hints[id];
      if (!hint) continue;
      engine.player.markTutorialSeen(hintFlag(id));
      this.queue.push(resolveHintText(hint, this.options.keyFor));
    }
    this.render();
  }

  /** Whether this hero has any hint left to see (so a caller can skip checking for them). */
  public hasUnseen(engine: GameEngine): boolean {
    return unseenHints(engine, ALL_HINTS).length > 0;
  }

  /** Closes the shown hint; the next queued one, if any, takes its place. */
  public dismiss(): void {
    this.queue.shift();
    this.render();
  }

  /** Drops every queued hint (a new run, a load). */
  public clear(): void {
    this.queue = [];
    this.render();
  }

  private render(): void {
    const hint = this.queue[0];
    this.element.hidden = !hint;
    if (!hint) return;
    this.titleEl.replaceChildren(iconElement('info'), ` ${hint.title}`);
    this.textEl.textContent = hint.text;
    const more = this.queue.length - 1;
    this.nextBtn.textContent = more > 0 ? `Next hint (${more} more)` : 'Got it';
  }
}
