import type {
  ActionHook,
  ChoiceDefinition,
  EngineContext,
  ScriptedVaultNpc,
  TimedEventDefinition,
} from '../../engine';
import {
  ExecuteChoiceAction,
  MovementAction,
  NPC,
  getCounter,
  getFlag,
  incrementCounter,
  modifyFaction,
  setFlag,
} from '../../engine';

/**
 * The Siphon Altar of Járnviðr (floor 22). Four captive villagers are bound around a
 * sacrificial altar; the player rescues them by walking into them, settles the rest at
 * the altar, or lets the ritual's countdown run out. Once all four are accounted for,
 * the rescued/sacrificed split picks one of five outcome tiers (`resolveHostageRitual`).
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
const COUNTER_RESCUED = 'hostages_rescued';
const COUNTER_SACRIFICED = 'hostages_sacrificed';

/** Chebyshev distance at which the player notices the ritual and its countdown starts. */
const RITUAL_NOTICE_RADIUS = 8;

export const HOSTAGE_VILLAGERS: ScriptedVaultNpc[] = [
  {
    id: 'captive_villager_1',
    name: 'Astrid of the Mill',
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

function isCaptive(id: string): boolean {
  return HOSTAGE_VILLAGERS.some((v) => v.id === id);
}

function isAccountedFor(engine: EngineContext, captiveId: string): boolean {
  return (
    getFlag(engine.worldState, `${captiveId}_rescued`) || getFlag(engine.worldState, `${captiveId}_sacrificed`)
  );
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
  const name = HOSTAGE_VILLAGERS.find((v) => v.id === captiveId)?.name ?? 'The captive';

  setFlag(engine.worldState, `${captiveId}_rescued`, true);
  incrementCounter(engine.worldState, COUNTER_RESCUED, 1);
  removeCaptiveEntity(engine, captiveId);
  engine.log(`✨ You cut ${name}'s bonds! They trigger an emergency recall charm and vanish to town! (+1 Rescued)`);

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
  const name = HOSTAGE_VILLAGERS.find((v) => v.id === captiveId)?.name ?? 'A captive';

  setFlag(engine.worldState, `${captiveId}_sacrificed`, true);
  incrementCounter(engine.worldState, COUNTER_SACRIFICED, 1);
  removeCaptiveEntity(engine, captiveId);
  engine.log(`☠ A blood-curse erupts! The warlocks sacrifice ${name} upon the dark stones! (+1 Sacrificed)`);

  checkAndResolveHostageRitual(engine);
  return true;
}

/**
 * Applies the moral outcome of the ritual, once. The tier is picked by how many of the
 * four captives were rescued; the more sacrificed, the more of the Grimoire of Blood
 * Magic the player absorbs — and the worse Bjarnarhaven regards them (townsfolk
 * standing drives shop prices via the manifest's `merchantPricing`).
 */
export function resolveHostageRitual(engine: EngineContext): void {
  if (getFlag(engine.worldState, FLAG_RESOLVED)) {
    return;
  }
  setFlag(engine.worldState, FLAG_RESOLVED, true);
  // Stops the countdown if the ritual resolved before it ran out.
  setFlag(engine.worldState, FLAG_TIMER_STOPPED, true);

  const rescued = getCounter(engine.worldState, COUNTER_RESCUED);
  const player = engine.player;

  if (rescued >= 4) {
    // Tier 1: Pure Savior (4 Rescued, 0 Sacrificed)
    modifyFaction(engine.worldState, 'townsfolk', 30);
    modifyFaction(engine.worldState, 'temple_standing', 15);
    setFlag(engine.worldState, 'savior_of_jarnvidr', true);
    engine.log(
      '✦✦✦ SAVIOR OF JÁRNVIÐR! All four innocent captives were rescued alive. Bjarnarhaven praises your name! (+30 Townsfolk Standing, +15 Temple Standing, 25% Town Shop Discount) ✦✦✦'
    );
  } else if (rescued === 3) {
    // Tier 2: Righteous Leaning (3 Rescued, 1 Sacrificed)
    modifyFaction(engine.worldState, 'townsfolk', 15);
    modifyFaction(engine.worldState, 'temple_standing', 5);
    player.initEnergyModel();
    player.learnSpell('blood_reap');
    player.learnSpell('blood_tap');
    engine.log(
      '✦ Three captives escaped to safety. From the single fallen soul, you gleaned the dark rites of Blood Reap and Blood Tap. (+15 Townsfolk Standing) ✦'
    );
  } else if (rescued === 2) {
    // Tier 3: The Halfway Path (2 Rescued, 2 Sacrificed) — no faction change.
    player.initEnergyModel();
    player.learnSpell('blood_reap');
    player.learnSpell('blood_tap');
    player.learnSpell('crimson_ward');
    engine.log(
      '⚖ A bitter compromise. Two souls escaped, and two fed the dark altar. You unlock Blood Reap, Blood Tap and Crimson Ward with negligible consequence from town. ⚖'
    );
  } else if (rescued === 1) {
    // Tier 4: Dark Leaning (1 Rescued, 3 Sacrificed)
    modifyFaction(engine.worldState, 'townsfolk', -15);
    modifyFaction(engine.worldState, 'temple_standing', -10);
    player.initEnergyModel();
    player.learnSpell('blood_reap');
    player.learnSpell('blood_tap');
    player.learnSpell('crimson_ward');
    player.learnSpell('blood_spear');
    engine.log(
      '☠ A grim harvest. Three innocents perished. You unlock Blood Reap, Blood Tap, Crimson Ward, and Blood Spear. Word of your cold apathy spreads to town. (-15 Townsfolk Standing, -10 Temple Standing, 15% Price Markup) ☠'
    );
  } else {
    // Tier 5: Complete Dark Harvest (0 Rescued, 4 Sacrificed)
    modifyFaction(engine.worldState, 'townsfolk', -30);
    modifyFaction(engine.worldState, 'temple_standing', -25);
    setFlag(engine.worldState, 'blood_tainted_hero', true);
    player.initEnergyModel({ maxVolatileEnergy: 100, volatileEnergy: 50 });
    player.learnSpell('blood_reap');
    player.learnSpell('blood_tap');
    player.learnSpell('crimson_ward');
    player.learnSpell('blood_spear');
    player.learnSpell('exsanguinate');
    engine.log(
      '☠☠☠ THE BLOOD SIPHON IS COMPLETE! All captives were sacrificed, awakening the full Grimoire of Blood Magic in your soul! Bjarnarhaven recoils in horror. (-30 Townsfolk Standing, -25 Temple Standing, 30% Price Markup) ☠☠☠'
    );
  }
}

/** Settles every remaining captive according to the altar option chosen. */
function applyAltarOption(engine: EngineContext, optionId: string): void {
  const remaining = remainingCaptives(engine);
  remaining.forEach((captive, index) => {
    const rescue = optionId === 'rescue_all' || (optionId === 'balance_path' && index < 2);
    if (rescue) {
      rescueCaptiveVillager(engine, captive.id);
    } else {
      sacrificeCaptiveVillager(engine, captive.id);
    }
  });
}

/**
 * Interactive choice for the Siphon Altar tile. The options only narrate; the
 * `SIPHON_RITUAL_HOOK` post-hook settles the remaining captives per option.
 */
export const BLOOD_ALTAR_CHOICE: ChoiceDefinition = {
  id: SIPHON_ALTAR_CHOICE_ID,
  title: 'The Siphon Altar of Járnviðr',
  description:
    'You stand before the ancient obsidian altar. Dark vitriol pools in concentric grooves carved into the stone. The captive villagers are bound at the chamber periphery while warlocks chant unholy rites.',
  options: [
    {
      id: 'rescue_all',
      label: 'Shatter the Siphon — Prioritize Rescuing Every Captive',
      description:
        'Sunder the bindings and teleport every remaining captive to safety. Earns town favor and discounts, but forfeits dark magic.',
      consequences: [
        { type: 'logMessage', message: '✦ You smash the warded runes of the siphon! The warlocks scream in frustration! ✦' },
      ],
    },
    {
      id: 'balance_path',
      label: 'Sever Half the Ties — A Calculated Compromise',
      description:
        'Free two of the remaining captives while the altar claims the rest, and absorb the dark overflow of their sacrifice.',
      consequences: [
        { type: 'logMessage', message: '⚖ You break half the seals, and let the blood currents take the rest. ⚖' },
      ],
    },
    {
      id: 'harvest_all',
      label: 'Channel the Dark Altar — Seize the Full Blood Grimoire',
      description:
        'Let the siphon claim every remaining captive to seize the Grimoire of Blood Magic. Bjarnarhaven will not forgive it.',
      consequences: [
        { type: 'logMessage', message: '☠ You channel the full sacrificial torrent! Unholy vitality floods your veins! ☠' },
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
 * captive. Expiry only flags it: `SIPHON_RITUAL_HOOK` sacrifices whoever remains on
 * the player's next action, so every sacrifice goes through the same code path.
 */
export const SIPHON_TIMED_EVENT: TimedEventDefinition = {
  id: 'siphon_ritual_timer',
  startFlag: FLAG_STARTED,
  turnLimit: 25,
  resolvedFlag: FLAG_TIMER_STOPPED,
  expireConsequences: [
    { type: 'setFlag', flag: FLAG_EXPIRED, value: true },
    { type: 'damagePlayer', amount: 15 },
    {
      type: 'logMessage',
      message:
        '*** Time runs out! The warlocks complete the sacrificial siphon, and a wave of dark blood lashes the chamber (-15 HP)! ***',
    },
  ],
};

function startRitualCountdown(engine: EngineContext): void {
  if (getFlag(engine.worldState, FLAG_STARTED)) {
    return;
  }
  setFlag(engine.worldState, FLAG_STARTED, true);
  engine.log(
    '☠ Chanting echoes from the obsidian chamber — the warlocks have begun the blood siphon! Free the captives before the ritual completes!'
  );
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
    const target = engine.map.getEntityAt(actor.x + action.dx, actor.y + action.dy, actor.planeId);
    if (!(target instanceof NPC) || !isCaptive(target.id)) {
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
 * altar choice resolves, and sacrifices whoever remains once the countdown expires.
 */
const SIPHON_RITUAL_HOOK: ActionHook = {
  id: 'cotw-siphon-ritual',
  phase: 'post',
  actionType: '*',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player || getFlag(engine.worldState, FLAG_RESOLVED)) {
      return;
    }

    if (action instanceof ExecuteChoiceAction && action.choice.id === SIPHON_ALTAR_CHOICE_ID) {
      applyAltarOption(engine, action.optionId);
      return;
    }

    if (getFlag(engine.worldState, FLAG_EXPIRED)) {
      for (const captive of remainingCaptives(engine)) {
        sacrificeCaptiveVillager(engine, captive.id);
      }
      return;
    }

    if (engine.currentFloor === SIPHON_RITUAL_FLOOR) {
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
