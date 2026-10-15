import { grimoireAxes, restatRefusal, statPickFor, type GrimoireAxis, type Player } from '../engine';
import { escapeHtml } from './html';
import { AXIS_WORD } from './characterMenu/spellbookGrimoires';

/**
 * Choosing afresh the stats of one grimoire, as an altar or a sage offers it: the grimoire,
 * then a stat for each axis it reaches along. Stats on another grimoire can't be taken;
 * a stat moved to one axis leaves the other. Pure markup plus a binder that reports changes.
 */

export interface RestatChoice {
  grimoireId?: string;
  stats: Partial<Record<GrimoireAxis, string>>;
}

/** The choice for a grimoire, starting from the stats it has now. */
export function restatChoiceFor(player: Player, grimoireId: string): RestatChoice {
  const system = player.grimoireSystem;
  const state = player.grimoireState;
  const stats: Partial<Record<GrimoireAxis, string>> = {};
  if (system && state) {
    for (const axis of grimoireAxes(system, state, grimoireId)) {
      const statId = statPickFor(state, grimoireId, axis);
      if (statId) stats[axis] = statId;
    }
  }
  return { grimoireId, stats };
}

/** Whether the choice changes anything, and the refusal when it can't be made. */
export function restatVerdict(player: Player, choice: RestatChoice): { ok: boolean; text: string } {
  if (!choice.grimoireId) return { ok: false, text: 'Choose a grimoire.' };
  const refusal = restatRefusal(player, { grimoireId: choice.grimoireId, stats: choice.stats });
  if (refusal) return { ok: false, text: refusal };
  const now = restatChoiceFor(player, choice.grimoireId).stats;
  const system = player.grimoireSystem!;
  const book = system.layouts.find((l) => l.id === choice.grimoireId)?.name ?? choice.grimoireId;
  const axes = grimoireAxes(system, player.grimoireState!, choice.grimoireId);
  if (axes.every((axis) => now[axis] === choice.stats[axis])) return { ok: false, text: `${book} keeps the stats it has. Choose another.` };
  const statName = (id: string | undefined): string => system.stats.find((s) => s.id === id)?.name ?? '';
  return {
    ok: true,
    text: `${escapeHtml(book)}: ${axes.map((axis) => `${AXIS_WORD[axis]} <b>${escapeHtml(statName(choice.stats[axis]))}</b>`).join(', ')}.`,
  };
}

export function restatPickerHtml(player: Player, choice: RestatChoice): string {
  const system = player.grimoireSystem;
  const state = player.grimoireState;
  if (!system || !state) return '';
  const books = state.opened
    .map((gid) => {
      const name = system.layouts.find((l) => l.id === gid)?.name ?? gid;
      return `<button type="button" class="bs-row${gid === choice.grimoireId ? ' is-selected' : ''}" data-restat-grimoire="${escapeHtml(gid)}"><span class="bs-name">${escapeHtml(name)}</span></button>`;
    })
    .join('');
  let axes = '';
  if (choice.grimoireId) {
    const gid = choice.grimoireId;
    const elsewhere = new Set(state.statPicks.filter((p) => p.grimoireId !== gid).map((p) => p.statId));
    axes = grimoireAxes(system, state, gid)
      .map((axis) => {
        const buttons = system.stats
          .map((s) => {
            const taken = elsewhere.has(s.id);
            const on = choice.stats[axis] === s.id;
            return `<button type="button" class="sb-pick-btn${on ? ' is-selected' : ''}" data-restat-axis="${axis}" data-restat-stat="${escapeHtml(s.id)}" aria-pressed="${on}" title="${escapeHtml(taken ? 'On another grimoire' : s.description)}"${taken ? ' disabled' : ''}>${escapeHtml(s.name)}</button>`;
          })
          .join('');
        return `<div class="ui-note sb-pick">The stat that grows ${AXIS_WORD[axis]} the slots: ${buttons}</div>`;
      })
      .join('');
  }
  return `<div class="ui-dialog-label">Grimoire</div><div class="ui-inset bs-list altar-list">${books}</div>${axes}`;
}

/** Binds the picker's buttons under `root`; each click hands back the new choice. */
export function bindRestatPicker(root: HTMLElement, player: Player, choice: RestatChoice, onChange: (next: RestatChoice) => void): void {
  root.querySelectorAll<HTMLElement>('[data-restat-grimoire]').forEach((el) =>
    el.addEventListener('click', () => onChange(restatChoiceFor(player, el.dataset.restatGrimoire ?? '')))
  );
  root.querySelectorAll<HTMLElement>('[data-restat-stat]').forEach((el) =>
    el.addEventListener('click', () => {
      const axis = el.dataset.restatAxis as GrimoireAxis;
      const statId = el.dataset.restatStat ?? '';
      const stats = { ...choice.stats };
      // A stat sits on one axis: taking it here clears it from the other.
      for (const other of Object.keys(stats) as GrimoireAxis[]) if (stats[other] === statId) delete stats[other];
      stats[axis] = statId;
      onChange({ grimoireId: choice.grimoireId, stats });
    })
  );
}
