import type { Page } from '@playwright/test';
import type { MagicTelemetry } from './types';

/**
 * Measures magic in play (P-36), for every lens. Reads, never changes, what the game does:
 * - each hero action is wrapped as it runs, so damage dealt inside it is the action's: a cast
 *   (`spell`), a step or blow (`melee`), or anything else the hero did (`other`: a wand, a
 *   thrown item, a scroll). Damage outside the hero's action is `world`: allies and summons,
 *   ground that burns, monsters hurting each other, poison ticking;
 * - a cast counts when it spends the turn, and fails when it spends nothing; each cast notes
 *   the flavours its grimoire neighbours lent it, since a spell that cannot hurt on its own
 *   (Slow) still deals the damage of a borrowed Knockback;
 * - each spell that joins the book is put down to the event that came with it: a stone read
 *   (`stone`, `shortcut`), an altar rite (`altar`), a kill rite (`rite`); anything else (a
 *   tablet, a spell offer) is `other`;
 * - each learning stone and spell altar on a floor the hero entered is marked by how far the
 *   hero got with it, so one never reached stands out;
 * - a cast that succeeds without spending its turn, or spends the turn and no mana, and Void
 *   Debt that is not a number or below zero, are queued as anomalies for the spec's findings.
 * Re-installed on each new engine, like the log tap; the tally lives on `window` for the run.
 */
