import type {
  ActionHook,
  ChoiceDefinition,
  EngineContext,
  HeroMarkDefinition,
  Predicate,
  ScriptedVaultNpc,
  StoryChoiceTrigger,
  TimedEventDefinition,
} from '../../engine';
import {
  ExecuteChoiceAction,
  awardMilestone,
  MovementAction,
  NPC,
  getCounter,
  getFlag,
  getMerchantPriceMultiplier,
  incrementCounter,
  modifyFaction,
  setFlag,
} from '../../engine';
import { cotwMilestone } from './renown';
import { COTW_MERCHANT_PRICING } from './factions';
import { PROLOGUE_VILLAGERS, prologueVillagerTaken, type RaidVillagerId } from './prologue';
import { ZEALOT_CLAIM_HEARD_FLAG } from './siphonPylon';

/**
 * The Siphon Altar of Járnviðr (floor 22). Four captive villagers are bound around a
 * sacrificial altar; the player rescues them by walking into them, settles the rest at
 * the altar, or lets the ritual's countdown run out. Once all four are accounted for, the
 * trade settles (`resolveHostageRitual`): every two saved buy a frith spell, every two
 * sacrificed a blood spell, and the hero carries the altar's mark for each sacrifice.
 *
 * Everything here is pack content wired through generic engine capabilities:
 * `scriptedVaultPlacements` stamps the vault and its NPCs, a vault `legend` places
 * the altar tile, a tile-triggered choice runs the altar, a timed event runs the
 * countdown, and the action hooks below drive rescue and resolution.
 */

export const SIPHON_RITUAL_FLOOR = 22;
export const SIPHON_VAULT_ID = 'siphon_altar_vault';
export const SIPHON_ALTAR_TILE = 'siphon_altar';
const SIPHON_ALTAR_CHOICE_ID = 'blood_altar_ritual';

const FLAG_STARTED = 'siphon_ritual_started';
const FLAG_EXPIRED = 'siphon_ritual_expired';
const FLAG_TIMER_STOPPED = 'siphon_ritual_timer_stopped';
const FLAG_RESOLVED = 'siphon_ritual_resolved';
const FLAG_CAPTIVES_SEATED = 'siphon_raid_captives_seated';
const COUNTER_RESCUED = 'hostages_rescued';
const COUNTER_SACRIFICED = 'hostages_sacrificed';
/** Captives the countdown took: the warlocks finished their own rite, so they buy nothing. */
const COUNTER_LOST = 'hostages_lost';
/** A spell of the kind is owed and its pick waits (`SIPHON_GIFT_TRIGGERS`). */
const FLAG_FRITH_PICK = 'siphon_frith_gift_owed';
const FLAG_BLOOD_PICK = 'siphon_blood_gift_owed';

/** Standing at the extremes, scaled by (saved - sacrificed) / 4 and cut toward zero. */
const TOWN_SWING = 10;
const TEMPLE_SWING = 25;

/** The altar's spells, mirrored in pairs: one ends a fight, one brings allies. */
const FRITH_PAIR = ['grith', 'disir'] as const;
const BLOOD_PAIR = ['blood_reap', 'draugr_call'] as const;

/**
 * The altar's mark, read from its own counter: half for one to three sacrificed, full for
 * all four. Old saves marked `blood_tainted_hero` sacrificed all four.
 */
export const ALTAR_MARK_FULL: Predicate = {
  type: 'or',
  predicates: [
    { type: 'minCounter', counter: COUNTER_SACRIFICED, value: 4 },
    { type: 'hasFlag', flag: 'blood_tainted_hero' },
  ],
};
export const ALTAR_MARK_HALF: Predicate = {
  type: 'and',
  predicates: [{ type: 'minCounter', counter: COUNTER_SACRIFICED, value: 1 }, { type: 'not', predicate: ALTAR_MARK_FULL }],
};
/** Any mark at all: the darker lines in town and at Urðr's Pool read this. */
export const ALTAR_MARKED: Predicate = { type: 'minCounter', counter: COUNTER_SACRIFICED, value: 1 };

