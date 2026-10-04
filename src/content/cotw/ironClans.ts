import type {
  ActionHook,
  ChoiceDefinition,
  FixedTilePlacement,
  ScriptedVaultNpc,
  SmithDefinition,
  TileDefinition,
} from '../../engine';
import { Monster, NPC, MovementAction, getCounter, getFaction, getFlag, incrementCounter, modifyFaction, setFlag } from '../../engine';

/**
 * The Iron Clans: the duergar of the Abandoned Dwarven Works (floors 10-17), and the
 * hero's grudge with them. The Smithy's Accord (runestones.ts, Floor 14) bound the clans
 * and the giants; Thrym's kin and the troll-wives broke it and drank the forges cold, so
 * the clans start cold toward a hero of Thrym's blood (-15).
 *
 * The hero meets them by reading the Accord or by speaking with Ivalda, the last
 * forge-keeper, by the banked coals of the Dwarven Hearth (Floor 13). Standing is earned
 * by honouring the clan barrows (+5 each, plundering costs 5), laying the
 * Cinder-Gilded Duergar to rest (+2 each, the first six), and breaking the coven's hold
 * on the stolen sun (+10, once). Once trusted (0), the Haugbui barrow-guardians stand aside
 * and Ivalda's masterwork opens at Gunther's forge (one item to +5, once, free:
 * `IVALDA_MASTERWORK`, Q29 + Q48 "A"); at 10 she teaches the Accord's Steam Lance.
 *
 * Once trusted, and once the hero is off Floor 13, Ivalda carries her coals up to
 * Bjarnarhaven and works beside Gunther in the armory, so her forge never asks for a climb
 * back: the Rune of Return always reaches town. A hero who never found the hidden grotto
 * meets her there.
 */

export const IRON_CLANS_FACTION = 'iron_clans';
export const IRON_CLANS_MET_FLAG = 'iron_clans_met';
/** Standing at which the clans trust the hero. */
export const IRON_CLANS_TRUSTED = 0;
const STEAM_LANCE_STANDING = 10;

export const IVALDA_ID = 'npc-ivalda';
const IVALDA_CHOICE_ID = 'ivalda_forge';
const IVALDA_TOWN_CHOICE_ID = 'ivalda_forge_town';
export const IVALDA_IN_TOWN_FLAG = 'ivalda_in_town';
const IVALDA_TEMPERED_FLAG = 'ivalda_tempered';
const DWARVEN_HEARTH_FLOOR = 13;
/** Inside Gunther's Armory (townLayout.ts), beside him. */
export const IVALDA_TOWN_POSITION = { x: 40, y: 6 };

const LAID_TO_REST_COUNTER = 'iron_clans:laid_to_rest';
const LAID_TO_REST_MAX = 6;
const LAID_TO_REST_STANDING = 2;
const SIPHON_CREDIT_FLAG = 'iron_clans_siphon_broken';
const SIPHON_BROKEN_FLAGS = ['oath_resolved', 'savior_of_jarnvidr'];

/** Ivalda, placed at the Dwarven Hearth Grotto's `N` (vaults.ts). */
export const IVALDA: ScriptedVaultNpc = {
  id: IVALDA_ID,
  name: 'Ivalda, the Last Forge-Keeper',
  role: 'villager',
  greeting: 'The coals are banked, not dead. Neither are we.',
  dialogText: 'Honour the barrows. Lay the Cinder-Gilded to rest. Break the siphon. Then we speak of steel.',
  choiceId: IVALDA_CHOICE_ID,
};

const trusted = (standing: number) => ({ type: 'minFaction' as const, faction: IRON_CLANS_FACTION, value: standing });
const notYet = (flag: string) => ({ type: 'hasFlag' as const, flag, value: false });

