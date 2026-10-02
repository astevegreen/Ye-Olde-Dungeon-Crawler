import {
  COIN_NAMES,
  type CoinDenomination,
  type GameEngine,
  type Item,
  type NPC,
  SageService,
  TempleService,
  TrainerService,
  findRuneOfReturn,
  formatCurrency,
  getPlayerCoinItems,
  getPlayerCurrencyBreakdown,
  resolveManaTerms,
} from '../../engine';
import { resolveBranding } from '../branding';
import { escapeHtml, keyChip } from '../html';
import { formatWeight } from '../units';

/**
 * What the shop dialog shows for each town service, as data and HTML. The dialog
 * (shopDialog.ts) owns state, keys and the engine calls; these functions only read.
 */

/** Everything a button in the shop can do. */
export type ShopAction =
  | 'trade'
  | 'tab-buy'
  | 'tab-sell'
  | 'cleanse'
  | 'heal'
  | 'identify'
  | 'advise'
  | 'bestiary'
  | 'compact'
  | 'bond'
  | 'revive'
  | 'bodyguard'
  | 'skirmisher'
  | 'teach'
  | 'rune-ranks'
  | 'pact'
  | 'leave';

/** One service a townsperson offers: its button, its key, and what it costs. */
export interface ServiceOffer {
  act: ShopAction;
  /** The letter that runs it (shown as a key chip, matched case-insensitively). */
  key: string;
  label: string;
  detail: string;
  /** Base price in copper: 0 is free; absent means it isn't something you pay for. */
  priceCp?: number;
  disabled?: boolean;
  /** What the action applies to, e.g. a pact's id. */
  arg?: string;
}

/** A town service's panel: a few facts, then its offers. */
export interface ServicePanel {
  heading: string;
  /** Pre-escaped HTML shown above the offers. */
  facts?: string;
  offers: ServiceOffer[];
}

const DENOMINATIONS: CoinDenomination[] = ['platinum', 'gold', 'silver', 'copper'];

/** The dialog title: the shop's or service's name where the pack gives one. */
export function serviceTitle(engine: GameEngine, npc: NPC, shopName?: string): string {
  if (shopName) return shopName;
  const services = engine.manifest?.town?.services;
  if (npc.role === 'priest' && services?.templeName) return services.templeName;
  if (npc.role === 'banker' && services?.bankName) return services.bankName;
  return npc.name;
}

function unidentifiedItems(engine: GameEngine): Item[] {
  const inventory = engine.player.inventory;
  return [
    ...inventory.primaryPack.getItems().filter((i) => !i.identified),
    ...inventory.paperdoll.getAllEquipped().map((e) => e.item).filter((i) => !i.identified),
  ];
}

function templePanel(engine: GameEngine): ServicePanel {
  const mana = resolveManaTerms(engine.manifest).name;
  return {
    heading: 'Services',
    facts: '<div class="ui-note">Your standing with the temple can raise or lower these prices.</div>',
    offers: [
      {
        act: 'cleanse',
        key: 'C',
        label: 'Cleanse curses',
        detail: 'Breaks every curse on the gear you wear. The freed items go to your pack.',
        priceCp: TempleService.CURSE_CLEANSE_COST_CP,
      },
      {
        act: 'heal',
        key: 'H',
        label: 'Heal and restore',
        detail: `Cures poison, paralysis and slowness, and restores all your health and ${mana}.`,
        priceCp: TempleService.HEAL_RESTORE_COST_CP,
      },
    ],
  };
}

function sagePanel(engine: GameEngine): ServicePanel {
  const unknown = unidentifiedItems(engine);
  const shown = unknown.slice(0, 6);
  const more = unknown.length - shown.length;
  const facts =
    unknown.length === 0
      ? '<div class="ui-note">You carry nothing unidentified.</div>'
      : `<div class="ui-note">Unidentified items you carry: <b class="ui-num">${unknown.length}</b></div>
         <ul class="shop-bullets">${shown.map((i) => `<li>${escapeHtml(i.displayName)} <span class="ui-faint">${escapeHtml(i.category)}</span></li>`).join('')}${more > 0 ? `<li class="ui-faint">and ${more} more</li>` : ''}</ul>`;
  return {
    heading: 'Services',
    facts,
    offers: [
      {
        act: 'identify',
        key: 'I',
        label: 'Identify an item',
        detail: 'Reveals the first unidentified item in your pack, then the ones you wear.',
        priceCp: SageService.IDENTIFY_FEE_CP,
        disabled: unknown.length === 0,
      },
      {
        act: 'advise',
        key: 'A',
        label: 'Ask for advice',
        detail: 'A review of your load, your curses and the dangers below. The full report goes to the log.',
        priceCp: 0,
      },
      {
        act: 'bestiary',
        key: 'B',
        label: 'Open the bestiary',
        detail: 'The creatures you have met and what you know of them.',
      },
    ],
  };
}