export const ALTAR_MARKS: HeroMarkDefinition[] = [
  { id: 'altar_mark_half', label: 'Blood-marked', when: ALTAR_MARK_HALF, hudColor: 'var(--ui-warn)', detail: 'the altar took a captive for you' },
  { id: 'altar_mark_full', label: 'Blood-marked, wholly', when: ALTAR_MARK_FULL, hudColor: 'var(--ui-bad)', detail: 'the altar took all four captives for you' },
];

/** The altar's mark on this hero: none, half or full. */
export function altarMark(engine: EngineContext): 'none' | 'half' | 'full' {
  const sacrificed = getCounter(engine.worldState, COUNTER_SACRIFICED);
  if (sacrificed >= 4 || getFlag(engine.worldState, 'blood_tainted_hero')) return 'full';
  return sacrificed > 0 ? 'half' : 'none';
}

/** Chebyshev distance at which the player notices the ritual and its countdown starts. */
const RITUAL_NOTICE_RADIUS = 8;

export const HOSTAGE_VILLAGERS: ScriptedVaultNpc[] = [
  {
    id: 'captive_villager_1',
    name: 'Ingrid of the Mill',
    greeting: 'Please, cut my ropes before they light the pyres!',
    dialogText: 'Thank the gods! I have an emergency town recall ward! Run!',
  },
  {
    id: 'captive_villager_2',
    name: 'Torstein the Cooper',
    greeting: 'The dark chanting... it freezes my marrow! Free me!',
    dialogText: 'Thank the gods! I have an emergency town recall ward! Run!',
  },
  {
    id: 'captive_villager_3',
    name: 'Sigrid the Weaver',
    greeting: 'May the gods preserve you! Help me escape this nightmare!',
    dialogText: 'Thank the gods! I have an emergency town recall ward! Run!',
  },
  {
    id: 'captive_villager_4',
    name: 'Young Leif',
    greeting: 'I have a town recall ward! Just cut my bonds!',
    dialogText: 'Thank the gods! I have an emergency town recall ward! Run!',
  },
];

/** How Olaf names each captive, in roster order. */
const CAPTIVE_SHORT_NAMES = ['Ingrid', 'Torstein', 'Sigrid', 'Leif'];

/**
 * Two of the four offer themselves for the town's winter, the old way: in the Ynglinga saga
 * a famine broke after the Swedes gave the gods their own king, Dómaldi. The other two, the
 * child among them, want to live. What each says when the hero first comes upon the altar.
 */
const CAPTIVE_STANCES: Record<string, { willing: boolean; line: string }> = {
  captive_villager_1: {
    willing: true,
    line: '“When famine held the Swedes, they gave the gods their own king, and the winter broke,” Ingrid says. “That is the old way. Let it be me, and let the others go.”',
  },
  captive_villager_2: {
    willing: false,
    line: '“I have a wife and a cooperage above,” Torstein says. “I want to go home.”',
  },
  captive_villager_3: {
    willing: true,
    line: '“My loom is cold and my sons are grown,” Sigrid says. “If blood will warm the town this winter, take mine.”',
  },
  captive_villager_4: {
    willing: false,
    line: 'Young Leif says nothing. He wants his mother.',
  },
};

/**
 * A villager the coven dragged down at the end of the raid (prologue.ts) is bound here in a
 * captive's place, so the people taken that night come back into the story. The fourth
 * captive is nobody's stand-in.
 */
