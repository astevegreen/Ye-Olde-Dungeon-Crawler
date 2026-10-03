import type {
  ActionHook,
  ChoiceDefinition,
  EngineContext,
  ObjectiveDefinition,
  PrologueDefinition,
  PrologueNpc,
  TimedEventDefinition,
} from '../../engine';
import {
  ExecuteChoiceAction,
  ItemFactory,
  Monster,
  MovementAction,
  NPC,
  concludePrologue,
  getCounter,
  getFlag,
  incrementCounter,
  isPrologueRunning,
  modifyFaction,
  setFlag,
} from '../../engine';
import { makeLootItem } from './items/makeItem';

/**
 * The night the hearth went cold (`manifest.prologue`, docs/architecture/content-quests-and-triggers.md):
 * a new hero comes home from the hunt to find the troll-wife coven in Bjarnarhaven, prying
 * the Hearth-Tear out of the plaza fountain while their thralls hold three villagers. The
 * hero frees whom they can before the countdown runs out and the coven sinks down the
 * cellar stairs with the shard, which is where the run proper goes next. Then the dying
 * gate-ward, Hallvard, tells them what was taken and where.
 *
 * It teaches without a word of tutorial: walking and bump-fighting thralls, drinking when
 * hurt (the hero cannot die here, but is struck down at 1 HP and loses whoever is still
 * held), shooting a fleeing rime-wolf or a channelling warlock with Magic Arrow, picking
 * up the gift a freed villager drops. Each villager freed raises the townsfolk's standing,
 * so saving all three lowers Bjarnarhaven's prices for the run (`merchantPricing`), and
 * each one's kin remembers it. Freeing none costs nothing.
 *
 * Staged on the real town map (owner's choice, 2026-10-02), so it teaches the town too.
 */

export const PROLOGUE_STARTED_FLAG = 'cotw_prologue_started';
export const PROLOGUE_ENDED_FLAG = 'cotw_prologue_ended';
const FLAG_COVEN_FLED = 'cotw_prologue_coven_fled';
/** Stops the countdown: set by its own expiry, or when the raid ends early (the hero struck down). */
const FLAG_COUNTDOWN_STOPPED = 'cotw_prologue_countdown_stopped';
const FLAG_STRUCK_DOWN = 'cotw_prologue_struck_down';
const FLAG_SAW_COVEN = 'cotw_prologue_saw_coven';
export const GATEWARD_HEARD_FLAG = 'cotw_prologue_gateward_heard';
const COUNTER_SAVED = 'cotw_prologue_villagers_saved';
const GATEWARD_CHOICE_ID = 'cotw_prologue_last_words';
const GATEWARD_ID = 'prologue-hallvard';

/** Townsfolk standing for each villager freed: all three take it from 10 to the 20 discount tier. */
const STANDING_PER_VILLAGER = 4;
/** Turns the coven needs to pry the Hearth-Tear loose: enough to free all three with no wasted step. */
const RAID_TURNS = 60;
const FOUNTAIN = { x: 28, y: 18 };
const FOUNTAIN_NOTICE_RADIUS = 7;

interface Villager extends PrologueNpc {
  /** Whose kin they are, for the line logged when they are taken. */
  kin: string;
  /** Logged as they run free; they drop `gift` where they stood. */
  freedMessage: string;
  gift: { itemId: string } | { gold: number };
}

export const PROLOGUE_VILLAGERS: Villager[] = [
  {
    id: 'prologue-eir',
    name: 'Eir the Acolyte',
    kin: "the temple's acolyte",
    position: { x: 27, y: 24 },
    greeting: 'The thrall has me by the hair! Get it off me!',
    freedMessage: 'Eir scrambles up and runs for the longhouse. "Take it, it is all I have!" Her broth-flask lies in the snow.',
    gift: { itemId: 'hearth_broth_flask' },
  },
  {
    id: 'prologue-sigrun',
    name: 'Sigrun, Olaf’s Daughter',
    kin: "Olaf's daughter",
    position: { x: 12, y: 13 },
    greeting: 'Father barred the door with me still outside! Help me!',
    freedMessage: 'Sigrun bolts for the longhouse, flinging back her purse: "Father would want you to have it!"',
    gift: { gold: 20 },
  },
  {
    id: 'prologue-brandr',
    name: 'Brandr the Apprentice',
    kin: "Gunther's apprentice",
    position: { x: 42, y: 12 },
    greeting: 'I only came out for the forge chisel. Now look at me.',
    freedMessage: 'Brandr runs for the longhouse and drops his forge chisel at your feet. "Keep it. Gunther will forge me another."',
    gift: { itemId: 'rime_bit_chisel' },
  },
];

