import type { GameEngine, ChoiceDefinition, TimedEventDefinition } from '../../engine';
import { getCounter, incrementCounter, setFlag, getFlag, modifyFaction } from '../../engine';
import { NPC } from '../../engine';

export interface HostageVillagerInfo {
  id: string;
  name: string;
  greeting: string;
}

export const HOSTAGE_VILLAGERS: HostageVillagerInfo[] = [
  { id: 'captive_villager_1', name: 'Astrid of the Mill', greeting: 'Please, cut my ropes before they light the pyres!' },
  { id: 'captive_villager_2', name: 'Torstein the Cooper', greeting: 'The dark chanting... it freezes my marrow! Free me!' },
  { id: 'captive_villager_3', name: 'Sigrid the Weaver', greeting: 'May the gods preserve you! Help me escape this nightmare!' },
  { id: 'captive_villager_4', name: 'Young Leif', greeting: 'I have a town recall ward! Just cut my bonds!' },
];

/**
 * Checks if the hostage ritual encounter has concluded and resolves rewards/consequences.
 */
export function checkAndResolveHostageRitual(engine: GameEngine): boolean {
  if (getFlag(engine.worldState, 'siphon_ritual_resolved')) {
    return false;
  }

  const rescued = getCounter(engine.worldState, 'hostages_rescued');
  const sacrificed = getCounter(engine.worldState, 'hostages_sacrificed');
  const totalResolved = rescued + sacrificed;

  // Resolve if all 4 hostages are accounted for
  if (totalResolved >= 4) {
    resolveHostageRitual(engine);
    return true;
  }

  return false;
}

/**
 * Rescues a specific captive NPC when the player interacts with them.
 */
export function rescueCaptiveVillager(engine: GameEngine, captive: NPC): boolean {
  if (getFlag(engine.worldState, `${captive.id}_rescued`) || getFlag(engine.worldState, `${captive.id}_sacrificed`)) {
    return false;
  }

  setFlag(engine.worldState, `${captive.id}_rescued`, true);
  incrementCounter(engine.worldState, 'hostages_rescued', 1);
  engine.removeEntity(captive);

  engine.log(`✨ You cut ${captive.name}'s bonds! They trigger an emergency recall charm and vanish to town! (+1 Rescued)`);

  checkAndResolveHostageRitual(engine);
  return true;
}

/**
 * Sacrifices a specific captive NPC if cultists complete a ritual tick.
 */
export function sacrificeCaptiveVillager(engine: GameEngine, captiveId: string): boolean {
  if (getFlag(engine.worldState, `${captiveId}_rescued`) || getFlag(engine.worldState, `${captiveId}_sacrificed`)) {
    return false;
  }

  const villager = HOSTAGE_VILLAGERS.find((v) => v.id === captiveId);
  const name = villager ? villager.name : 'A captive';

  setFlag(engine.worldState, `${captiveId}_sacrificed`, true);
  incrementCounter(engine.worldState, 'hostages_sacrificed', 1);

  // Remove entity from map if still present
  const entity = engine.map.getEntityById(captiveId);
  if (entity) {
    engine.removeEntity(entity);
  }

  engine.log(`☠ A blood-curse erupts! The warlocks sacrifice ${name} upon the dark stones! (+1 Sacrificed)`);

  checkAndResolveHostageRitual(engine);
  return true;
}

/**
 * Finalizes the moral outcome of the Hostage Ritual encounter.
 */
export function resolveHostageRitual(engine: GameEngine): void {
  if (getFlag(engine.worldState, 'siphon_ritual_resolved')) {
    return;
  }

  setFlag(engine.worldState, 'siphon_ritual_resolved', true);

  const rescued = getCounter(engine.worldState, 'hostages_rescued');

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
    engine.player.initEnergyModel();
    engine.player.learnSpell('blood_reap');
    engine.player.learnSpell('blood_tap');
    engine.log(
      '✦ Three captives escaped to safety. From the single fallen soul, you gleaned the dark rite of Blood Reap. (+15 Townsfolk Standing, Blood Reap Unlocked) ✦'
    );
  } else if (rescued === 2) {
    // Tier 3: The Halfway Path (2 Rescued, 2 Sacrificed)
    // Faction delta is 0 (neutral)
    engine.player.initEnergyModel();
    engine.player.learnSpell('blood_reap');
    engine.player.learnSpell('blood_tap');
    engine.player.learnSpell('crimson_ward');
    engine.log(
      '⚖ A bitter compromise. Two souls escaped, and two fed the dark altar. You unlock Blood Reap and Crimson Ward with negligible consequence from town. ⚖'
    );
  } else if (rescued === 1) {
    // Tier 4: Dark Leaning (1 Rescued, 3 Sacrificed)
    modifyFaction(engine.worldState, 'townsfolk', -15);
    modifyFaction(engine.worldState, 'temple_standing', -10);
    engine.player.initEnergyModel();
    engine.player.learnSpell('blood_reap');
    engine.player.learnSpell('blood_tap');
    engine.player.learnSpell('crimson_ward');
    engine.player.learnSpell('blood_spear');
    engine.log(
      '☠ A grim harvest. Three innocents perished. You unlock Blood Reap, Crimson Ward, and Blood Spear. Word of your cold apathy spreads to town. (-15 Townsfolk Standing, -10 Temple Standing, 15% Price Markup) ☠'
    );
  } else {
    // Tier 5: Complete Dark Harvest (0 Rescued, 4 Sacrificed)
    modifyFaction(engine.worldState, 'townsfolk', -30);
    modifyFaction(engine.worldState, 'temple_standing', -25);
    setFlag(engine.worldState, 'blood_tainted_hero', true);
    engine.player.initEnergyModel({ maxVolatileEnergy: 100, volatileEnergy: 50 });
    engine.player.learnSpell('blood_reap');
    engine.player.learnSpell('blood_tap');
    engine.player.learnSpell('crimson_ward');
    engine.player.learnSpell('blood_spear');
    engine.player.learnSpell('exsanguinate');
    engine.log(
      '☠☠☠ THE BLOOD SIPHON IS COMPLETE! All captives were sacrificed, awakening the full Grimoire of Blood Magic in your soul! Bjarnarhaven recoils in horror. (-30 Townsfolk Standing, -25 Temple Standing, 30% Price Markup) ☠☠☠'
    );
  }
}