const RAID_STAND_INS: Record<string, { villagerId: RaidVillagerId; greeting: string; rescued: string; stance: string }> = {
  captive_villager_1: {
    villagerId: 'prologue-eir',
    greeting: 'You came all this way down? Cut my ropes, before they light the pyres!',
    rescued: '“Thor keep you,” Eir breathes, and her recall ward takes her home.',
    stance: '“I keep Thor’s candles,” Eir says, steadier than you. “If the town’s winter wants a gift, let it be one who was ready. Let it be me.”',
  },
  captive_villager_2: {
    villagerId: 'prologue-sigrun',
    greeting: 'Is Father alive? Cut me loose, please, cut me loose!',
    rescued: '“Tell Father I am coming,” Sigrun gasps, and her recall ward takes her home.',
    stance: '“Not me,” Sigrun says. “Father barred the door on me once. Don’t make him lose me twice.”',
  },
  captive_villager_3: {
    villagerId: 'prologue-brandr',
    greeting: 'They dragged me down from the plaza that night. Get me out of here!',
    rescued: '“Gunther still owes me a chisel,” Brandr laughs, half sobbing, and his recall ward takes him home.',
    stance: '“Gunther can forge another chisel,” Brandr says, “and the town can find another apprentice. Let it be me.”',
  },
};

interface CaptiveIdentity {
  name: string;
  shortName: string;
  standIn?: (typeof RAID_STAND_INS)[string];
}

/** Who is bound in a captive's place this run: a villager taken in the raid, or the captive. */
export function captiveIdentity(engine: EngineContext, captiveId: string): CaptiveIdentity {
  const index = HOSTAGE_VILLAGERS.findIndex((v) => v.id === captiveId);
  const standIn = RAID_STAND_INS[captiveId];
  const villager = standIn && prologueVillagerTaken(engine, standIn.villagerId)
    ? PROLOGUE_VILLAGERS.find((v) => v.id === standIn.villagerId)
    : undefined;
  if (villager) return { name: villager.name, shortName: villager.shortName, standIn };
  return { name: HOSTAGE_VILLAGERS[index]?.name ?? 'The captive', shortName: CAPTIVE_SHORT_NAMES[index] ?? 'a captive' };
}

/** "Eir", "Eir and Brandr", "Eir, Sigrun, and Brandr". */
export function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** The four captives as Olaf names them ("Eir, Torstein, Sigrid, and Leif"). */
export function captiveNamesForThanks(engine: EngineContext): string {
  return listNames(HOSTAGE_VILLAGERS.map((v) => captiveIdentity(engine, v.id).shortName));
}

/** The villagers the raid took who still wait at the altar, by short name. */
export function raidVillagersStillCaptive(engine: EngineContext): string[] {
  return HOSTAGE_VILLAGERS.filter((v) => !isAccountedFor(engine, v.id))
    .map((v) => captiveIdentity(engine, v.id))
    .filter((identity) => identity.standIn)
    .map((identity) => identity.shortName);
}

/**
 * Puts the raid's taken villagers in their captives' places, once, on the ritual floor. The
 * vault is stamped before the floor knows the run's story, so they are seated on the first
 * action there; the stand-in keeps the captive's id, so every flag and count works unchanged.
 */
function seatRaidCaptives(engine: EngineContext): void {
  if (getFlag(engine.worldState, FLAG_CAPTIVES_SEATED)) return;
  let found = false;
  for (const captive of HOSTAGE_VILLAGERS) {
    const entity = engine.map.getEntityById(captive.id);
    if (!entity) continue;
    found = true;
    const identity = captiveIdentity(engine, captive.id);
    if (!identity.standIn) continue;
    const { x, y } = entity;
    engine.removeEntity(entity);
    engine.map.addEntity(
      new NPC({
        id: captive.id,
        name: identity.name,
        role: 'villager',
        position: { x, y },
        greeting: identity.standIn.greeting,
        dialogText: captive.dialogText,
        isStationary: true,
        spriteKey: identity.standIn.villagerId,
      })
    );
  }
  if (found) setFlag(engine.worldState, FLAG_CAPTIVES_SEATED, true);
}

/** What the town's shops charge now that standing has moved: "town prices: 15% dearer". */
function townPricesNote(engine: EngineContext): string {
  const multiplier = getMerchantPriceMultiplier(engine.worldState, COTW_MERCHANT_PRICING);
  const percent = Math.round(Math.abs(1 - multiplier) * 100);
  if (percent === 0) return 'town prices: unchanged';
  return multiplier < 1 ? `town prices: ${percent}% off` : `town prices: ${percent}% dearer`;
}