/** The townsfolk out in the lanes that night, who have no time for trade or talk. */
const RAID_LINES: Record<string, string> = {
  'npc-guard': 'Bjorn leans on his spear, bleeding through his mail. “I can’t hold them alone. Get the folk clear!”',
  'npc-trainer': 'Ranvild has her hounds by the scruff. “They’d run straight at the witches. Go, I’ll keep them back!”',
};
const RAID_LINE_DEFAULT = 'There is no time to talk. The coven is at the fountain.';

const villagerFor = (id: string) => PROLOGUE_VILLAGERS.find((v) => v.id === id);
const savedFlag = (id: string) => `${id}_saved`;
const takenFlag = (id: string) => `${id}_taken`;
const isAccountedFor = (ctx: EngineContext, id: string) =>
  getFlag(ctx.worldState, savedFlag(id)) || getFlag(ctx.worldState, takenFlag(id));

/** Whether the villager was freed in this run's prologue. */
export function prologueVillagerSaved(ctx: EngineContext, id: 'prologue-eir' | 'prologue-sigrun' | 'prologue-brandr'): boolean {
  return getFlag(ctx.worldState, savedFlag(id));
}

export const COTW_PROLOGUE: PrologueDefinition = {
  playerSpawn: { x: 22, y: 33 },
  startFlag: PROLOGUE_STARTED_FLAG,
  endFlag: PROLOGUE_ENDED_FLAG,
  dark: true,
  heroHpFloor: 1,
  openingMessage:
    'Night, and the wind off the pines carries smoke. You are home from the hunt at last, but Bjarnarhaven is screaming. Shapes move between the houses, and in the plaza something cold is chanting.',
  closingMessage:
    'Grey dawn comes up over a village gone silent. The fountain is ice, and every hearth burns low and blue. Hallvard the gate-ward lies by the cellar stairs.',
  monsters: [
    { definitionId: 'prologue_rime_wolf', position: { x: 22, y: 29 } },
    // Each villager's captor, a step away from them.
    { definitionId: 'prologue_coven_thrall', position: { x: 28, y: 23 } },
    { definitionId: 'prologue_coven_thrall', position: { x: 13, y: 14 } },
    { definitionId: 'prologue_coven_thrall', position: { x: 43, y: 13 } },
    { definitionId: 'prologue_rime_wolf', position: { x: 41, y: 14 } },
    // The coven at the fountain, and one thrall keeping the plaza.
    { definitionId: 'prologue_coven_warlock', position: { x: 27, y: 18 } },
    { definitionId: 'prologue_coven_warlock', position: { x: 30, y: 19 } },
    { definitionId: 'prologue_coven_thrall', position: { x: 25, y: 20 } },
  ],
  npcs: PROLOGUE_VILLAGERS.map(({ id, name, position, greeting }) => ({ id, name, position, greeting })),
  aftermathNpcs: [
    { id: GATEWARD_ID, name: 'Hallvard the Gate-Ward', role: 'guard', position: { x: 31, y: 9 }, choiceId: GATEWARD_CHOICE_ID },
  ],
};

/** The coven's rite: when it runs out they flee with the shard, taking whoever is still held. */
export const PROLOGUE_TIMED_EVENT: TimedEventDefinition = {
  id: 'cotw_prologue_raid',
  startFlag: PROLOGUE_STARTED_FLAG,
  turnLimit: RAID_TURNS,
  resolvedFlag: FLAG_COUNTDOWN_STOPPED,
  label: 'Coven’s rite',
  expireConsequences: [{ type: 'setFlag', flag: FLAG_COVEN_FLED, value: true }],
};

/** Hallvard's last words: what was taken, where it went, and where to go first. */
export const GATEWARD_CHOICE: ChoiceDefinition = {
  id: GATEWARD_CHOICE_ID,
  title: 'Hallvard the Gate-Ward',
  description:
    'Hallvard sits against the cellar wall, frost creeping across his mail. He finds your hand.\n\n' +
    '“You came back. Late, but you came. Listen. Those were troll-wives, witches out of the Ironwood, and they came for the Hearth-Tear. A shard of Sól’s own sun-chariot. It has kept this valley warm through every winter since before my grandfather’s grandfather. Without it the cold will not stop. Not at the fountain. Not at any hearth.\n\n' +
    'They took it down the cellar. That is the old way into the duergar halls under the mountain, and nobody has gone down there in a hundred years.\n\n' +
    'Go to Olaf, to Gunther, to Astrid. Spend what you have on what will keep you breathing. Torvald’s temple mends what the dark does to a body. Then go down after it. Bring it…”\n\n' +
    'His hand falls from yours.',
  options: [
    {
      id: 'close_his_eyes',
      label: 'Close his eyes',
      consequences: [
        { type: 'setFlag', flag: GATEWARD_HEARD_FLAG, value: true },
        { type: 'logMessage', message: 'You close Hallvard’s eyes. Below the cellar stairs, the dark breathes cold.' },
      ],
    },
  ],
  cancelable: true,
  cancelLabel: 'Step back',
};