export const IVALDA_CHOICE: ChoiceDefinition = {
  id: IVALDA_CHOICE_ID,
  title: 'Ivalda, the Last Forge-Keeper',
  description:
    'A white-braided duergar smith sits by the banked coals, a forge-hammer across her knees. Her eyes go to your hands, then to the frost in your veins.\n\n“Thrym’s blood. Your kin swore the Accord with my fathers, and your kin broke it: the troll-wives that drink the stolen sun are giant-get like you, and our forges went cold for their thirst. My clan lies in the barrows of these halls, and the Cinder-Gilded still walk them in their ash.\n\nHonour the barrows; leave their silver. Lay the Cinder-Gilded to rest. Break the siphon. Then we will speak of steel.”',
  options: [
    {
      // Her +5 is worked at Gunther's forge (`IVALDA_MASTERWORK`), where she takes her anvil.
      id: 'temper',
      label: 'Ask her to work your steel',
      description: 'She takes one piece of your steel to +5, once, for nothing: at her anvil in Gunther’s armory.',
      predicate: { type: 'and', predicates: [trusted(IRON_CLANS_TRUSTED), notYet(IVALDA_TEMPERED_FLAG)] },
      disabledReason: 'She puts a hammer to the steel of Thrym’s kin only once the clans trust you, and only once.',
      consequences: [
        {
          type: 'logMessage',
          message: 'Ivalda shakes her head at the banked coals. “Not on these. When you go, I carry them up to Gunther’s armory. Bring me one piece there, at his forge, and I will make it bite stone.”',
        },
      ],
    },
    {
      id: 'steam_lance',
      label: 'Learn the craft of the Accord',
      description: 'Where fire meets ice they fuse into scalding mist: she teaches the Steam Lance.',
      predicate: { type: 'and', predicates: [trusted(STEAM_LANCE_STANDING), notYet('ivalda_taught')] },
      disabledReason: 'The Accord’s craft is for a friend of the clans, not one they merely tolerate.',
      consequences: [
        { type: 'setFlag', flag: 'ivalda_taught', value: true },
        { type: 'recordMilestone', milestoneId: 'forge_friend' },
        { type: 'learnSpell', spellId: 'steam_lance' },
        {
          type: 'logMessage',
          message:
            'Ivalda holds a coal in one hand and rime in the other until the air between them screams. “That is what the Accord was. Keep it better than your kin did.” (Steam Lance)',
        },
      ],
    },
  ],
  cancelable: true,
  cancelLabel: 'Leave her to her coals',
};

/** The same forge at Gunther's armory, where she works once the clans trust the hero: her
 *  masterwork is on his Forge list there, so her own choice keeps only the Accord's craft. */
export const IVALDA_TOWN_CHOICE: ChoiceDefinition = {
  ...IVALDA_CHOICE,
  id: IVALDA_TOWN_CHOICE_ID,
  description:
    'Ivalda has set her own anvil at the back of Gunther’s armory, and the two of them argue about quench-water in two languages. She looks up as you come in.\n\n“You kept faith with our dead, Thrym’s blood or no. The forges below are warming; mine came up to meet the trade your grandfathers kept. Now: steel. Show me the piece across Gunther’s counter, at his forge.”',
  options: IVALDA_CHOICE.options.filter((o) => o.id !== 'temper'),
  cancelLabel: 'Leave her to her anvil',
};

/**
 * Ivalda's masterwork (Q29 "approved", Q48 "A"): one item to +5, once, free, on the Forge list
 * of Gunther's armory once the clans trust the hero and she has brought her anvil up. It
 * replaces her old +2 Attack, and shares its flag: a hero who took that has had their once.
 */
export const IVALDA_MASTERWORK: NonNullable<SmithDefinition['masterwork']> = {
  name: 'Ivalda’s masterwork',
  description: 'One piece of your steel straight to +5, once, for nothing: the clans’ thanks.',
  toLevel: 5,
  predicate: { type: 'and', predicates: [trusted(IRON_CLANS_TRUSTED), { type: 'hasFlag', flag: IVALDA_IN_TOWN_FLAG }] },
  flag: IVALDA_TEMPERED_FLAG,
  message: 'Ivalda heats the steel in her own coals and works it with three hard blows. “Now it will bite stone.” ({item})',
};