function isCaptive(id: string): boolean {
  return HOSTAGE_VILLAGERS.some((v) => v.id === id);
}

function isAccountedFor(engine: EngineContext, captiveId: string): boolean {
  return (
    getFlag(engine.worldState, `${captiveId}_rescued`) ||
    getFlag(engine.worldState, `${captiveId}_sacrificed`) ||
    getFlag(engine.worldState, `${captiveId}_lost`)
  );
}

/** Whether the captive was cut loose and sent home (homecoming.ts seats them in town). */
export function captiveRescued(engine: EngineContext, captiveId: string): boolean {
  return getFlag(engine.worldState, `${captiveId}_rescued`);
}

/** How the ritual ended for the town: not yet, every captive home, or someone lost to the altar. */
export function ritualOutcome(engine: EngineContext): 'pending' | 'all_home' | 'some_lost' {
  if (!getFlag(engine.worldState, FLAG_RESOLVED)) return 'pending';
  const gone = getCounter(engine.worldState, COUNTER_SACRIFICED) + getCounter(engine.worldState, COUNTER_LOST);
  return gone > 0 ? 'some_lost' : 'all_home';
}

/** Captives neither rescued nor sacrificed yet, in roster order. */
function remainingCaptives(engine: EngineContext): ScriptedVaultNpc[] {
  return HOSTAGE_VILLAGERS.filter((v) => !isAccountedFor(engine, v.id));
}

function removeCaptiveEntity(engine: EngineContext, captiveId: string): void {
  const entity = engine.map.getEntityById(captiveId);
  if (entity) {
    engine.removeEntity(entity);
  }
}

/**
 * Resolves the ritual once all four captives are accounted for.
 */
export function checkAndResolveHostageRitual(engine: EngineContext): boolean {
  if (getFlag(engine.worldState, FLAG_RESOLVED)) {
    return false;
  }
  if (remainingCaptives(engine).length > 0) {
    return false;
  }
  resolveHostageRitual(engine);
  return true;
}

/**
 * Rescues one captive: they vanish to town on their recall ward.
 */
export function rescueCaptiveVillager(engine: EngineContext, captiveId: string): boolean {
  if (!isCaptive(captiveId) || isAccountedFor(engine, captiveId)) {
    return false;
  }
  const { name, standIn } = captiveIdentity(engine, captiveId);

  setFlag(engine.worldState, `${captiveId}_rescued`, true);
  incrementCounter(engine.worldState, COUNTER_RESCUED, 1);
  removeCaptiveEntity(engine, captiveId);
  engine.log(
    standIn
      ? `You cut ${name}'s bonds! ${standIn.rescued} (+1 Rescued)`
      : `You cut ${name}'s bonds! They trigger an emergency recall charm and vanish to town! (+1 Rescued)`
  );

  checkAndResolveHostageRitual(engine);
  return true;
}

/**
 * Sacrifices one captive upon the altar.
 */
export function sacrificeCaptiveVillager(engine: EngineContext, captiveId: string): boolean {
  if (!isCaptive(captiveId) || isAccountedFor(engine, captiveId)) {
    return false;
  }
  const { name } = captiveIdentity(engine, captiveId);

  setFlag(engine.worldState, `${captiveId}_sacrificed`, true);
  incrementCounter(engine.worldState, COUNTER_SACRIFICED, 1);
  removeCaptiveEntity(engine, captiveId);
  engine.log(`A blood-curse erupts! The warlocks sacrifice ${name} upon the dark stones! (+1 Sacrificed)`);

  checkAndResolveHostageRitual(engine);
  return true;
}

/**
 * The countdown ran out: the warlocks take the captive in their own rite. The hero bought
 * nothing with it and bears no mark for it.
 */