/** The prologue's lines in the HUD objective, ahead of the run's own (objectives.ts). */
export const PROLOGUE_OBJECTIVES: ObjectiveDefinition[] = [
  {
    id: 'cotw_objective_prologue_raid',
    text: 'Raiders in Bjarnarhaven! Free the villagers their thralls hold before the coven is done.',
    availableWhenFlag: PROLOGUE_STARTED_FLAG,
    doneWhenAnyFlag: [PROLOGUE_ENDED_FLAG],
  },
  {
    id: 'cotw_objective_prologue_gateward',
    text: 'Hallvard the gate-ward lies by the cellar stairs. Go to him.',
    availableWhenFlag: PROLOGUE_ENDED_FLAG,
    doneWhenAnyFlag: [GATEWARD_HEARD_FLAG],
  },
];

function dropGift(ctx: EngineContext, villager: Villager, x: number, y: number): void {
  const id = `${villager.id}-gift`;
  const item = 'gold' in villager.gift
    ? ItemFactory.createGoldCoins(id, villager.gift.gold)
    : makeLootItem(villager.gift.itemId, id, ctx.rng);
  ctx.map.addItemAt(x, y, item);
}

function freeVillager(ctx: EngineContext, npc: NPC): void {
  const villager = villagerFor(npc.id);
  if (!villager || isAccountedFor(ctx, villager.id)) return;
  setFlag(ctx.worldState, savedFlag(villager.id), true);
  incrementCounter(ctx.worldState, COUNTER_SAVED, 1);
  modifyFaction(ctx.worldState, 'townsfolk', STANDING_PER_VILLAGER);
  const { x, y } = npc;
  ctx.removeEntity(npc);
  dropGift(ctx, villager, x, y);
  ctx.log(villager.freedMessage);
}

/** Their thrall still at their side, if any: it has to be dealt with first. */
function captorBeside(ctx: EngineContext, npc: NPC): Monster | undefined {
  return ctx.map
    .getAllEntities()
    .find(
      (e): e is Monster =>
        e instanceof Monster &&
        e.isAlive() &&
        e.faction !== 'player' &&
        Math.max(Math.abs(e.x - npc.x), Math.abs(e.y - npc.y)) <= 1
    );
}

/**
 * Ends the raid, once: whoever is still held is dragged down after the coven, the
 * prologue concludes (dawn, the gate-ward), and the hero wakes mended.
 */
function endRaid(ctx: EngineContext): void {
  if (!isPrologueRunning(ctx.worldState, COTW_PROLOGUE)) return;
  const struckDown = getFlag(ctx.worldState, FLAG_STRUCK_DOWN);
  setFlag(ctx.worldState, FLAG_COUNTDOWN_STOPPED, true);
  ctx.log(
    struckDown
      ? 'A blow takes you off your feet. The snow is very cold, and then there is nothing.'
      : 'The chant breaks off. The troll-wives sink down the cellar stairs with the Hearth-Tear blazing between them, and their thralls melt into the dark after them.'
  );
  for (const villager of PROLOGUE_VILLAGERS) {
    if (isAccountedFor(ctx, villager.id)) continue;
    setFlag(ctx.worldState, takenFlag(villager.id), true);
    const npc = ctx.map.getEntityById(villager.id);
    if (npc) ctx.removeEntity(npc);
    ctx.log(`They drag ${villager.name.split(',')[0]}, ${villager.kin}, down into the dark.`);
  }
  concludePrologue(ctx, COTW_PROLOGUE, true);
  ctx.player.heal(ctx.player.maxHp);
  ctx.player.restoreMana(ctx.player.maxMana);
  const saved = getCounter(ctx.worldState, COUNTER_SAVED);
  ctx.log(
    saved === PROLOGUE_VILLAGERS.length
      ? 'Every villager the thralls held is safe in the longhouse. Bjarnarhaven will not forget it.'
      : saved > 0
        ? `${saved} of the ${PROLOGUE_VILLAGERS.length} the thralls held are safe in the longhouse.`
        : struckDown
          ? 'You wake where you fell, someone’s cloak thrown over you, your wounds bound.'
          : 'None of the villagers the thralls held came home.'
  );
}