function bankerPanel(engine: GameEngine): ServicePanel {
  const coins = getPlayerCurrencyBreakdown(engine.player);
  const grams = getPlayerCoinItems(engine.player).reduce((sum, c) => sum + c.item.totalWeight(), 0);
  const rows = DENOMINATIONS.filter((d) => coins[d] > 0)
    .map((d) => `<dt>${escapeHtml(COIN_NAMES[d].plural)}</dt><dd class="ui-num">${coins[d]}</dd>`)
    .join('');
  return {
    heading: 'Your coins',
    facts: `<dl class="ui-kv shop-coins">${rows || '<dt>No coins</dt><dd></dd>'}<dt>They weigh</dt><dd class="ui-num">${escapeHtml(formatWeight(grams))}</dd></dl>`,
    offers: [
      {
        act: 'compact',
        key: 'E',
        label: 'Exchange coins',
        detail: 'Trades loose copper and silver for gold and platinum of the same value, which weigh far less.',
        priceCp: 0,
        disabled: grams === 0,
      },
    ],
  };
}

function trainerPanel(engine: GameEngine): ServicePanel {
  const companion = engine.companion;
  const bonded = engine.getWorldFlag('companion_bonded');
  const fallen = engine.deadCompanionRecord;
  const status = !bonded
    ? 'You have not bonded with a companion yet.'
    : companion
      ? `${companion.name}, ${companion.archetype}: health ${companion.hp} / ${companion.maxHp}.`
      : fallen
        ? `${fallen.name} has fallen and can be revived.`
        : 'You are bonded, but no companion is with you.';
  return {
    heading: 'Companion training',
    facts: `<div class="ui-note">${escapeHtml(status)}</div>`,
    offers: [
      { act: 'bond', key: 'T', label: 'Bond with a companion', detail: 'A companion who fights at your side.', priceCp: TrainerService.BOND_COST_CP },
      { act: 'revive', key: 'R', label: 'Revive your companion', detail: 'Brings a fallen companion back.', priceCp: TrainerService.REVIVE_COST_CP },
      { act: 'bodyguard', key: 'G', label: 'Train as a bodyguard', detail: 'Stays right beside you.', priceCp: TrainerService.ARCHETYPE_SWITCH_COST_CP },
      { act: 'skirmisher', key: 'K', label: 'Train as a skirmisher', detail: 'Ranges ahead and goes after nearby enemies first.', priceCp: TrainerService.ARCHETYPE_SWITCH_COST_CP },
      { act: 'teach', key: 'W', label: 'Teach Rally Howl', detail: 'On command, heals your companion and hastens you.', priceCp: TrainerService.TEACH_SKILL_COST_CP },
    ],
  };
}

function runeSmithPanel(engine: GameEngine): ServicePanel {
  const rune = findRuneOfReturn(engine.player);
  const smith = resolveBranding(engine.manifest).runeSmithName;
  const config = engine.manifest?.runeOfReturn;
  const awakened = Boolean(engine.player?.hasDiscoveredRune);
  let lines: string[];
  if (rune && awakened) {
    lines = [
      `Rune of Return: ${rune.charges} of ${rune.maxCharges} charges.`,
      engine.player?.deepestRecallFloor
        ? `Its rift is open to floor ${engine.player.deepestRecallFloor}. Use the rune in town to go back.`
        : 'Attuned and ready to recall you from the depths.',
    ];
  } else if (rune) {
    lines = [`You carry a dormant rune. Speak with ${smith} to awaken it.`];
  } else {
    const floor = config?.acquisition?.floor;
    const where = config?.whereaboutsHint ?? `an ancient vault ${floor ? `on floor ${floor}` : 'in the depths'}`;
    lines = ['You have not found the Rune of Return.', `${smith.charAt(0).toUpperCase()}${smith.slice(1)} speaks of ${where}.`];
  }
  return {
    heading: 'Rune of Return',
    facts: lines.map((l) => `<div class="ui-note">${escapeHtml(l)}</div>`).join(''),
    offers: [
      {
        act: 'rune-ranks',
        key: 'U',
        label: 'Open the rune ranks',
        detail: awakened ? 'Spend level points on the rune, on the Character tab.' : `Locked until ${smith} awakens your rune.`,
        disabled: !awakened,
      },
    ],
  };
}