function loseCaptiveVillager(engine: EngineContext, captiveId: string): void {
  if (!isCaptive(captiveId) || isAccountedFor(engine, captiveId)) return;
  const { name } = captiveIdentity(engine, captiveId);
  setFlag(engine.worldState, `${captiveId}_lost`, true);
  incrementCounter(engine.worldState, COUNTER_LOST, 1);
  removeCaptiveEntity(engine, captiveId);
  engine.log(`The warlocks finish their rite: ${name} is lost.`);
  checkAndResolveHostageRitual(engine);
}

/** Once the countdown has run out, whoever remains is the warlocks', before the hero's next deed can save them. */
function loseRemainingIfExpired(engine: EngineContext): boolean {
  if (!getFlag(engine.worldState, FLAG_EXPIRED) || getFlag(engine.worldState, FLAG_RESOLVED)) return false;
  for (const captive of remainingCaptives(engine)) loseCaptiveVillager(engine, captive.id);
  return true;
}

/**
 * Settles the trade, once. Every two captives saved buy a frith spell and every two
 * sacrificed a blood spell, the odd one buying none; a kind earned twice gives both of its
 * pair, once a pick between them (`SIPHON_GIFT_CHOICES`). Standing moves in even steps on
 * saved minus sacrificed, the temple carrying the weight (townsfolk standing drives shop
 * prices via the manifest's `merchantPricing`). Captives the countdown took count for nothing.
 */