/** The clan barrows: one per floor, each its own choice, so each settles on its own. */
const BARROWS = [
  { n: 1, floor: 12, name: 'Barrow of the Bellows-Wardens', dead: 'the wardens of the great bellows' },
  { n: 2, floor: 16, name: 'Barrow of the Gate-Smiths', dead: 'the smiths who hung the gatehouse portcullis' },
  { n: 3, floor: 17, name: 'Barrow of the Accord-Sworn', dead: 'the elders who swore the Smithy’s Accord' },
];

export const IRON_CLANS_BARROW_TILES: TileDefinition[] = BARROWS.map((b) => ({
  type: `duergar_barrow_${b.n}`,
  name: `Duergar ${b.name}`,
  passable: true,
  walkable: true,
  transparent: true,
  visual: 'altar',
  glyph: 'ᛟ',
  description: `A low stone barrow sealed with iron bands, where the clan laid ${b.dead}. Silver glints between the stones.`,
  interactionHandlerId: `duergar_barrow_${b.n}`,
  landmarkLabel: `Duergar Barrow ᛟ`,
}));

export const IRON_CLANS_BARROW_CHOICES: Record<string, ChoiceDefinition> = Object.fromEntries(
  BARROWS.map((b) => {
    const id = `duergar_barrow_${b.n}`;
    const choice: ChoiceDefinition = {
      id,
      title: `The ${b.name}`,
      description: `Iron bands seal a barrow of dressed stone. Here the Iron Clans laid ${b.dead}, with their silver about them. Runes on the capstone ask the passer-by for the rites of the forge-dead, and promise the barrow-wights to anyone who takes what is theirs.`,
      options: [
        {
          id: 'rites',
          label: 'Say the rites and leave the silver',
          description: 'Honour the clan’s dead. +5 Iron Clans standing.',
          consequences: [
            { type: 'setFlag', flag: `${id}_honoured`, value: true },
            { type: 'modifyFaction', faction: IRON_CLANS_FACTION, delta: 5 },
            { type: 'recordMilestone', milestoneId: 'barrow_honoured' },
            {
              type: 'logMessage',
              message: 'You speak the rites over the barrow and leave its silver where it lies. Somewhere in the halls, an anvil rings once. (+5 Iron Clans standing)',
            },
          ],
        },
        {
          id: 'plunder',
          label: 'Plunder the barrow',
          description: 'Break the bands and take the grave-goods. -5 Iron Clans standing, and the dead stir.',
          consequences: [
            { type: 'setFlag', flag: `${id}_plundered`, value: true },
            { type: 'modifyFaction', faction: IRON_CLANS_FACTION, delta: -5 },
            { type: 'grantItem', itemId: 'broadsword', toInventory: true },
            { type: 'alertMonsters', radius: 14 },
            {
              type: 'logMessage',
              message: 'You break the iron bands and drag a broadsword from the dead. A cold wind answers from the barrows. (-5 Iron Clans standing)',
            },
          ],
        },
      ],
      cancelable: true,
      cancelLabel: 'Leave the barrow be',
      resolvedStates: [
        { flag: `${id}_honoured`, message: 'The barrow lies quiet. Its silver is where you left it.' },
        { flag: `${id}_plundered`, message: 'The barrow gapes where you broke it open.' },
      ],
    };
    return [id, choice];
  })
);

export const IRON_CLANS_BARROW_PLACEMENTS: FixedTilePlacement[] = BARROWS.map((b) => ({
  floor: b.floor,
  tileId: `duergar_barrow_${b.n}`,
  placement: 'middle_room_center',
  requiresChoiceId: `duergar_barrow_${b.n}`,
}));

/** Speaking with Ivalda is meeting the clans; the talk itself goes ahead. */
const IVALDA_MET_HOOK: ActionHook = {
  id: 'cotw-iron-clans-met',
  phase: 'pre',
  actionType: 'MovementAction',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player || !(action instanceof MovementAction) || getFlag(engine.worldState, IRON_CLANS_MET_FLAG)) return;
    const target = engine.map.getEntityAt(actor.x + action.dx, actor.y + action.dy, actor.planeId);
    if (target instanceof NPC && target.id === IVALDA_ID) setFlag(engine.worldState, IRON_CLANS_MET_FLAG, true);
  },
};

