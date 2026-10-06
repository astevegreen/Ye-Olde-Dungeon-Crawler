import type { ChoiceDefinition } from '../../engine';
import { BLOOD_ALTAR_CHOICE } from './hostageRitual';
import { SIPHON_CORE_CHOICE } from './siphonPylon';
import { SKALDIC_RUNESTONE_CHOICES } from './runestones';
import { VIDNIR_REVELATION_CHOICE } from './narrative';
import { IRON_CLANS_BARROW_CHOICES, IVALDA_CHOICE, IVALDA_TOWN_CHOICE } from './ironClans';
import { GATEWARD_CHOICE } from './prologue';
import { COTW_MILESTONE_CHOICES, COTW_SAGA_CHOICES } from './perks';

export const COTW_CHOICES: Record<string, ChoiceDefinition> = {
  /**
   * The Matriarch's Blood-Oath (`oath.ts`): offered on the hero's first move after the
   * Sun-Chariot Warden falls and the Hearth-Tear is in hand, before they can leave the
   * floor. `cancelable: false`: she has waited for this moment, and there is no "ask me
   * later".
   */
  oath_hearth: {
    id: 'oath_hearth',
    title: "The Matriarch's Blood-Oath",
    description:
      "The Sun-Chariot Warden lies still, and the Hearth-Tear burns warm in your hand. From the forge-smoke steps an ancient troll-wife: the coven's matriarch. “Your blood runs with Thrym's own,” she rasps, “as does mine, once. My daughters bound your village to that shard's stolen fire. I can sever the siphon that binds it still — but the choice of how will cost you something lasting. Hot, and you strike harder, your own flesh straining against everything you are. Cold, and you stand firm, as your blood always has.” The forge groans. There is no third door.",
    options: [
      {
        id: 'honor',
        label: 'Honor the Oath — Embrace the Cold',
        description:
          'Stand with your nature. Permanently -2 Attack, +3 Defense. Bonds you with a Frost-Ward Hound.',
        consequences: [
          { type: 'setFlag', flag: 'blood_oath', value: true },
          { type: 'setFlag', flag: 'blood_oath_honored', value: true },
          { type: 'setFlag', flag: 'oath_resolved', value: true },
          { type: 'recordMilestone', milestoneId: 'matriarch_bargain' },
          { type: 'modifyPermanentStat', stat: 'attack', delta: -2 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 3 },
          { type: 'grantCompanion', companionId: 'hearth_frost_hound' },
          {
            type: 'logMessage',
            message:
              'You grip the matriarch’s frost-rimed hand. The siphon shatters like winter glass — the cold in you deepens, steady and sure. A Frost-Ward Hound pads to your side.',
          },
        ],
      },
      {
        id: 'break',
        label: 'Break the Oath — Embrace the Fire',
        description:
          'Fight your own blood. Permanently +3 Attack, -2 Defense. Bonds you with an Ember-Fang Wolf.',
        consequences: [
          { type: 'setFlag', flag: 'blood_oath', value: true },
          { type: 'setFlag', flag: 'blood_oath_broken', value: true },
          { type: 'setFlag', flag: 'oath_resolved', value: true },
          { type: 'recordMilestone', milestoneId: 'matriarch_bargain' },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 3 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: -2 },
          { type: 'grantCompanion', companionId: 'ember_fang_wolf' },
          {
            type: 'logMessage',
            message:
              '\u{1f525} You seize the stolen chariot-fire instead of her hand. It burns — your own giant-blood curdling against the heat — but the siphon breaks all the same. An Ember-Fang Wolf answers the flame. \u{1f525}',
          },
        ],
      },
    ],
    cancelable: false,
  },

  /**
   * Floor 3's defiled altar (`fixedTilePlacements`). Every option settles it for good.
   * The "Altar of Tyr Cleansed" milestone (`tyr_purified`) asks what Tyr gave, a
   * measure of the sword hand, so the oath costs Attack for its Defense and standing;
   * washing is the safe, lesser rite, and leaves the runes dark.
   */
  altar_tyr: {
    id: 'altar_tyr',
    title: 'The Defiled Altar of Tyr',
    description:
      'A weather-worn altar to Tyr, god of oaths and justice. Its carving shows him with his hand in the wolf Fenrir’s jaws: the hand he gave so the gods could bind the wolf. Someone has fouled it with dried blood and gnawed wolf bones, and the runes beneath are dark. Water would lift the filth. Only an oath, sealed with something of your own, will wake the runes.',
    options: [
      {
        id: 'purify',
        label: 'Swear an Oath on Your Sword Hand',
        description:
          'Lay your sword hand on the stone and give Tyr what he gave: a measure of its strength. Cleanses the altar. Permanently -1 Attack and +2 Defense, +15 Temple standing, and haste.',
        consequences: [
          { type: 'setFlag', flag: 'tyr_purified', value: true },
          { type: 'recordMilestone', milestoneId: 'tyr_oath_kept' },
          { type: 'modifyPermanentStat', stat: 'attack', delta: -1 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 2 },
          { type: 'modifyFaction', faction: 'temple_standing', delta: 15 },
          { type: 'applyBuff', statusType: 'haste', duration: 30 },
          {
            type: 'logMessage',
            message:
              'You swear on your sword hand, and the stone drinks a measure of its strength. The runes wake gold and burn the defilement away. Tyr holds your oath (-1 Attack, +2 Defense, +15 Temple standing, Haste).',
          },
        ],
      },
      {
        id: 'wash',
        label: 'Wash the Stone with Water',
        description: 'Scrub away the blood and bones and swear nothing. The runes stay dark for good, but the Temple will hear of it. +5 Temple standing.',
        consequences: [
          { type: 'setFlag', flag: 'tyr_washed', value: true },
          { type: 'modifyFaction', faction: 'temple_standing', delta: 5 },
          {
            type: 'logMessage',
            message:
              'You scrub the altar clean of blood and bones. The runes stay dark: water was never what Tyr asked for (+5 Temple standing).',
          },
        ],
      },
      {
        id: 'desecrate',
        label: 'Desecrate the Altar for Dark Relics',
        description:
          'Shatter the sacred seals to seize the sacrifice dagger. Inflicts 5 backlash damage, -10 Temple standing, and alerts crypt undead.',
        consequences: [
          { type: 'setFlag', flag: 'tyr_desecrated', value: true },
          { type: 'modifyFaction', faction: 'temple_standing', delta: -10 },
          { type: 'grantItem', itemId: 'dagger', toInventory: true },
          { type: 'damagePlayer', amount: 5, cause: "Tyr's wrath" },
          { type: 'alertMonsters', radius: 14 },
          {
            type: 'logMessage',
            message:
              'You smash Tyr’s sacred runes! Arcane backlash wounds you (-5 HP), a dagger is wrenched free, and an unholy wail alerts the crypts (-10 Temple Standing)!',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'tyr_purified',
        message: 'The cleansed Altar of Tyr glows faintly gold. Your oath is kept here.',
      },
      {
        flag: 'tyr_washed',
        message: 'The washed Altar of Tyr is clean, but its runes stay dark.',
      },
      {
        flag: 'tyr_desecrated',
        message: 'The shattered Altar of Tyr lies cold and ruined. Its power is spent.',
      },
    ],
  },

  ...COTW_MILESTONE_CHOICES,
  blood_altar_ritual: BLOOD_ALTAR_CHOICE,
  siphon_core: SIPHON_CORE_CHOICE,
  vidnir_revelation: VIDNIR_REVELATION_CHOICE,
  ...SKALDIC_RUNESTONE_CHOICES,
  ...COTW_SAGA_CHOICES,
  ...IRON_CLANS_BARROW_CHOICES,
  [IVALDA_CHOICE.id]: IVALDA_CHOICE,
  [IVALDA_TOWN_CHOICE.id]: IVALDA_TOWN_CHOICE,
  [GATEWARD_CHOICE.id]: GATEWARD_CHOICE,

  choice_dwarven_hearth: {
    id: 'choice_dwarven_hearth',
    title: 'The Dwarven Hearth',
    description:
      'An ancient iron-banded stone hearth glows with banked embers in this quiet mountain hollow. The roar of the waterfall outside is muted to a steady, rhythmic rush. A kettle sits beside a tin of dried herbs, and soot-carved inscriptions cover the stones.',
    options: [
      {
        id: 'warmth',
        label: 'Rest by the Coals',
        description:
          'Warm your hands over the embers and listen to the water. Grants a moment of deep peace and adds +10 Exploration Renown.',
        // Either may come first: the hearth stays open until both are done.
        keepsOpen: true,
        predicate: { type: 'not', predicate: { type: 'hasFlag', flag: 'dwarven_hearth_rested' } },
        disabledReason: 'You have rested here.',
        consequences: [
          { type: 'setFlag', flag: 'dwarven_hearth_rested', value: true },
          { type: 'recordMilestone', milestoneId: 'dwarven_hearth_rest' },
          {
            type: 'logMessage',
            message:
              'You sit by the steady embers, letting the warmth soak into cold bones. The oppressive weight of the abandoned works recedes.',
          },
        ],
      },
      {
        id: 'read_notes',
        label: 'Read the Wayfarer’s Scratched Notes',
        description: 'Examine the runes carved into the mantle by previous travelers.',
        keepsOpen: true,
        predicate: { type: 'not', predicate: { type: 'hasFlag', flag: 'dwarven_hearth_notes_read' } },
        disabledReason: 'You have read them.',
        consequences: [
          { type: 'setFlag', flag: 'dwarven_hearth_notes_read', value: true },
          { type: 'recordMilestone', milestoneId: 'wayfarer_lore' },
          {
            type: 'logMessage',
            message:
              'WAYFARER’S RUNES: “Beyond the works, where the rock turns black as glass, fire and cold war continuously. The sun-zealots shrug off flame but crack in the frost; the troll-wives laugh at the cold but burn. Carry both.”',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Step Away from the Hearth',
    resolvedStates: [
      {
        when: {
          type: 'and',
          predicates: [
            { type: 'hasFlag', flag: 'dwarven_hearth_rested' },
            { type: 'hasFlag', flag: 'dwarven_hearth_notes_read' },
          ],
        },
        message: 'The banked coals of the Dwarven Hearth still glow with tranquil warmth.',
      },
    ],
  },

  choice_dwarven_spring: {
    id: 'choice_dwarven_spring',
    title: 'Thermal Mountain Spring',
    description:
      'Steam rises softly from a basin of crystal-clear mineral water. The rock beneath your feet is smooth and warm.',
    options: [
      {
        id: 'sip',
        label: 'Drink the Mineral Water',
        description: 'Take a long draught of pure mountain water and let the quiet settle over you.',
        consequences: [
          { type: 'setFlag', flag: 'dwarven_spring_drank', value: true },
          {
            type: 'logMessage',
            message:
              'The water tastes of sweet rain and deep mountain stone. A refreshing calm settles over your senses.',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave the Spring Untouched',
    resolvedStates: [
      {
        flag: 'dwarven_spring_drank',
        message: 'The thermal spring bubbles peacefully in its stone basin.',
      },
    ],
  },

  choice_world_bark_hearth: {
    id: 'choice_world_bark_hearth',
    title: 'The Amber Root Fire',
    description:
      'Deep within a hollow knot of Yggdrasil, a low fire of fragrant peat and golden pine resin crackles quietly. Polished root talismans sway overhead in the gentle breath of the tree.',
    options: [
      {
        id: 'meditate',
        label: 'Meditate in the Heartwood Warmth',
        description:
          'Close your eyes and breathe the sweet resin smoke. Clears blindness and slowness, and adds +10 Exploration Renown.',
        // Either may come first: the hollow stays open until both are done.
        keepsOpen: true,
        predicate: { type: 'not', predicate: { type: 'hasFlag', flag: 'world_bark_hearth_rested' } },
        disabledReason: 'You have meditated here.',
        consequences: [
          { type: 'setFlag', flag: 'world_bark_hearth_rested', value: true },
          { type: 'cureStatus', statusTypes: ['blindness', 'slow'] },
          { type: 'recordMilestone', milestoneId: 'heartwood_rest' },
          {
            type: 'logMessage',
            message:
              'The sweet resin incense steadies your breath. You feel the slow, colossal pulse of the World Tree under your feet, ancient and enduring.',
          },
        ],
      },
      {
        id: 'listen_chimes',
        label: 'Listen to the Swaying Talismans',
        description: 'Interpret the rhythmic clicks of the carved alder charms.',
        keepsOpen: true,
        predicate: { type: 'not', predicate: { type: 'hasFlag', flag: 'world_bark_chimes_listened' } },
        disabledReason: 'You have heard their song.',
        consequences: [
          { type: 'setFlag', flag: 'world_bark_chimes_listened', value: true },
          { type: 'recordMilestone', milestoneId: 'wayfarer_lore' },
          {
            type: 'logMessage',
            message:
              'SONG OF THE ROOTS: “Where the Maw begins, the ancient wyrms sleep lightly. If you do not disturb their hoard, they will often let a quiet traveler pass without rising to strike.”',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave the Hollow Quiet',
    resolvedStates: [
      {
        when: {
          type: 'and',
          predicates: [
            { type: 'hasFlag', flag: 'world_bark_hearth_rested' },
            { type: 'hasFlag', flag: 'world_bark_chimes_listened' },
          ],
        },
        message: 'The amber peat fire burns with quiet, fragrant dignity.',
      },
    ],
  },

  choice_world_bark_font: {
    id: 'choice_world_bark_font',
    title: 'Living Sap Font',
    description:
      'A natural cup in the living wood catches slow, golden drops of pure uncorrupted Yggdrasil sap.',
    options: [
      {
        id: 'taste',
        label: 'Taste the Pure Sap',
        description: 'Take a single drop of golden sap. It hums with vital harmony.',
        consequences: [
          { type: 'setFlag', flag: 'world_bark_sap_tasted', value: true },
          {
            type: 'logMessage',
            message:
              'A taste like wild clover honey and sunlit leaves. The creeping dread of the abyss fades from your heart.',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave the Font',
    resolvedStates: [
      {
        flag: 'world_bark_sap_tasted',
        message: 'The pure sap font gathers golden drops in rhythmic silence.',
      },
    ],
  },

  urdr_pool_choice: {
    id: 'urdr_pool_choice',
    title: "Urðr's Pool — The Well of What Was",
    description:
      'A subterranean basin of silver-sheened water reflects neither the cavern ceiling nor your face, but moments that have already come to pass. In its depths, the face of Urðr—eldest of the Norns—gazes up in solemn appraisal, weighing the lives you chose to spare or sacrifice in the obsidian depths of Midgard.',
    options: [
      {
        id: 'heed_fallen',
        label: 'Kneel and Receive Urðr’s Holy Water',
        description:
          'Urðr honors the four lives pulled from the dark altar. Bestows a vial of Urðr’s Cleansing Water and ends poison, paralysis, slowness, blindness and stunning on you (+15 Exploration Renown).',
        predicate: { type: 'hasFlag', flag: 'savior_of_jarnvidr' },
        disabledReason: 'Urðr turns her face away: you did not save all four innocents from the blood siphon.',
        consequences: [
          { type: 'setFlag', flag: 'urdr_pool_resolved', value: true },
          { type: 'setFlag', flag: 'urdr_pool_blessed', value: true },
          { type: 'recordMilestone', milestoneId: 'urdr_pool_blessing' },
          { type: 'grantItem', itemId: 'urdr_cleansing_water', toInventory: true },
          { type: 'cureStatus', statusTypes: ['poison', 'paralysis', 'slow', 'blindness', 'stunned'] },
          {
            type: 'logMessage',
            message:
              'Urðr smiles gently as sacred holy water fills a crystal vial in your hand, and the afflictions you carried wash away (Urðr’s Cleansing Water).',
          },
        ],
      },
      {
        id: 'gaze_blood',
        label: 'Gaze into the Boiling Blood',
        description:
          'Channel the memory of dark sacrifice: the pool gives up a Draught of Thawed Blood.',
        predicate: { type: 'hasFlag', flag: 'blood_tainted_hero' },
        disabledReason: 'The water remains calm: you did not embrace the full sacrificial rite of the coven.',
        consequences: [
          { type: 'setFlag', flag: 'urdr_pool_resolved', value: true },
          { type: 'setFlag', flag: 'urdr_pool_blood_gazed', value: true },
          { type: 'grantItem', itemId: 'draught_of_thawed_blood', toInventory: true },
          {
            type: 'logMessage',
            message:
              'Crimson froth boils up from the pool and leaves a steaming draught in your hands: the memory of the siphon, made drinkable (Draught of Thawed Blood).',
          },
        ],
      },
      {
        id: 'drink_deep',
        label: 'Drink of the Bitter Deep',
        description:
          'Drink from the icy mineral depths: learn the Clairvoyance spell, and Haste for 30 turns.',
        consequences: [
          { type: 'setFlag', flag: 'urdr_pool_resolved', value: true },
          { type: 'setFlag', flag: 'urdr_pool_drank', value: true },
          { type: 'learnSpell', spellId: 'clairvoyance' },
          { type: 'applyBuff', statusType: 'haste', duration: 30 },
          {
            type: 'logMessage',
            message:
              'You cup your hands and drink of the bitter deep. A flash of silver clarity ignites your mind: you know now how to see the stone and all that moves in it (you learn Clairvoyance; Haste).',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Urðr’s Pool Untouched',
    resolvedStates: [
      {
        flag: 'urdr_pool_blessed',
        message: 'Urðr’s holy pool ripples with tranquil silver light. Her blessing stays with you.',
      },
      {
        flag: 'urdr_pool_blood_gazed',
        message: 'Urðr’s pool smolders with black vitriol. Its dark memory is spent.',
      },
      {
        flag: 'urdr_pool_drank',
        message: 'The icy silver waters of Urðr’s Pool lie still. The clarity of the deep lingers in your mind.',
      },
      {
        flag: 'urdr_pool_resolved',
        message: 'The silver waters of Urðr’s Pool lie still and silent.',
      },
    ],
  },

  verdandi_loom_choice: {
    id: 'verdandi_loom_choice',
    title: "Verðandi's Loom — The Weave of What Is",
    description:
      'Woven between living boughs of the World Tree stands the colossal warp-weighted loom of Verðandi, Norn of the present. Golden sap and blackened fungal rot intertwine on its vertical warp, vibrating with the agony of Yggdrasil. The shuttle hangs suspended before you, awaiting the cut or weave of mortal hands.',
    options: [
      {
        id: 'reinforce_bark',
        label: 'Reinforce the Bark — Weave Living Sap into Plate',
        description: 'Weave the loom’s living sap into a mantle: the Sap-Sealed Cape.',
        consequences: [
          { type: 'setFlag', flag: 'verdandi_loom_resolved', value: true },
          { type: 'setFlag', flag: 'verdandi_bark_woven', value: true },
          { type: 'grantItem', itemId: 'sap_sealed_cape', toInventory: true },
          {
            type: 'logMessage',
            message:
              'You weave the golden sap off the warp into a heavy mantle. It sets as rigid as dragon scale (Sap-Sealed Cape).',
          },
        ],
      },
      {
        id: 'sever_rot',
        label: 'Sever the Rotting Fibers — Excise the Blight',
        description:
          'Cut the diseased wood from the loom: the sound heartwood beneath becomes a blade (Heartwood Longsword), but two Yggdrasil Parasites drop on you.',
        consequences: [
          { type: 'setFlag', flag: 'verdandi_loom_resolved', value: true },
          { type: 'setFlag', flag: 'verdandi_rot_severed', value: true },
          { type: 'grantItem', itemId: 'heartwood_longsword', toInventory: true },
          // The two parasites are spawned by COTW_NORN_CHOICES_HOOK (narrative.ts).
          {
            type: 'logMessage',
            message:
              'Your blade shears the blackened fibers away, and the clean heartwood beneath comes free as a blade in your hand (Heartwood Longsword). Two enraged Yggdrasil Parasites drop from the boughs with venomous hisses!',
          },
        ],
      },
      {
        id: 'listen_loom',
        label: 'Listen to the Loom — Read the Threads of Now',
        description: 'Heed the rhythm of the warp: grants +15 Exploration Renown and haste.',
        consequences: [
          { type: 'setFlag', flag: 'verdandi_loom_resolved', value: true },
          { type: 'setFlag', flag: 'verdandi_loom_listened', value: true },
          { type: 'recordMilestone', milestoneId: 'verdandi_loom_insight' },
          { type: 'applyBuff', statusType: 'haste', duration: 40 },
          {
            type: 'logMessage',
            message:
              'You stand motionless, letting the rhythmic clatter of Verðandi’s shuttle resonate through your heart. The threads show the quickest descent through the roots (+15 Exploration Renown, Haste).',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Step Back from the Loom',
    resolvedStates: [
      {
        flag: 'verdandi_bark_woven',
        message: 'Verðandi’s loom gleams with woven golden bark.',
      },
      {
        flag: 'verdandi_rot_severed',
        message: 'The severed fibers of Verðandi’s loom hang cut and clean.',
      },
      {
        flag: 'verdandi_loom_listened',
        message: 'The threads of Verðandi’s loom vibrate in quiet harmony with your footsteps.',
      },
      {
        flag: 'verdandi_loom_resolved',
        message: 'Verðandi’s loom hums quietly in rhythmic balance.',
      },
    ],
  },

  ratatoskr_roost_choice: {
    id: 'ratatoskr_roost_choice',
    title: 'Roost of Ratatoskr — The Cosmic Gossiper',
    description:
      'A moss-carpeted hollow high inside Yggdrasil’s bark is crammed with glittering river glass, polished bones, and hoarded pine-cones. A rust-red squirrel with razor-sharp claws and an insolent glint in his eye perches on a twisted root, twitching his tail impatiently.\n\n“Well, giant-blood? You bring shiny tribute for Ratatoskr, or do you just stand there looking slow and heavy like that miserable worm downstairs?”',
    options: [
      {
        id: 'offer_tribute',
        label: 'Offer Shiny Tribute — Trade from His Hoard',
        description:
          'Humor the cosmic messenger: he trades from his hoard two scraps of rune-bark that carry you between places as he runs between worlds (Scrolls of Teleportation, +10 Exploration Renown).',
        consequences: [
          { type: 'setFlag', flag: 'ratatoskr_roost_resolved', value: true },
          { type: 'setFlag', flag: 'ratatoskr_slander_mark', value: true },
          { type: 'recordMilestone', milestoneId: 'ratatoskr_favor' },
          { type: 'grantItem', itemId: 'scroll_teleport', toInventory: true },
          { type: 'grantItem', itemId: 'scroll_teleport', toInventory: true },
          {
            type: 'logMessage',
            message:
              'Ratatoskr snatches your offering with a manic chuckle! He flings two scraps of rune-bark at your feet (two Scrolls of Teleportation) and scuttles up the trunk screeching: “Níðhögg’s belly is full of pond-scum! Tell the slug the Eagle spat upon his tail!”',
          },
        ],
      },
      {
        id: 'listen_gossip',
        label: 'Listen to the Cosmic Gossip',
        description:
          'Hear the squirrel’s chatter about the battle between the eagle and the wyrm (+10 Exploration Renown).',
        consequences: [
          { type: 'setFlag', flag: 'ratatoskr_roost_resolved', value: true },
          { type: 'setFlag', flag: 'ratatoskr_gossip_heard', value: true },
          { type: 'recordMilestone', milestoneId: 'ratatoskr_favor' },
          {
            type: 'logMessage',
            message:
              'Ratatoskr leans in and whispers shrilly: “The great eagle at the crown thinks the dragon below is an overgrown slug, and the dragon swears the eagle is chicken-hearted! But mark this, hunter: hit the dragon hard enough, and it turns tail and flees like a whipped cur!” (+10 Exploration Renown)',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave the Squirrel to His Cache',
    resolvedStates: [
      {
        flag: 'ratatoskr_slander_mark',
        message:
          'Ratatoskr chitters smugly from his hollow, admiring his shiny tribute.',
      },
      {
        flag: 'ratatoskr_roost_resolved',
        message: 'Ratatoskr dozes curled around his hoard, ignoring you completely.',
      },
    ],
  },

  skuld_mirror_choice: {
    id: 'skuld_mirror_choice',
    title: "Skuld's Mirror — The Portents of What Shall Be",
    description:
      'A frame of ancient dragon ribs holds a tall slab of polished obsidian on the edge of the Náströnd precipice. The surface of the mirror is liquid and dark as the void. In its depth, Skuld—youngest Norn and chooser of the slain—turns to face you, revealing the portent of the choice you swore to Víðnir on Floor 45.',
    options: [
      {
        id: 'gaze_renewal',
        label: 'Gaze upon the Portent of Renewal (Requires Heeding Víðnir)',
        description:
          'The mirror reflects the living root knitting shut, and teaches the galdr of mending: the Renewal spell (+20 Renown).',
        predicate: { type: 'hasFlag', flag: 'vidnir_warning_heeded' },
        disabledReason: 'The mirror remains shrouded in black mist: you did not commit to driving off the beast.',
        consequences: [
          { type: 'setFlag', flag: 'skuld_mirror_resolved', value: true },
          { type: 'setFlag', flag: 'skuld_aegis_preserver', value: true },
          { type: 'recordMilestone', milestoneId: 'skuld_mirror_gazed' },
          { type: 'learnSpell', spellId: 'renewal' },
          {
            type: 'logMessage',
            message:
              'The obsidian mirror clears to emerald light: green boughs sprout from black dragon-bile, and the taproot heals unbroken. You come away knowing how it was mended (you learn Renewal).',
          },
        ],
      },
      {
        id: 'gaze_ragnarok',
        label: 'Gaze upon the Portent of Ragnarök (Requires Defying Víðnir)',
        description:
          'The mirror reflects flaming skies and broken branches, and teaches the black flame of the corpse-realm: the Hel-Fire spell (+20 Renown).',
        predicate: { type: 'hasFlag', flag: 'vidnir_warning_defied' },
        disabledReason: 'The mirror remains dark: you did not vow to strike down the dragon.',
        consequences: [
          { type: 'setFlag', flag: 'skuld_mirror_resolved', value: true },
          { type: 'setFlag', flag: 'skuld_fury_einherjar', value: true },
          { type: 'recordMilestone', milestoneId: 'skuld_mirror_gazed' },
          { type: 'learnSpell', spellId: 'hel_fire' },
          {
            type: 'logMessage',
            message:
              'The mirror bursts with scarlet fury! A vision of burning skies, shattered shields, and the great wolf breaking free floods your soul. You come away with that black fire in your hands (you learn Hel-Fire).',
          },
        ],
      },
      {
        id: 'gaze_unbound',
        label: 'Peer into the Clouded Void',
        description:
          'Gaze into the uncommitted future before the final descent: Skuld leaves a golden elixir at the mirror’s foot (Supreme Health Potion, +20 Renown).',
        predicate: {
          type: 'not',
          predicate: {
            type: 'or',
            predicates: [
              { type: 'hasFlag', flag: 'vidnir_warning_heeded' },
              { type: 'hasFlag', flag: 'vidnir_warning_defied' },
            ],
          },
        },
        disabledReason: 'You have already bound your fate to Víðnir’s prophecy.',
        consequences: [
          { type: 'setFlag', flag: 'skuld_mirror_resolved', value: true },
          { type: 'recordMilestone', milestoneId: 'skuld_mirror_gazed' },
          { type: 'grantItem', itemId: 'supreme_health_potion', toInventory: true },
          {
            type: 'logMessage',
            message:
              'The mirror reveals a tempest of swirling shadow and huge coils in the deep. At its foot a golden elixir waits for whatever trial comes on Floor 50 (Supreme Health Potion).',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Step Away from Skuld’s Mirror',
    resolvedStates: [
      {
        flag: 'skuld_aegis_preserver',
        message: 'Skuld’s mirror glows with serene emerald light. The portent of renewal shields your soul.',
      },
      {
        flag: 'skuld_fury_einherjar',
        message: 'Skuld’s mirror smolders with fiery embers. The fury of the Einherjar burns within your heart.',
      },
      {
        flag: 'skuld_mirror_resolved',
        message: 'The dark obsidian of Skuld’s mirror stands quiet and cold.',
      },
    ],
  },

  /**
   * The captives freed from the Siphon Altar, home in Bjarnarhaven (`populateReturnedCaptives`,
   * hostageRitual.ts): the first of them keeps a kettle on for the hero, a flask a delve.
   */
  choice_returned_broth: {
    id: 'choice_returned_broth',
    title: 'A Kettle by the Hearth',
    description:
      'The villager you cut loose from the Siphon Altar has a kettle of hearth broth simmering over the coals.\n\n“You brought us home from the pyres of Járnviðr. Whenever you go back down, take a flask with you.”',
    options: [
      {
        id: 'hot_broth',
        label: 'Accept a flask of hearth broth',
        description: 'A Hearth-Broth Flask for this delve; another the next time you come home from the dungeon.',
        predicate: { type: 'not', predicate: { type: 'hasFlag', flag: 'returned_broth_claimed' } },
        disabledReason: 'You already have this delve’s flask.',
        keepsOpen: true,
        consequences: [
          { type: 'setFlag', flag: 'returned_broth_claimed', value: true },
          { type: 'grantItem', itemId: 'hearth_broth_flask', toInventory: true },
          { type: 'logMessage', message: 'A steaming flask of hearth broth is pressed into your hands.' },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Not now',
  },
};