/** A townsperson with no shop or service: the advice the pack gives them, if any. */
function townspersonPanel(engine: GameEngine, npc: NPC): ServicePanel | null {
  const advice = engine.manifest?.town?.npcs?.find((d) => d.id === npc.id)?.advice;
  if (!advice) return null;
  return { heading: 'Local advice', facts: `<div class="ui-note">${escapeHtml(advice)}</div>`, offers: [] };
}

/**
 * The pact keeper's offers: seal or renounce each pact, numbered 1-9. A pact holds until
 * the hero comes back here (`manifest.pactKeeperNpcId`).
 */
function pactOffers(engine: GameEngine): ServiceOffer[] {
  return engine.pacts.getAllPacts().slice(0, 9).map((pact, i) => {
    const sealed = engine.pacts.isPactActive(pact.id);
    return {
      act: 'pact' as const,
      arg: pact.id,
      key: String(i + 1),
      label: `${sealed ? 'Renounce' : 'Seal'} the ${pact.name}`,
      detail: sealed ? `Sealed. You pay ${pact.curseDescription}; you gain ${pact.rewardDescription}.` : `Cost: ${pact.curseDescription}. Reward: ${pact.rewardDescription}.`,
    };
  });
}

const PACT_NOTE =
  '<div class="ui-note">A pact makes the dungeon harder and pays more for it. It holds until you come back here to renounce it.</div>';

/** The panel for a townsperson who isn't a merchant; null when they only greet. */
export function servicePanelFor(engine: GameEngine, npc: NPC): ServicePanel | null {
  const panel = basePanelFor(engine, npc);
  if (!engine.manifest?.pactKeeperNpcId || npc.id !== engine.manifest.pactKeeperNpcId) return panel;
  const offers = pactOffers(engine);
  if (offers.length === 0) return panel;
  return panel
    ? { ...panel, facts: `${panel.facts ?? ''}${PACT_NOTE}`, offers: [...panel.offers, ...offers] }
    : { heading: 'Pacts', facts: PACT_NOTE, offers };
}

function basePanelFor(engine: GameEngine, npc: NPC): ServicePanel | null {
  const attunementNpcId = engine.manifest?.runeOfReturn?.attunementNpcId;
  if (attunementNpcId && npc.id === attunementNpcId) return runeSmithPanel(engine);
  switch (npc.role) {
    case 'priest':
      return templePanel(engine);
    case 'sage':
      return sagePanel(engine);
    case 'banker':
      return bankerPanel(engine);
    case 'trainer':
      return trainerPanel(engine);
    default:
      return townspersonPanel(engine, npc);
  }
}

/** The one price format, "Free" for no charge, and nothing where nothing is sold. */
export function priceText(priceCp: number | undefined): string {
  if (priceCp === undefined) return '';
  return priceCp > 0 ? formatCurrency(priceCp) : 'Free';
}

export function servicePanelHtml(panel: ServicePanel): string {
  const offers = panel.offers
    .map(
      (o) => `
      <div class="shop-offer${o.disabled ? ' is-disabled' : ''}">
        <div class="shop-offer-text">
          <div class="shop-offer-label">${escapeHtml(o.label)}</div>
          <div class="ui-note">${escapeHtml(o.detail)}</div>
        </div>
        <div class="shop-price ui-num">${escapeHtml(priceText(o.priceCp))}</div>
        <button type="button" class="ui-btn ui-btn--sm" data-act="${o.act}"${o.arg ? ` data-arg="${escapeHtml(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${escapeHtml(o.disabled ? 'Unavailable' : 'Choose')} ${keyChip(o.key)}</button>
      </div>`
    )
    .join('');
  return `
    <section class="ui-card shop-service">
      <h3 class="ui-h">${escapeHtml(panel.heading)}</h3>
      ${panel.facts ?? ''}
      ${offers ? `<div class="shop-offers">${offers}</div>` : ''}
    </section>`;
}