export function resolveHostageRitual(engine: EngineContext): void {
  if (getFlag(engine.worldState, FLAG_RESOLVED)) {
    return;
  }
  setFlag(engine.worldState, FLAG_RESOLVED, true);
  // Stops the countdown if the ritual resolved before it ran out.
  setFlag(engine.worldState, FLAG_TIMER_STOPPED, true);

  const rescued = getCounter(engine.worldState, COUNTER_RESCUED);
  const sacrificed = getCounter(engine.worldState, COUNTER_SACRIFICED);
  const net = (rescued - sacrificed) / 4;
  const town = Math.trunc(net * TOWN_SWING);
  const temple = Math.trunc(net * TEMPLE_SWING);
  if (town !== 0) modifyFaction(engine.worldState, 'townsfolk', town);
  if (temple !== 0) modifyFaction(engine.worldState, 'temple_standing', temple);
  if (rescued >= 4) {
    setFlag(engine.worldState, 'savior_of_jarnvidr', true);
    awardMilestone(engine, cotwMilestone('captives_saved'));
  }
  if (sacrificed >= 4) setFlag(engine.worldState, 'blood_tainted_hero', true);

  const gifts = [
    ...grantGifts(engine, Math.floor(rescued / 2), FRITH_PAIR, FLAG_FRITH_PICK),
    ...grantGifts(engine, Math.floor(sacrificed / 2), BLOOD_PAIR, FLAG_BLOOD_PICK),
  ];
  const standing = `${signed(town)} Townsfolk Standing, ${signed(temple)} Temple Standing; ${townPricesNote(engine)}`;
  engine.log(`${ritualVerdict(rescued, sacrificed)} (${standing})`);
  if (gifts.length > 0) engine.log(gifts.join(' '));
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function ritualVerdict(rescued: number, sacrificed: number): string {
  if (rescued >= 4) return 'SAVIOR OF JÁRNVIÐR! All four captives were rescued alive. Bjarnarhaven praises your name!';
  if (sacrificed >= 4) return 'THE BLOOD SIPHON IS COMPLETE! All four captives fed the altar. Bjarnarhaven recoils in horror.';
  if (rescued === 0 && sacrificed === 0) return 'The warlocks finished their rite without you. Nothing was traded at the altar.';
  return `The altar's trade is done: ${rescued} saved, ${sacrificed} given to the stones.`;
}

/**
 * Teaches what a kind earned: both of its pair for two spells, or owes a pick for one.
 * Returns what to tell the hero.
 */
function grantGifts(engine: EngineContext, count: number, pair: readonly [string, string], pickFlag: string): string[] {
  if (count <= 0) return [];
  const frith = pair === FRITH_PAIR;
  if (count >= 2) {
    for (const spellId of pair) engine.player.learnSpell(spellId);
    return [frith ? 'The saved kin teach you Grið and the Dísir.' : 'The altar teaches you Blood Reap and Draugr-call.'];
  }
  setFlag(engine.worldState, pickFlag, true);
  return [frith ? 'The saved kin offer you one of their spells.' : 'The altar offers you one of its spells.'];
}

/**
 * Settles every remaining captive according to the altar option chosen: all home, only the
 * willing to the stones, or all of them to the stones.
 */
function applyAltarOption(engine: EngineContext, optionId: string): void {
  for (const captive of remainingCaptives(engine)) {
    const rescue = optionId === 'rescue_all' || (optionId === 'balance_path' && !isWilling(captive.id));
    if (rescue) {
      rescueCaptiveVillager(engine, captive.id);
    } else {
      sacrificeCaptiveVillager(engine, captive.id);
    }
  }
}

/** How each altar option answers Vigdís, for a hero who heard her. */
const ANSWERS_TO_HER_CLAIM: Record<string, string> = {
  rescue_all: 'You overrule the ones who offered and send them home with the rest. Let Vigdís’s word die with her.',
  balance_path: 'You take what was offered, as the old way asks, and not one life more on Vigdís’s word.',
  harvest_all: 'Only blood will, Vigdís said. You take her at her word, and the unwilling with the willing.',
};

/**
 * Interactive choice for the Siphon Altar tile. The options only narrate; the
 * `SIPHON_RITUAL_HOOK` post-hook settles the remaining captives per option.
 */
export const BLOOD_ALTAR_CHOICE: ChoiceDefinition = {
  id: SIPHON_ALTAR_CHOICE_ID,
  title: 'The Siphon Altar of Járnviðr',
  description:
    'You stand before the ancient obsidian altar. Dark vitriol pools in concentric grooves carved into the stone. The captive villagers are bound at the chamber’s edge while the warlocks chant. Some have offered themselves for the town’s winter; the others want only to go home.',
  options: [
    {
      id: 'rescue_all',
      label: 'Shatter the Siphon — Prioritize Rescuing Every Captive',
      description:
        'Sunder the bindings and send every remaining captive home, the willing too. Every two saved give you a frith spell; the temple and the town will remember it.',
      consequences: [
        { type: 'logMessage', message: 'You smash the warded runes of the siphon! The warlocks scream in frustration!' },
      ],
    },
    {
      id: 'balance_path',
      label: 'Take Only What Was Offered',
      description:
        'Let the altar take only those who offered themselves, and free the rest. Every two saved give a frith spell, every two taken a blood spell, and the altar marks you.',
      consequences: [
        { type: 'logMessage', message: 'You cut the ropes of those who want to live, and leave the willing to the stones.' },
      ],
    },
    {
      id: 'harvest_all',
      label: 'Channel the Dark Altar — Feed It Every Captive',
      description:
        'Let the altar take every remaining captive, the unwilling with the willing. Every two taken give you a blood spell paid for in your own HP, and the altar marks you. The temple will not forgive it.',
      consequences: [
        { type: 'logMessage', message: 'You give the altar every one of them. The grooves in the stone run full.' },
      ],
    },
  ],
  cancelable: true,
  cancelLabel: 'Step Away from the Altar',
  resolvedStates: [
    { flag: FLAG_RESOLVED, message: 'The Siphon Altar lies cold and silent. Its ritual is ended.' },
  ],
};

/**
 * The ritual's countdown, started when the player first comes within sight of a
 * captive. Expiry only flags it: the player's next action gives whoever remains to the
 * warlocks' own rite before it can free or settle anyone (`loseRemainingIfExpired`).
 */
export const SIPHON_TIMED_EVENT: TimedEventDefinition = {
  id: 'siphon_ritual_timer',
  startFlag: FLAG_STARTED,
  turnLimit: 25,
  resolvedFlag: FLAG_TIMER_STOPPED,
  expireConsequences: [
    { type: 'setFlag', flag: FLAG_EXPIRED, value: true },
    { type: 'damagePlayer', amount: 15, cause: 'the Siphon ritual' },
    {
      type: 'logMessage',
      message:
        '*** Time runs out! The warlocks complete the sacrificial siphon, and a wave of dark blood lashes the chamber (-15 HP)! ***',
    },
  ],
};

/** The pick a kind owes when the trade earned one spell of it: the hero takes one of its pair. */
function giftChoice(id: string, title: string, description: string, owedFlag: string, options: Array<{ spellId: string; label: string; description: string }>): ChoiceDefinition {
  return {
    id,
    title,
    description,
    cancelable: false,
    options: options.map((o) => ({
      id: o.spellId,
      label: o.label,
      description: o.description,
      consequences: [
        { type: 'learnSpell', spellId: o.spellId },
        { type: 'setFlag', flag: owedFlag, value: false },
      ],
    })),
  };
}

const FRITH_GIFT_CHOICE_ID = 'siphon_frith_gift';
const BLOOD_GIFT_CHOICE_ID = 'siphon_blood_gift';

/** The two picks: one of the frith pair for two saved, one of the blood pair for two sacrificed. */
export const SIPHON_GIFT_CHOICES: Record<string, ChoiceDefinition> = {
  [FRITH_GIFT_CHOICE_ID]: giftChoice(
    FRITH_GIFT_CHOICE_ID,
    "The Kin's Gift",
    'The captives you saved send their thanks down the recall ward, and with it frith, the peace between kin. Take one of their two spells.',
    FLAG_FRITH_PICK,
    [
      { spellId: 'grith', label: 'Grið', description: 'A foe lays down its arms for 8 turns, until a blow breaks the peace. 10 Seiðr.' },
      { spellId: 'disir', label: 'The Dísir', description: 'Two ancestral spirits guard you for 15 turns. 14 Seiðr.' },
    ]
  ),
  [BLOOD_GIFT_CHOICE_ID]: giftChoice(
    BLOOD_GIFT_CHOICE_ID,
    "The Altar's Price",
    'The blood in the grooves runs back toward you. The altar pays in the coin it was paid in. Take one of its two spells.',
    FLAG_BLOOD_PICK,
    [
      { spellId: 'blood_reap', label: 'Blood Reap', description: 'Finish a foe at 25% HP or less and drink 10 HP of its life. 4 HP.' },
      { spellId: 'draugr_call', label: 'Draugr-call', description: 'Curse a foe: if it dies cursed, it rises and fights for you for 20 turns. 6 HP.' },
    ]
  ),
};

/** Each pick opens on the hero's next move once the trade owes it. */
export const SIPHON_GIFT_TRIGGERS: StoryChoiceTrigger[] = [
  { id: 'siphon_frith_gift_pick', choiceId: FRITH_GIFT_CHOICE_ID, when: { type: 'hasFlag', flag: FLAG_FRITH_PICK } },
  { id: 'siphon_blood_gift_pick', choiceId: BLOOD_GIFT_CHOICE_ID, when: { type: 'hasFlag', flag: FLAG_BLOOD_PICK } },
];

/** Whether the captive offered themselves to the altar. */
function isWilling(captiveId: string): boolean {
  return CAPTIVE_STANCES[captiveId]?.willing ?? false;
}

/** What the captive says at the altar: a raid stand-in speaks for themself. */
function stanceLine(engine: EngineContext, captiveId: string): string | undefined {
  return captiveIdentity(engine, captiveId).standIn?.stance ?? CAPTIVE_STANCES[captiveId]?.line;
}

/** Whether the hero heard Vigdís's claim at the floor 21 pylon. */
function claimHeard(engine: EngineContext): boolean {
  return getFlag(engine.worldState, ZEALOT_CLAIM_HEARD_FLAG);
}

function startRitualCountdown(engine: EngineContext): void {
  if (getFlag(engine.worldState, FLAG_STARTED)) {
    return;
  }
  setFlag(engine.worldState, FLAG_STARTED, true);
  engine.log(
    'Chanting echoes from the obsidian chamber — the warlocks have begun the blood siphon! Free the captives before the ritual completes!'
  );
  // The willing speak first, then those who want to live.
  const remaining = remainingCaptives(engine);
  for (const captive of [...remaining.filter((c) => isWilling(c.id)), ...remaining.filter((c) => !isWilling(c.id))]) {
    const line = stanceLine(engine, captive.id);
    if (line) engine.log(line);
  }
  if (claimHeard(engine)) {
    engine.log('Vigdís’s last words come back to you: something gnaws the root, and only blood will touch it.');
  }
}

/**
 * Rescue on bump: walking into a captive cuts their bonds instead of opening the
 * generic NPC dialogue. Short-circuits the move at zero cost, like talking does.
 */
const SIPHON_RESCUE_HOOK: ActionHook = {
  id: 'cotw-siphon-rescue',
  phase: 'pre',
  actionType: 'MovementAction',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player || !(action instanceof MovementAction)) {
      return;
    }
    // The bump after the countdown ran out frees no one: the warlocks took them first.
    loseRemainingIfExpired(engine);
    const target = engine.map.getEntityAt(actor.x + action.dx, actor.y + action.dy, actor.planeId);
    // A captive already freed or sacrificed is no one's to free (R-cotw-16).
    if (!(target instanceof NPC) || !isCaptive(target.id) || isAccountedFor(engine, target.id)) {
      return;
    }
    // A short-circuited action skips post-hooks, so start the countdown here too.
    startRitualCountdown(engine);
    rescueCaptiveVillager(engine, target.id);
    return { proceed: false, result: { success: true, cost: 0, message: `Freed ${target.name}.` } };
  },
};