/**
 * After every action: credits the Cinder-Gilded laid to rest and the siphon broken, and
 * sets the Haugbui on the floor to stand aside for a trusted hero (until one is hurt).
 */
const IRON_CLANS_STANDING_HOOK: ActionHook = {
  id: 'cotw-iron-clans-standing',
  phase: 'post',
  actionType: '*',
  execute: ({ engine }) => {
    const ws = engine.worldState;

    const laid = Math.min(engine.compendium.getEntry('cinder_gilded_duergar').kills, LAID_TO_REST_MAX);
    while (getCounter(ws, LAID_TO_REST_COUNTER) < laid) {
      incrementCounter(ws, LAID_TO_REST_COUNTER, 1);
      modifyFaction(ws, IRON_CLANS_FACTION, LAID_TO_REST_STANDING);
      engine.log(`The ash settles over the Cinder-Gilded. One more of the clan is at rest. (+${LAID_TO_REST_STANDING} Iron Clans standing)`);
    }

    if (!getFlag(ws, SIPHON_CREDIT_FLAG) && SIPHON_BROKEN_FLAGS.some((f) => getFlag(ws, f))) {
      setFlag(ws, SIPHON_CREDIT_FLAG, true);
      modifyFaction(ws, IRON_CLANS_FACTION, 10);
      engine.log('Far above, in the Dwarven Works, a cold forge ticks as warmth returns to its stones. (+10 Iron Clans standing)');
    }

    const isTrusted = getFaction(ws, IRON_CLANS_FACTION) >= IRON_CLANS_TRUSTED;
    moveIvaldaToTown(engine, isTrusted);

    if (engine.currentFloor < 10 || engine.currentFloor > 17) return;
    for (const entity of engine.map.getAllEntities()) {
      if (!(entity instanceof Monster) || entity.definitionId !== 'haugbui' || !entity.isAlive()) continue;
      const standsAside = isTrusted && entity.hp >= entity.maxHp;
      if (standsAside && entity.faction === 'hostile') entity.setFaction('neutral');
      else if (!standsAside && entity.faction === 'neutral') entity.setFaction('hostile');
    }
  },
};

/**
 * Once trusted and off her floor, Ivalda leaves the hearth for town: she is added to the
 * stored town map on the hero's next turn there, and taken off Floor 13 on the next turn
 * there. Not while the hero stands on Floor 13, so she never vanishes mid-visit.
 */
function moveIvaldaToTown(engine: Parameters<ActionHook['execute']>[0]['engine'], isTrusted: boolean): void {
  const ws = engine.worldState;
  if (!getFlag(ws, IVALDA_IN_TOWN_FLAG)) {
    if (!isTrusted || engine.currentFloor === DWARVEN_HEARTH_FLOOR) return;
    setFlag(ws, IVALDA_IN_TOWN_FLAG, true);
    engine.log('Word comes up the mine-shafts: Ivalda, the last forge-keeper of the Iron Clans, has carried her coals to Bjarnarhaven to work beside Gunther in the armory.');
  }
  const here = engine.map.getEntityById(IVALDA_ID);
  if (engine.currentFloor === DWARVEN_HEARTH_FLOOR && here) {
    engine.removeEntity(here);
  } else if (engine.currentFloor === 0 && !here) {
    const { x, y } = IVALDA_TOWN_POSITION;
    if (engine.map.getEntityAt(x, y)) return; // someone is in her spot; next turn
    engine.map.addEntity(new NPC({ ...IVALDA, role: 'villager', position: { x, y }, choiceId: IVALDA_TOWN_CHOICE_ID }));
  }
}

export const IRON_CLANS_HOOKS: ActionHook[] = [IVALDA_MET_HOOK, IRON_CLANS_STANDING_HOOK];
