import type { ActionHook, ChoiceDefinition, NPC, StoryChoiceTrigger } from '../../engine';
import { Monster, getCounter, getFlag, setFlag } from '../../engine';
import { COTW_DEEPEST_FLOOR_COUNTER } from './spellTablets';

/**
 * Story Choice Trigger: fires when Víðnir, Herald of the Wyrm (miniboss on floor 45)
 * is defeated. Immediately surfaces the dying revelation of the herald, explaining
 * the dual-ending stakes of Floor 50 (slaying vs driving off Níðhögg).
 */
export const VIDNIR_DEFEATED_TRIGGER: StoryChoiceTrigger = {
  id: 'vidnir_revelation',
  choiceId: 'vidnir_revelation',
  monsterDefinitionId: 'miniboss_maw_herald',
  killsRequired: 1,
  // No progressStartMessage: with a single required kill it would print at the moment
  // of death, after the herald has already fallen.
};

export const VIDNIR_REVELATION_CHOICE: ChoiceDefinition = {
  id: 'vidnir_revelation',
  title: "The Herald's Dying Prophecy — The Fate of Yggdrasil",
  description:
    'Víðnir, Herald of the Wyrm, collapses upon the bloodied root-rock, clutching the wound where Níðhögg’s shed fang was wrenched from his grip. Black bile froths from his lips as he laughs in agonizing triumph:\n\n“You think you have won, heir of Thrym? You march blindly into the Heartwood at Floor 50, but you know nothing of the Wyrd! Hear the truth before you doom all of Midgard:\n\nNíðhögg has chewed Yggdrasil’s taproot to a splinter. If you strike down the dragon in fury, the shattered root will SPLIT under the shock of its death-throes. The World Tree will fall, and RAGNARÖK will awaken upon Midgard!\n\nThere is only one path to save our world: weaken the dragon until its black heart quails (below 15% health), then hold your blade and DRIVE IT OFF into the abyss! If you let it flee for five turns without dealing the death blow, the living root will hold, and the wound can be sealed!”\n\nThe herald’s head lolls back as life leaves his eyes. The fate of the World Tree rests in your hands.',
  options: [
    {
      id: 'heed_warning',
      label: 'Commit the Warning to Heart — Prepare to Seal the Root',
      description:
        'Resolve to show restraint on Floor 50: weaken Níðhögg below 15% HP and let it flee for 5 turns to seal the root and avert Ragnarök. (+1 Defense)',
      consequences: [
        { type: 'setFlag', flag: 'vidnir_slain', value: true },
        { type: 'setFlag', flag: 'vidnir_warning_heeded', value: true },
        { type: 'modifyPermanentStat', stat: 'defense', delta: 1 },
        {
          type: 'logMessage',
          message:
            '✦ You steel your resolve: on Floor 50, you will weaken Níðhögg below 15% HP and allow it to flee for 5 turns to SEAL the World Root and protect Midgard! (+1 Defense) ✦',
        },
      ],
    },
    {
      id: 'defy_warning',
      label: 'Defy the Prophecy — Prepare to Slay the Dragon',
      description:
        'Refuse to spare the beast: vow to strike Níðhögg dead on Floor 50 regardless of the consequences for the World Root. (+1 Attack)',
      consequences: [
        { type: 'setFlag', flag: 'vidnir_slain', value: true },
        { type: 'setFlag', flag: 'vidnir_warning_defied', value: true },
        { type: 'modifyPermanentStat', stat: 'attack', delta: 1 },
        {
          type: 'logMessage',
          message:
            '✦ You reject the herald’s warning: Níðhögg shall pay with its blood on Floor 50, even if the root splits and Ragnarök stirs! (+1 Attack) ✦',
        },
      ],
    },
  ],
  cancelable: false,
};

/**
 * Floor Band Entry Vignettes: delivers evocative, atmospheric narrative prose upon
 * reaching each of the 7 thematic zones for the first time.
 */