/**
 * Interactive Choice Definition for the Siphon Altar tile.
 */
export const BLOOD_ALTAR_CHOICE: ChoiceDefinition = {
  id: 'blood_altar_ritual',
  title: 'The Siphon Altar of Járnviðr',
  description:
    'You stand before the ancient obsidian altar. Dark vitriol pools in concentric grooves carved into the stone. The captive villagers are bound at the chamber periphery while warlocks chant unholy rites.',
  options: [
    {
      id: 'rescue_all',
      label: 'Shatter the Siphon — Prioritize Rescuing Every Captive',
      description:
        'Focus all your efforts on sundering the bindings and teleporting all remaining captives to safety. Secures full town favor and discounts, but forfeits dark magic.',
      consequences: [
        { type: 'setFlag', flag: 'blood_altar_ritual_resolved', value: true },
        { type: 'modifyCounter', counter: 'hostages_rescued', delta: 4 },
        { type: 'modifyFaction', faction: 'townsfolk', delta: 30 },
        { type: 'setFlag', flag: 'savior_of_jarnvidr', value: true },
        {
          type: 'logMessage',
          message:
            '✦ You smash the siphon warded runes! The captives are spirited away to safety, leaving the warlocks screaming in frustration! (+30 Townsfolk Standing) ✦',
        },
      ],
    },
    {
      id: 'balance_path',
      label: 'Sever Half the Ties — A Calculated Compromise',
      description:
        'Free two of the captives while absorbing the lingering dark overflow from the altar. Unlocks Blood Tap & Crimson Ward with negligible consequence from town.',
      consequences: [
        { type: 'setFlag', flag: 'blood_altar_ritual_resolved', value: true },
        { type: 'modifyCounter', counter: 'hostages_rescued', delta: 2 },
        { type: 'modifyCounter', counter: 'hostages_sacrificed', delta: 2 },
        {
          type: 'logMessage',
          message:
            '⚖ You break half the seals, freeing two souls while tapping the blood currents to learn Blood Tap and Crimson Ward! ⚖',
        },
      ],
    },
    {
      id: 'harvest_all',
      label: 'Channel the Dark Altar — Seize the Full Blood Grimoire',
      description:
        'Let the sacrificial siphon complete to claim the full Grimoire of Blood Magic. Suffer a severe town price penalty (-30 Townsfolk Standing).',
      consequences: [
        { type: 'setFlag', flag: 'blood_altar_ritual_resolved', value: true },
        { type: 'modifyCounter', counter: 'hostages_sacrificed', delta: 4 },
        { type: 'modifyFaction', faction: 'townsfolk', delta: -30 },
        { type: 'setFlag', flag: 'blood_tainted_hero', value: true },
        {
          type: 'logMessage',
          message:
            '☠ You channel the full sacrificial torrent! Unholy vitality floods your veins, unlocking all four Blood Magic spells! (-30 Townsfolk Standing) ☠',
        },
      ],
    },
  ],
  cancelable: true,
  cancelLabel: 'Step Away from the Altar',
};

/**
 * Optional timed event if the ritual starts and the player hesitates.
 */
export const SIPHON_TIMED_EVENT: TimedEventDefinition = {
  id: 'siphon_ritual_timer',
  startFlag: 'siphon_ritual_started',
  turnLimit: 25,
  resolvedFlag: 'siphon_ritual_resolved',
  expireConsequences: [
    { type: 'setFlag', flag: 'siphon_ritual_resolved', value: true },
    { type: 'modifyCounter', counter: 'hostages_sacrificed', delta: 4 },
    { type: 'modifyFaction', faction: 'townsfolk', delta: -30 },
    { type: 'damagePlayer', amount: 15 },
    {
      type: 'logMessage',
      message:
        '*** Time runs out! The warlocks finish the sacrificial siphon! A wave of dark blood lashes the chamber (-15 HP), and all four captives perish! ***',
    },
  ],
};