export async function tapMagic(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    const e = w.__cotwEngine;
    if (!e?.player) return;
    const stoneDefs: any = e.manifest?.magic?.learningStones;
    const altarIds = new Set<string>((e.manifest?.magic?.altars ?? []).map((a: any) => a.id));
    const m = (w.__soakMagic ??= {
      floors: {},
      learned: [],
      stonesRead: 0,
      shortcuts: 0,
      runesFromStones: 0,
      rites: 0,
      altarRites: 0,
      known: [...(e.player.spellsKnown ?? [])],
      stones: {},
      altars: {},
      // A tablet's own spell (its one effect teaches another) is the item, not a spell to cast.
      catalog: Object.fromEntries(
        (e.manifest?.spells ?? [])
          .filter((sp: any) => !(sp.effects?.length && sp.effects.every((f: any) => f.type === 'learn_spell')))
          .map((sp: any) => {
            const zones = (stoneDefs?.zones ?? []).filter((z: any) => (z.spellIds ?? []).includes(sp.id));
            const from = zones.length ? Math.min(...zones.map((z: any) => z.minFloor)) : null;
            const ownDamage = (sp.effects ?? []).some((f: any) => f.type === 'damage' || f.type === 'push');
            return [sp.id, { type: sp.spellType ?? 'none', stoneFrom: from, ownDamage }];
          })
      ),
      energy: {},
      // Events since the last time new spells were put down to a route.
      recent: [] as string[],
      anomalies: [] as string[],
    });

    // A floor entered for the first time: its stone and altars start as `missed`.
    const floorNow = e.currentFloor ?? 0;
    if (floorNow > 0 && m.lastFloor !== floorNow) {
      m.lastFloor = floorNow;
      if (stoneDefs?.stones?.some((st: any) => st.floor === floorNow) && !m.stones[floorNow]) m.stones[floorNow] = 'missed';
      for (let y = 0; y < e.map.height; y++) {
        for (let x = 0; x < e.map.width; x++) {
          const id = e.map.getTile(x, y)?.interactionHandlerId;
          if (altarIds.has(id) && !m.altars[`${floorNow}:${id}`]) m.altars[`${floorNow}:${id}`] = 'missed';
        }
      }
    }
    // An altar the hero stands on is reached, rite or not.
    const standing = e.map.getTile(e.player.x, e.player.y)?.interactionHandlerId;
    if (altarIds.has(standing) && m.altars[`${floorNow}:${standing}`] === 'missed') m.altars[`${floorNow}:${standing}`] = 'reached';

    // New spells in the book, put down to the events seen since they were last checked.
    const route = (): string => {
      if (m.recent.includes('shortcut')) return 'shortcut';
      if (m.recent.includes('stone')) return 'stone';
      if (m.recent.includes('altar')) return 'altar';
      if (m.recent.includes('rite')) return 'rite';
      return 'other';
    };
    for (const id of e.player.spellsKnown ?? []) {
      if (m.known.includes(id)) continue;
      m.known.push(id);
      if (!m.learned.some((l: any) => l.spellId === id)) m.learned.push({ spellId: id, via: route(), floor: floorNow, turn: e.turnCount ?? 0 });
    }
    m.recent = [];
    const debt = e.player.voidDebt ?? 0;
    if (typeof debt !== 'number' || Number.isNaN(debt) || debt < 0) m.anomalies.push(`Void Debt is ${debt}`);

    if (e.__soakMagicTapped) return;
    w.__soakMagicSource = null;

    const floorOf = (): any => {
      const f = String(w.__cotwEngine?.currentFloor ?? 0);
      return (m.floors[f] ??= {
        casts: {},
        failed: {},
        damage: { spell: 0, melee: 0, other: 0, world: 0 },
        kills: { spell: 0, melee: 0, other: 0, world: 0 },
        spellDamage: {},
        spellKills: {},
      });
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
          if (source === 'spell' && spellId) {
            bucket.spellDamage[spellId] = (bucket.spellDamage[spellId] ?? 0) + dealt;
            if (result.killed) bucket.spellKills[spellId] = (bucket.spellKills[spellId] ?? 0) + 1;
          }
        }
        return result;
      };
      proto.__soakDamageTap = true;
    }

    // Energy every actor spends, and the spends dearer than what it had banked: since the floor
    // at 0 went (e310fad6) those leave a debt, the energy the floor used to forgive.
    let energyProto = Object.getPrototypeOf(e.player);
    while (energyProto && !Object.prototype.hasOwnProperty.call(energyProto, 'consumeEnergy')) energyProto = Object.getPrototypeOf(energyProto);
    if (energyProto && !energyProto.__soakEnergyTap) {
      const original = energyProto.consumeEnergy;
      energyProto.consumeEnergy = function (this: any, ...args: unknown[]) {
        const before = this.energy;
        const result = original.apply(this, args);
        const amount = args[0];
        const eng = w.__cotwEngine;
        const byFloor = w.__soakMagic?.energy;
        if (byFloor && typeof amount === 'number' && typeof before === 'number') {
          const blank = () => ({ actions: 0, debt: 0, debtEnergy: 0 });
          const row = (byFloor[String(eng?.currentFloor ?? 0)] ??= { hero: blank(), foes: blank() })[this === eng?.player ? 'hero' : 'foes'];
          row.actions++;
          if (amount > before) {
            row.debt++;
            row.debtEnergy += amount - Math.max(0, before);
          }
        }
        return result;
      };
      energyProto.__soakEnergyTap = true;
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
      const manaBefore = e.player.mana;
      const result = handle(action);
      if (spellId && action.caster === e.player) {
        const cost = result?.cost ?? 0;
        if (cost > 0) {
          bucket.casts[spellId] = (bucket.casts[spellId] ?? 0) + 1;
          // What the slot's neighbours lent this cast: its damage may be theirs (a Knockback's wall splat).
          const lends = (e.diagnostics?.resolvedCasts?.() ?? []).find((c: any) => c.spellId === spellId)?.lends ?? [];
          for (const lend of lends) {
            const by = ((bucket.lent ??= {})[spellId] ??= {});
            by[lend.name] = (by[lend.name] ?? 0) + 1;
          }
        } else bucket.failed[spellId] = (bucket.failed[spellId] ?? 0) + 1;
        const sp = (e.manifest?.spells ?? []).find((d: any) => d.id === spellId);
        if (result?.success && cost <= 0) m.anomalies.push(`cast of ${spellId} succeeded without spending its turn`);
        // Blood magic pays in HP; a cast that raises mana (a drain) is not a missing payment.
        // Worn flat discounts (Archmage's −6) stack down to a free cast (`effectiveManaCost`).
        const mods = [
          ...e.player.inventory.paperdoll.getEquippedItems().flatMap((it: any) => [...(it.modifiers ?? []), it.wornEffects ?? {}]),
          ...(e.player.perkModifiers ?? []),
        ];
        const discount = mods.reduce((sum: number, mod: any) => sum + (mod.manaCostDiscount ?? 0), 0);
        const free = discount >= (sp?.manaCost ?? 0);
        if (cost > 0 && result?.success && (sp?.manaCost ?? 0) > 0 && !free && sp?.school !== 'BloodMagic' && e.player.mana === manaBefore) {
          m.anomalies.push(`cast of ${spellId} spent its turn and no mana`);
        }
      }
      return result;
    };

    // Stones, rites and altars, from the game's own events.
    const notify = e.onGameEvent;
    e.onGameEvent = (event: any) => {
      const floor = w.__cotwEngine?.currentFloor ?? 0;
      if (event?.type === 'learning_stone_reached') {
        if (m.stones[floor] === 'missed') m.stones[floor] = 'reached';
      } else if (event?.type === 'learning_stone_read') {
        m.stones[floor] = 'read';
        if (event.data?.spellId) {
          m.stonesRead++;
          if (event.data?.shortcut) m.shortcuts++;
          m.recent.push(event.data?.shortcut ? 'shortcut' : 'stone');
        } else {
          m.runesFromStones++;
        }
      } else if (event?.type === 'kill_rite_performed') {
        m.rites++;
        m.recent.push('rite');
      } else if (event?.type === 'altar_rite_performed') {
        m.altarRites++;
        m.recent.push('altar');
        if (event.data?.altarId) m.altars[`${floor}:${event.data.altarId}`] = 'performed';
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
      const { known, recent: _recent, anomalies: _anomalies, lastFloor: _lastFloor, ...rest } = m;
      return { ...rest, spellsKnown: [...known] };
    })
    .catch(() => null);
}

/** Magic anomalies queued since the last call (the spec turns each into a finding). */
export async function drainMagicAnomalies(page: Page): Promise<string[]> {
  return page
    .evaluate(() => {
      const m = (window as any).__soakMagic;
      return m ? (m.anomalies.splice(0) as string[]) : [];
    })
    .catch(() => []);
}