/**
 * Bumping a held villager frees them, unless their thrall still stands beside them. While
 * the raid lasts the houses are barred, the cellar sealed by the coven's rite, and the folk
 * out in the lanes have no time for trade, so the night plays out in the lanes.
 */
const PROLOGUE_MOVE_HOOK: ActionHook = {
  id: 'cotw-prologue-move',
  phase: 'pre',
  actionType: 'MovementAction',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player || !(action instanceof MovementAction)) return;
    if (!isPrologueRunning(engine.worldState, COTW_PROLOGUE)) return;
    const x = actor.x + action.dx;
    const y = actor.y + action.dy;

    const target = engine.map.getEntityAt(x, y, actor.planeId);
    if (target instanceof NPC && villagerFor(target.id)) {
      const captor = captorBeside(engine, target);
      if (captor) {
        return { proceed: false, result: { success: false, cost: 0, message: `The ${captor.name} stands over ${target.name}. Strike it down first!` } };
      }
      freeVillager(engine, target);
      return { proceed: false, result: { success: true, cost: 0, message: `You free ${target.name}.` } };
    }
    if (target instanceof NPC) {
      return { proceed: false, result: { success: false, cost: 0, message: RAID_LINES[target.id] ?? RAID_LINE_DEFAULT } };
    }

    const tile = engine.map.getTile(x, y);
    if (engine.currentFloor === 0 && (tile?.isClosedDoor || tile?.isOpenDoor)) {
      return { proceed: false, result: { success: false, cost: 0, message: 'The door is barred from within.' } };
    }
  },
};

const PROLOGUE_STAIRS_HOOK: ActionHook = {
  id: 'cotw-prologue-stairs',
  phase: 'pre',
  actionType: 'ClimbStairsAction',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || !isPrologueRunning(engine.worldState, COTW_PROLOGUE)) return;
    return { proceed: false, result: { success: false, cost: 0, message: 'The coven’s rite holds the cellar mouth shut with black frost.' } };
  },
};

/**
 * Runs the raid after every action, the monsters' too (a struck-down hero is noticed on
 * the blow that does it): the coven's first sight, the hero struck down, the countdown
 * run out; then Hallvard's death once his last words are heard.
 */
const PROLOGUE_RAID_HOOK: ActionHook = {
  id: 'cotw-prologue-raid',
  phase: 'post',
  actionType: '*',
  execute: ({ action, actor, engine }) => {
    if (action instanceof ExecuteChoiceAction && action.choice.id === GATEWARD_CHOICE_ID && getFlag(engine.worldState, GATEWARD_HEARD_FLAG)) {
      const hallvard = engine.map.getEntityById(GATEWARD_ID);
      if (hallvard) engine.removeEntity(hallvard);
      return;
    }
    if (!isPrologueRunning(engine.worldState, COTW_PROLOGUE)) {
      // Ended some other way (the F2 triage menu): the countdown stops with it.
      if (getFlag(engine.worldState, PROLOGUE_ENDED_FLAG)) setFlag(engine.worldState, FLAG_COUNTDOWN_STOPPED, true);
      return;
    }

    if (engine.player.wasHeldAtHpFloor) {
      setFlag(engine.worldState, FLAG_STRUCK_DOWN, true);
      endRaid(engine);
      return;
    }
    if (getFlag(engine.worldState, FLAG_COVEN_FLED)) {
      endRaid(engine);
      return;
    }
    if (actor !== engine.player || getFlag(engine.worldState, FLAG_SAW_COVEN)) return;
    const p = engine.player;
    if (Math.max(Math.abs(p.x - FOUNTAIN.x), Math.abs(p.y - FOUNTAIN.y)) <= FOUNTAIN_NOTICE_RADIUS) {
      setFlag(engine.worldState, FLAG_SAW_COVEN, true);
      engine.log('At the fountain two troll-wives pry at the Hearth-Tear with frost-black fingers. Every hearth in the village gutters as it moves.');
    }
  },
};

export const PROLOGUE_HOOKS: ActionHook[] = [PROLOGUE_MOVE_HOOK, PROLOGUE_STAIRS_HOOK, PROLOGUE_RAID_HOOK];