interface ZoneVignette {
  floor: number;
  flag: string;
  message: string;
}

const ZONE_VIGNETTES: ZoneVignette[] = [
  {
    floor: 1,
    flag: 'cotw_vignette_f1',
    message:
      '❄ RIME HOLLOWS — The permafrost crypts bite with unnatural chill, but the blood of Thrym stirs warm in your veins—a dormant giant ember resisting the freeze.',
  },
  {
    floor: 10,
    flag: 'cotw_vignette_f10',
    message:
      '⚒ ABANDONED DWARVEN WORKS — Cold frost gives way to soot and rust. The clang of long-dead forge hammers still echoes through grand duergar halls as your ancestral chill begins to ebb.',
  },
  {
    floor: 18,
    flag: 'cotw_vignette_f18',
    message:
      '🔥 OBSIDIAN SIPHON — Searing heat blasts through volcanic fissures. Glass conduits pulse with radiant sun-chariot fire diverted by the coven into the forge.',
  },
  {
    floor: 26,
    flag: 'cotw_vignette_f26',
    message:
      '🌱 TARNISHED SILVER VEINS — The forge heat vanishes. Rotting timber and caustic mercury pool underfoot. Decades of stolen solar fire have scorched the frost-wards of Yggdrasil—the World Tree is bleeding!',
  },
  {
    floor: 34,
    flag: 'cotw_vignette_f34',
    message:
      '🌳 WORLD-BARK DESCENT — Stone masonry ends completely. You tread upon colossal taproots weeping black sap. Níðhögg’s gnawing shakes the subterranean bedrock.',
  },
  {
    floor: 43,
    flag: 'cotw_vignette_f43',
    message:
      '☠ MAW OF MALICE — You stand at the precipice of Náströnd. Sinuous dragon scales litter the yawning abyss. The Root-Gnawer awaits in the Heartwood below.',
  },
  {
    floor: 50,
    flag: 'cotw_vignette_f50',
    message:
      '⚔ THE HEARTWOOD — Floor 50. The wounded World Tree taproot uncoils before you. Here your saga ends: slay the dragon and unleash Ragnarök, or drive it off to seal the root.',
  },
];

export const COTW_ZONE_VIGNETTES_HOOK: ActionHook = {
  id: 'cotw-zone-vignettes',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player) return;
    const floor = engine.currentFloor;
    const currentZone = [...ZONE_VIGNETTES].reverse().find((v) => floor >= v.floor);
    if (currentZone && !getFlag(engine.worldState, currentZone.flag)) {
      setFlag(engine.worldState, currentZone.flag, true);
      engine.log(currentZone.message);
    }
  },
};

/**
 * Floor 36 Svartr Taunt: when the Taproot Matriarch falls on floor 36, Víðnir's
 * phantom laughter echoes through the root galleries, establishing him as a recurring nemesis.
 *
 * Kill tracking isn't on `EngineContext`, so the hook watches the floor instead: once
 * Svartr has been seen alive there, her absence from the floor means she has fallen.
 */
const SVARTR_ID = 'miniboss_rot_matriarch';
const SVARTR_FLOOR = 36;

export const COTW_SVART_TAUNT_HOOK: ActionHook = {
  id: 'cotw-svartr-taunt',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player) return;
    if (engine.currentFloor !== SVARTR_FLOOR || getFlag(engine.worldState, 'svartr_taunt_seen')) return;
    const svartrAlive = engine.map
      .getAllEntities()
      .some((e) => e instanceof Monster && e.definitionId === SVARTR_ID && e.isAlive());
    if (svartrAlive) {
      setFlag(engine.worldState, 'svartr_encountered', true);
    } else if (getFlag(engine.worldState, 'svartr_encountered')) {
      setFlag(engine.worldState, 'svartr_taunt_seen', true);
      engine.log(
        '*** A spectral silhouette appears atop the root-gallery! Víðnir, Herald of the Wyrm, laughs down at you: "Slay the matriarch if you must, heir of Thrym! Her rot was merely the prelude. Come to the Maw on Floor 45 if you dare meet the dragon’s fang!" ***'
      );
    }
  },
};

