import type { Page } from '@playwright/test';
import type { MagicTelemetry } from './types';

/**
 * Measures magic in play (P-36), for every lens. Reads, never changes, what the game does:
 * - each hero action is wrapped as it runs, so damage dealt inside it is the action's: a cast
 *   (`spell`), a step or blow (`melee`), or anything else the hero did (`other`: a wand, a
 *   thrown item, a scroll). Damage outside the hero's action is `world`: allies and summons,
 *   ground that burns, monsters hurting each other, poison ticking;
 * - a cast counts when it spends the turn, and fails when it spends nothing;
 * - learning comes from the stone events (`learning_stone_read`, shortcut or not), and any
 *   other new spell in the book (an altar, a tablet) is `other`.
 * Re-installed on each new engine, like the log tap; the tally lives on `window` for the run.
 */
export async function tapMagic(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    const e = w.__cotwEngine;
    if (!e?.player) return;
    const m = (w.__soakMagic ??= {
      floors: {},
      learned: [],
      stonesRead: 0,
      shortcuts: 0,
      runesFromStones: 0,
      rites: 0,
      altarRites: 0,
      known: [...(e.player.spellsKnown ?? [])],
    });
    // Spells that joined the book some other way since the last action.
    for (const id of e.player.spellsKnown ?? []) {
      if (m.known.includes(id)) continue;
      m.known.push(id);
      if (!m.learned.some((l: any) => l.spellId === id)) {
        m.learned.push({ spellId: id, via: 'other', floor: e.currentFloor ?? 0, turn: e.turnCount ?? 0 });
      }
    }
    if (e.__soakMagicTapped) return;
    w.__soakMagicSource = null;

    const floorOf = (): any => {
      const f = String(w.__cotwEngine?.currentFloor ?? 0);
      return (m.floors[f] ??= {
        casts: {},
        failedCasts: 0,
        damage: { spell: 0, melee: 0, other: 0, world: 0 },
        kills: { spell: 0, melee: 0, other: 0, world: 0 },
        spellDamage: {},
      });
    };
    const learn = (spellId: string, via: string): void => {
      if (m.learned.some((l: any) => l.spellId === spellId)) return;
      const eng = w.__cotwEngine;
      m.learned.push({ spellId, via, floor: eng?.currentFloor ?? 0, turn: eng?.turnCount ?? 0 });
    };

    // Damage to the hero's foes, whoever deals it: one wrap on the class every entity shares.
    let proto = Object.getPrototypeOf(e.player);
    while (proto && !Object.prototype.hasOwnProperty.call(proto, 'takeDamage')) proto = Object.getPrototypeOf(proto);
    if (proto && !proto.__soakDamageTap) {
      const original = proto.takeDamage;
      proto.takeDamage = function (this: any, ...args: unknown[]) {
        const result = original.apply(this, args);
        const eng = w.__cotwEngine;
        const dealt = result?.damageDealt ?? 0;
        if (eng?.player && this !== eng.player && eng.player.isHostileTo?.(this) && dealt > 0) {
          const source = (w.__soakMagicSource?.kind ?? 'world') as 'spell' | 'melee' | 'other' | 'world';
          const bucket = floorOf();
          bucket.damage[source] += dealt;
          if (result.killed) bucket.kills[source]++;
          const spellId = w.__soakMagicSource?.spellId;
          if (source === 'spell' && spellId) bucket.spellDamage[spellId] = (bucket.spellDamage[spellId] ?? 0) + dealt;
        }
        return result;
      };
      proto.__soakDamageTap = true;
    }

    // The hero's actions: what each one is, while it runs, and whether a cast spent the turn.
    const handle = e.handlePlayerAction.bind(e);
    e.handlePlayerAction = (action: any) => {
      const spellId: string | undefined = action?.spellId;
      const kind = spellId ? 'spell' : action && ('dx' in action || 'defender' in action) ? 'melee' : 'other';
      const perform = action?.perform;
      if (typeof perform === 'function') {
        action.perform = function (this: unknown, ...args: unknown[]) {
          const outer = w.__soakMagicSource;
          w.__soakMagicSource = { kind, spellId };
          try {
            return perform.apply(this, args);
          } finally {
            w.__soakMagicSource = outer;
          }
        };
      }
      const bucket = floorOf();
      const result = handle(action);
      if (spellId && action.caster === e.player) {
        if ((result?.cost ?? 0) > 0) bucket.casts[spellId] = (bucket.casts[spellId] ?? 0) + 1;
        else bucket.failedCasts++;
      }
      return result;
    };

    // Stones, rites and altars, from the game's own events.
    const notify = e.onGameEvent;
    e.onGameEvent = (event: any) => {
      if (event?.type === 'learning_stone_read') {
        const id = event.data?.spellId;
        if (id) {
          m.stonesRead++;
          if (event.data?.shortcut) m.shortcuts++;
          learn(id, event.data?.shortcut ? 'shortcut' : 'stone');
        } else {
          m.runesFromStones++;
        }
      } else if (event?.type === 'kill_rite_performed') {
        m.rites++;
      } else if (event?.type === 'altar_rite_performed') {
        m.altarRites++;
      }
      return notify?.(event);
    };
    e.__soakMagicTapped = true;
  });
}

/** The run's magic tally, for summary.json; null before the hero exists. */
export async function readMagic(page: Page): Promise<MagicTelemetry | null> {
  return page
    .evaluate(() => {
      const m = (window as any).__soakMagic;
      if (!m) return null;
      const { known, ...rest } = m;
      return { ...rest, spellsKnown: [...known] };
    })
    .catch(() => null);
}