/**
 * Starts the countdown when a captive comes into view, settles the captives when the
 * altar choice resolves, and loses whoever remains once the countdown expires.
 */
const SIPHON_RITUAL_HOOK: ActionHook = {
  id: 'cotw-siphon-ritual',
  phase: 'post',
  actionType: '*',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player) {
      return;
    }
    // The countdown runs out wherever the hero is, and a sacrifice reaches only the current
    // map: whoever was settled while floor 22 was stored leaves it once the hero is back.
    if (engine.currentFloor === SIPHON_RITUAL_FLOOR) {
      for (const captive of HOSTAGE_VILLAGERS) {
        if (isAccountedFor(engine, captive.id)) removeCaptiveEntity(engine, captive.id);
      }
    }
    if (getFlag(engine.worldState, FLAG_RESOLVED)) {
      return;
    }
    // Before the altar: a pick made after the countdown ran out settles no one.
    if (loseRemainingIfExpired(engine)) {
      return;
    }

    if (action instanceof ExecuteChoiceAction && action.choice.id === SIPHON_ALTAR_CHOICE_ID) {
      const answer = ANSWERS_TO_HER_CLAIM[action.optionId];
      if (answer && claimHeard(engine)) engine.log(answer);
      applyAltarOption(engine, action.optionId);
      return;
    }

    if (engine.currentFloor === SIPHON_RITUAL_FLOOR) {
      seatRaidCaptives(engine);
      const player = engine.player;
      const inSight = remainingCaptives(engine).some((captive) => {
        const entity = engine.map.getEntityById(captive.id);
        return (
          entity !== null &&
          Math.max(Math.abs(entity.x - player.x), Math.abs(entity.y - player.y)) <= RITUAL_NOTICE_RADIUS
        );
      });
      if (inSight) {
        startRitualCountdown(engine);
      }
    }
  },
};

export const SIPHON_RITUAL_HOOKS: ActionHook[] = [SIPHON_RESCUE_HOOK, SIPHON_RITUAL_HOOK];