/**
 * Reactive Town Dialogue: dynamically updates town NPC greetings and dialogue text
 * whenever the player returns to Bjarnarhaven (floor 0), reflecting depth reached,
 * recovered relics, and moral decisions.
 */
export const COTW_TOWN_REACTIVE_HOOK: ActionHook = {
  id: 'cotw-town-reactive-dialogue',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || engine.currentFloor !== 0) return;

    const deepest = getCounter(engine.worldState, COTW_DEEPEST_FLOOR_COUNTER);
    const hasRelic = getFlag(engine.worldState, 'relic_recovered');
    const isSavior = getFlag(engine.worldState, 'savior_of_jarnvidr');
    const isTainted = getFlag(engine.worldState, 'blood_tainted_hero');
    const vidnirSlain = getFlag(engine.worldState, 'vidnir_slain');

    // Announce the Great Thaw once upon first entering town with the relic
    if (hasRelic && !getFlag(engine.worldState, 'cotw_town_thawed_logged')) {
      setFlag(engine.worldState, 'cotw_town_thawed_logged', true);
      engine.log(
        '✦ THE GREAT THAW! Sól’s warmth returns to Bjarnarhaven! The plaza fountain flows freely, but ominous subterranean tremors shake the village longhouses... ✦'
      );
    }

    const olaf = engine.map.getEntityById('npc-olaf') as NPC | null;
    const gunther = engine.map.getEntityById('npc-gunther') as NPC | null;
    const astrid = engine.map.getEntityById('npc-astrid') as NPC | null;
    const mimir = engine.map.getEntityById('npc-sage') as NPC | null;
    const torvald = engine.map.getEntityById('npc-priest') as NPC | null;

    if (olaf) {
      const o = olaf as unknown as { greeting: string; dialogText: string };
      if (vidnirSlain) {
        o.greeting = 'You broke the Herald Víðnir?! The Heartwood lies open before you!';
        o.dialogText =
          'Remember the herald’s prophecy: slaying Níðhögg in fury may split the root and bring on Ragnarök. Driving it off may seal the wound and save Midgard. We trust your wisdom, Champion!';
      } else if (deepest >= 34) {
        o.greeting = 'Black sap is seeping up into our cellar floors! The roots are bleeding, hero!';
        o.dialogText =
          'You carry the saga of Midgard on your shoulders. Descend to the Heartwood and confront whatever lurks beneath!';
      } else if (hasRelic) {
        o.greeting = 'The Hearth-Tear is restored to our halls! But the bedrock groans beneath us...';
        o.dialogText =
          'The permafrost is melting, but Mimir warns of deep quakes in the mountain roots. We may have saved our village only to face a greater doom.';
      } else if (isSavior) {
        o.greeting = 'Savior of Járnviðr! Every family in Bjarnarhaven sings your praise!';
        o.dialogText =
          'You rescued Astrid, Torstein, Sigrid, and Leif from the sacrificial pyres! Our stores are forever discounted in your honor.';
      } else if (isTainted) {
        o.greeting = 'You... you returned. The dark stench of the blood-siphon clings to you.';
        o.dialogText =
          'Our folk look upon you in dread. Your gold is accepted in our shops, but no skald in Bjarnarhaven will sing of your deeds.';
      } else if (deepest >= 18) {
        o.greeting = 'Our villagers were dragged into the obsidian depths! Save them, champion!';
        o.dialogText =
          'The troll-wives have bound four of our kin at the siphon altar. Cut their bonds before the dark chanting completes!';
      } else if (deepest >= 10) {
        o.greeting = 'You reached the Dwarven Works? Our ancestors traded honey and hides with those halls.';
        o.dialogText =
          'If the duergar forges are cold, what is drawing all the warmth down from above? Stock up and delve deeper.';
      } else if (engine.player.hasDiscoveredRune) {
        o.greeting = 'You carry the Rune of Return! Hope returns to Bjarnarhaven!';
        o.dialogText =
          'With the rune, you can always retreat to our hearth when the depths turn lethal. Stay vigilant, hero.';
      }
    }

    if (gunther) {
      const g = gunther as unknown as { greeting: string; dialogText: string };
      if (vidnirSlain) {
        g.greeting = 'Níðhögg’s fang itself is in your grasp! The final battle draws near.';
        g.dialogText =
          'Whether you slay or seal the beast, strike true. Duergar steel and frost-giant blood will see you through.';
      } else if (hasRelic) {
        g.greeting = 'The forge fire burns hot again without choking on ice! But the anvil vibrates with deep tremors.';
        g.dialogText =
          'Whatever is gnawing at the mountain’s roots below has the strength of mountains. Take our heaviest plate into the World-Bark.';
      } else if (deepest >= 10) {
        g.greeting = 'If you find duergar slag-tongs or forge-tongue hammers, use them well!';
        g.dialogText =
          'Duergar metalcraft was tempered in volcanic ash. It cuts deeper into stone than surface iron ever could.';
      }
    }

    if (astrid) {
      const a = astrid as unknown as { greeting: string; dialogText: string };
      if (vidnirSlain) {
        a.greeting = 'The air from the cellar smells of primordial venom and dragon bile...';
        a.dialogText =
          'Drink deeply of anti-venom and restorative drafts before stepping into the Heartwood. One drop of dragon spit can rot bone in seconds.';
      } else if (hasRelic) {
        a.greeting = 'The herbs in our garden are sprouting through the melted frost!';
        a.dialogText =
          'I have brewed new catch-up rune tablets for your journey into the World-Bark. Prepare yourself against decay.';
      }
    }

    if (mimir) {
      const m = mimir as unknown as { greeting: string; dialogText: string };
      if (vidnirSlain) {
        m.greeting = 'Víðnir spoke truth: Yggdrasil’s taproot is hanging by a splintered thread!';
        m.dialogText =
          'Slaying Níðhögg in fury will shatter the dying root and usher in Ragnarök! But driving it off (below 15% HP for 5 turns) allows the living tree to mend and seals the root. The fate of the age rests on your choice!';
      } else if (hasRelic) {
        m.greeting = 'The mystery unknots itself: diverting the sun’s fire scorched the frost-wards of Yggdrasil!';
        m.dialogText =
          'Níðhögg has awakened in the deep root! It is chewing through the taproot of the world. Reclaiming the sun was only the first chapter—you must save the World Tree!';
      } else if (deepest >= 18) {
        m.greeting = 'The coven’s siphon taps into cosmic chariot fire. Take care not to let their blood rites taint your soul.';
        m.dialogText =
          'Sacrificing innocent lives opens the forbidden Grimoire of Blood Magic, but the gods of Valhalla will turn their faces from you.';
      }
    }

    if (torvald) {
      const t = torvald as unknown as { greeting: string; dialogText: string };
      if (vidnirSlain) {
        t.greeting = 'Thor’s holy thunder attend your final duel in the Heartwood!';
        t.dialogText =
          'May the gods grant you the strength to vanquish evil and the divine wisdom to preserve the World Tree from ruin.';
      } else if (isTainted) {
        t.greeting = 'The stench of sacrificial blood follows you like a shroud...';
        t.dialogText =
          'You chose dark power over innocent lives. Thor’s temple demands heavy tithes from those who harbor blood corruption!';
      } else if (hasRelic) {
        t.greeting = 'Thor’s lightning cleared the blizzard skies, yet the chapel bells ring of their own accord from subterranean quakes.';
        t.dialogText =
          'A primordial dragon walks the roots of Midgard. May holy light guide your steel in the dark below.';
      }
    }
  },
};
