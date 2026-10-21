import { escapeHtml } from './html';
import { messageLogRows } from './messageLogModal';

/** How many of the newest log rows the strip shows; a run of repeated lines is one row. */
export const RECENT_MESSAGE_COUNT = 5;

export interface RecentMessagesView {
  /** The engine's whole log, oldest first; the strip collapses repeats, then takes the tail. */
  messages: readonly string[];
  playerName: string;
  /** Lines toned as critical blows, as the log strip tones them. */
  critical?: ReadonlySet<string>;
  count?: number;
  /** One line beside the heading, e.g. "HP 12/40 · Seiðr 8/35". Plain text; escaped here. */
  vitals?: string;
  heading?: string;
  /** A warning kept above the lines, e.g. "A kobold comes into view!". Plain text. */
  alert?: string;
  /** Plays the strip's flash once: set only on the draw that carries something new. */
  flash?: boolean;
}

/**
 * The last few log lines, drawn the way the log under the map draws them. One strip serves
 * every screen that covers the log (the character menu, the death screen), so what just
 * happened stays readable while they are open.
 */
export function recentMessagesHtml(view: RecentMessagesView): string {
  const count = view.count ?? RECENT_MESSAGE_COUNT;
  const vitals = view.vitals ? `<span class="recent-messages-vitals">${escapeHtml(view.vitals)}</span>` : '';
  const heading = escapeHtml(view.heading ?? 'Recent messages');
  // A warning takes the heading's place, so it never adds a line and the tab above it keeps its height.
  const title = view.alert ? `<span class="recent-messages-alert" role="alert">${escapeHtml(view.alert)}</span>` : `<span>${heading}</span>`;
  return `<section class="recent-messages${view.flash ? ' is-flashing' : ''}" aria-label="${heading}">
    <div class="recent-messages-head">${title}${vitals}</div>
    <div class="recent-messages-lines" aria-live="polite">${messageLogRows(view.messages, view.playerName, view.critical, count)}</div>
  </section>`;
}
