import type { ActionHook, EngineContext } from '../../engine';
import { NPC, getCounter, getFlag, isPrologueRunning, setFlag } from '../../engine';
import { HOSTAGE_VILLAGERS, captiveIdentity, captiveRescued, listNames, ritualOutcome } from './hostageRitual';
import { COTW_PROLOGUE, PROLOGUE_VILLAGERS, prologueVillagerSaved, type RaidVillagerId } from './prologue';
import { COTW_DEEPEST_FLOOR_COUNTER } from './spellTablets';
import { RELIC_RECOVERED_FLAG } from './relic';

/**
 * Everyone the hero saves comes home to Bjarnarhaven and stays there: the three villagers freed
 * in the night raid (prologue.ts) from the dawn after it, and each captive cut loose at the
 * Siphon Altar (hostageRitual.ts) from the hero's next visit. What they say follows the descent
 * (`homeStage`), and a town saved before they came home gains them on its next turn.
 */

/** How far the story has gone, as the town hears it: the deepest floor, the altar, the relic, the herald. */
type HomeStage = 'home' | 'works' | 'siphon' | 'altar' | 'mourning' | 'thaw' | 'roots' | 'herald';

interface Line {
  greeting: string;
  says: string;
}

interface Homecomer {
  /** Spoken while the altar is still burning or just behind them, by one who came home from it. */
  cameHome: Line;
  /** By stage; a stage left out falls back to `cameHome`. */
  lines: Partial<Record<HomeStage, Line>>;
}

function homeStage(engine: EngineContext): HomeStage {
  const ws = engine.worldState;
  if (getFlag(ws, 'vidnir_slain')) return 'herald';
  const deepest = getCounter(ws, COTW_DEEPEST_FLOOR_COUNTER);
  if (deepest >= 34) return 'roots';
  if (getFlag(ws, RELIC_RECOVERED_FLAG)) return 'thaw';
  const outcome = ritualOutcome(engine);
  if (outcome === 'all_home') return 'altar';
  if (outcome === 'some_lost') return 'mourning';
  if (deepest >= 18) return 'siphon';
  if (deepest >= 10) return 'works';
  return 'home';
}

/**
 * What each of them says, keyed by the sprite they wear (a raid villager's id, else the
 * captive's). The raid's three have a line for every stage, since they are home from the start.
 */
const HOMECOMERS: Record<RaidVillagerId | string, Homecomer> = {
  'prologue-eir': {
    cameHome: {
      greeting: 'You found me in the black glass. I can still smell the pyres.',
      says: 'Father Torvald says I slept two days after the recall ward brought me home. Now I tend the others who came back. It is a better use for my hands than shaking.',
    },
    lines: {
      home: {
        greeting: 'Thor keep you. Sit, and let me see those cuts.',
        says: 'Father Torvald lets me tend the hurt ones here. The cold below gets into a wound and stays there; come to me before it festers.',
      },
      works: {
        greeting: 'Dwarf-soot on your cloak? You have been to the Works.',
        says: 'Mimir says the duergar fires went out long before ours did. Something down there drinks warmth. Keep your broth hot and your feet dry.',
      },
      siphon: {
        greeting: 'Are they the same troll-wives who held me?',
        says: 'They say folk are bound at an altar down in the black glass. I pray for them every night. Pray for them with your blade.',
      },
      altar: {
        greeting: 'Four more hearths lit tonight, because of you.',
        says: 'The ones you brought back from the altar sleep by our fire now. No one in Bjarnarhaven goes cold while I keep this kettle on.',
      },
      mourning: {
        greeting: 'I light candles for the ones the altar kept.',
        says: 'Not everyone came home from the black glass. Father Torvald says the gods count the ones we try to save. I hope he is right.',
      },
      thaw: {
        greeting: 'The fountain runs! I washed my hands in it this morning.',
        says: 'The Hearth-Tear warms the whole valley again. But the temple floor shivers at night, as if something below is turning over in its sleep.',
      },
      roots: {
        greeting: 'There is black sap on the temple steps.',
        says: 'It weeps up through the stone and smells of rot and old wood. Father Torvald burns it off with holy oil. Whatever bleeds it, you are going down to it.',
      },
      herald: {
        greeting: 'They say you broke the herald.',
        says: 'I am only an acolyte, and I cannot tell you what to do at the root. Only this: whatever you choose down there, come back up these steps.',
      },
    },
  },
  'prologue-sigrun': {
    cameHome: {
      greeting: 'I told Father I was coming. He did not believe it till I walked in.',
      says: 'All that time in the black glass, and he still blames himself for barring the door that night. I have forgiven him. I do not think he has forgiven himself.',
    },
    lines: {
      home: {
        greeting: 'Father will not let me out of his sight now.',
        says: 'He barred the door with me outside, and now he cannot look at me without weeping. So I mind the counter and let him mind the stores. Buy something; it cheers him.',
      },
      works: {
        greeting: 'Bjorn has been teaching me the spear. Do not tell Father.',
        says: 'If those things come up the cellar stairs again, I will not stand in the snow waiting to be saved. Tell me about the dwarf-halls. I want to know what we face.',
      },
      siphon: {
        greeting: 'Father says our folk are bound at a fire-altar down there.',
        says: 'Some nights he stands at the cellar door and shouts down it. It could have been me down there. Go and get them. Please.',
      },
      altar: {
        greeting: 'Every one of them home! Father opened a cask for it.',
        says: 'The whole longhouse sang till dawn. Father says your coin is no good here any more. He does not mean it, but he means it kindly.',
      },
      mourning: {
        greeting: 'Not all of them came back.',
        says: 'Father keeps their places set at the long table. I have stopped asking him to clear them.',
      },
      thaw: {
        greeting: 'The snow is sliding off the roof for the first time in a year!',
        says: 'Nobody buys candles now the warmth is back, and Father does not mind one bit. But the shelves rattle at night, and Bjorn says the ground has not shaken like this in living memory.',
      },
      roots: {
        greeting: 'Black sap came up through our cellar floor.',
        says: 'It ate through a sack of barley overnight. Father wants to wall up the cellar. I told him you are still down there, so he cannot.',
      },
      herald: {
        greeting: 'They say you have gone as deep as the world goes.',
        says: 'Bjorn says the wyrm has gnawed at that root since the world was young. I do not care how long. Come back, and let me hear the story from you.',
      },
    },
  },
  'prologue-brandr': {
    cameHome: {
      greeting: 'Home, and Gunther finally paid up that chisel.',
      says: 'The troll-wives had me hauling slag for their altar fires. I know the heat down there now. Gunther says it made me a better smith. I would rather have stayed a worse one.',
    },
    lines: {
      home: {
        greeting: 'Gunther forged me a new chisel. Keep the old one sharp.',
        says: 'The rime-bit holds its edge in any cold. If you find good frost-iron in the Hollows, bring it up and show me.',
      },
      works: {
        greeting: 'Duergar steel! Did you see their forges?',
        says: 'Gunther says duergar smiths quench their blades in ash. I would give a year’s wages to stand at one of their anvils, even a cold one.',
      },
      siphon: {
        greeting: 'Fire-witches, and an altar of black glass.',
        says: 'Gunther has me beating out arrowheads day and night. If you find the folk they have bound down there, cut them loose. I would go myself, if he would let me.',
      },
      altar: {
        greeting: 'All four home! Gunther gave me the day off, my first in a year.',
        says: 'I forged a horseshoe for each of their doors, for luck. Nobody has needed luck in this village more.',
      },
      mourning: {
        greeting: 'Gunther says not to ask about the altar.',
        says: 'So I do not ask. I work the bellows harder instead.',
      },
      thaw: {
        greeting: 'The forge draws properly again!',
        says: 'No more ice in the quench barrel. But the anvil hums at night, Gunther swears it. Something under the mountain is striking an anvil of its own.',
      },
      roots: {
        greeting: 'That black sap ruins a blade in a night.',
        says: 'We tried tempering in it once. It ate through the steel like rot through a stump. Whatever bleeds it, no dwarf made it.',
      },
      herald: {
        greeting: 'You beat the herald? Then the wyrm is next.',
        says: 'Gunther has not slept, and neither have I. Come back up the stairs and tell us it is done.',
      },
    },
  },
  captive_villager_1: {
    cameHome: {
      greeting: 'The mill turns again, now I am back to turn it.',
      says: 'Do you know what they wanted us for? Our warmth. They meant to burn it out of us on that altar. Eat something before you go down again.',
    },
    lines: {
      mourning: {
        greeting: 'I was cut loose. Others were not.',
        says: 'I hear their voices when the millstones grind. So I keep grinding, and hear them less.',
      },
      thaw: {
        greeting: 'The millrace has thawed!',
        says: 'The first water through the wheel in a year, and the whole valley smells of flour and wet earth. And yet the grindstone trembles when the mill stands still.',
      },
      roots: {
        greeting: 'Black sap in the millrace.',
        says: 'It fouled a whole day’s flour. The old folk say Yggdrasil bleeds when something gnaws it. I used to think that was a tale for children.',
      },
      herald: {
        greeting: 'They are singing about you at the mill.',
        says: 'Whatever waits at the bottom is gnawing at the world itself. Finish it. Then come and eat at my table.',
      },
    },
  },
  captive_villager_2: {
    cameHome: {
      greeting: 'Hmph. Still alive. So are you.',
      says: 'They had me lashed to a stake so long I forgot my own name. Now I hoop barrels and say it over while I work. Torstein. Torstein. Go on, then.',
    },
    lines: {
      mourning: {
        greeting: 'Do not ask me about the others.',
        says: 'I made a cask for each of them that did not come back. Empty. Could not tell you why.',
      },
      thaw: {
        greeting: 'Staves split in the cold. Not any more.',
        says: 'Warm days, good wood, good work. But the casks walk across the floor at night. The ground is restless.',
      },
      roots: {
        greeting: 'That black sap eats through oak.',
        says: 'I sealed a barrel of it to show Mimir. By morning it had eaten through three hoops. Whatever is down there is rotting the world from the bottom up.',
      },
      herald: {
        greeting: 'Nearly done, they say.',
        says: 'Good. I have a cask of the good mead put by, and it is not opened till you come back up.',
      },
    },
  },
  captive_villager_3: {
    cameHome: {
      greeting: 'My loom waited for me.',
      says: 'On the altar I dreamed of three women at a well, weaving. One of them looked at my thread and did not cut it. I woke to you cutting my ropes.',
    },
    lines: {
      mourning: {
        greeting: 'Some threads were cut at the altar.',
        says: 'I weave their names into the border of every cloth now, so no one forgets them.',
      },
      thaw: {
        greeting: 'The wool dries in a day now!',
        says: 'Warm weather and good dye. But my loom-weights swing on their own at night, as if the ground were breathing.',
      },
      roots: {
        greeting: 'I dreamed of the three women again.',
        says: 'They stood at their well under a great tree, and its roots were black and weeping. The one at the loom would not look up from her weaving. Whatever you find down there, I think they are watching it too.',
      },
      herald: {
        greeting: 'The thread runs short now.',
        says: 'Every saga ends at a root or a fire. Choose your ending as if you meant it to be sung.',
      },
    },
  },
  captive_villager_4: {
    cameHome: {
      greeting: 'I used my recall ward, just like you said!',
      says: 'When I am grown I will go down the cellar too. Bjorn says I must learn to hold a shield first. Is it true you fought a troll-wife?',
    },
    lines: {
      mourning: {
        greeting: 'Mother says not to talk about the altar.',
        says: 'I did not see what happened to the others. I only heard it. I want to be strong enough that it never happens again.',
      },
      thaw: {
        greeting: 'You brought the warmth back! Everyone says so!',
        says: 'Me and the other boys went to break the ice on the fountain, but it was already melting. Then the ground shook and we ran. I did not run far.',
      },
      roots: {
        greeting: 'Is there really a dragon at the bottom?',
        says: 'Ranvild says her hounds will not go near the cellar door any more. They can smell it. I am not scared. Not much.',
      },
      herald: {
        greeting: 'Will you win?',
        says: 'Bjorn gave me a real shield. When you come back up, I will show you how I hold it.',
      },
    },
  },
};

function lineFor(spriteKey: string, stage: HomeStage, fromAltar: boolean): Line {
  const homecomer = HOMECOMERS[spriteKey];
  const beforeThaw = stage === 'home' || stage === 'works' || stage === 'siphon' || stage === 'altar';
  if (fromAltar && beforeThaw) return homecomer.cameHome;
  return homecomer.lines[stage] ?? homecomer.cameHome;
}

/** Where each raid villager stands once home: Eir in the temple, Sigrun at her father’s store, Brandr in the armory. */
const RAID_VILLAGER_HOMES: Record<RaidVillagerId, { position: { x: number; y: number }; npcId: string; whereNow: string }> = {
  'prologue-eir': { position: { x: 30, y: 29 }, npcId: 'npc-eir', whereNow: 'is back at the temple' },
  'prologue-sigrun': { position: { x: 9, y: 9 }, npcId: 'npc-sigrun', whereNow: 'is at her father’s counter' },
  'prologue-brandr': { position: { x: 44, y: 8 }, npcId: 'npc-brandr', whereNow: 'is back at Gunther’s forge' },
};

/**
 * Where the captives freed from the Siphon Altar stand once home, in roster order: by Olaf's
 * counter, in the armory, in the temple, and on the plaza road. A raid villager freed there
 * stands at their own home instead (`RAID_VILLAGER_HOMES`).
 */
export const RETURNED_CAPTIVE_POSITIONS = [
  { x: 13, y: 8 },
  { x: 39, y: 7 },
  { x: 26, y: 30 },
  { x: 24, y: 20 },
];

const BROTH_CHOICE_ID = 'choice_returned_broth';
const BROTH_CLAIMED_FLAG = 'returned_broth_claimed';

interface Seat {
  npcId: string;
  name: string;
  position: { x: number; y: number };
  spriteKey: string;
  choiceId?: string;
  line: Line;
}

/**
 * Puts one homecomer in their place with their current line; true when they were not in town
 * before. Someone already there only changes what they say, unless their place or their choice
 * moved, when they are seated again (once the place is free).
 */
function seat(engine: EngineContext, want: Seat): boolean {
  const seated = engine.map.getEntityById(want.npcId) as NPC | null;
  const inPlace = seated && seated.x === want.position.x && seated.y === want.position.y;
  if (seated && inPlace && seated.choiceId === want.choiceId && seated.name === want.name) {
    if (seated.greeting !== want.line.greeting || seated.dialogText !== want.line.says) {
      seated.setDialogue(want.line.greeting, want.line.says);
    }
    return false;
  }
  const blocker = engine.map.getEntityAt(want.position.x, want.position.y);
  if (blocker && blocker !== seated) {
    seated?.setDialogue(want.line.greeting, want.line.says);
    return false;
  }
  if (seated) engine.removeEntity(seated);
  engine.map.addEntity(
    new NPC({
      id: want.npcId,
      name: want.name,
      role: 'villager',
      position: want.position,
      choiceId: want.choiceId,
      spriteKey: want.spriteKey,
      greeting: want.line.greeting,
      dialogText: want.line.says,
    })
  );
  return !seated;
}

/** Seats everyone saved so far, in town, and says who has newly come home. */
export function populateHomecoming(engine: EngineContext): void {
  if (engine.currentFloor !== 0) return;
  const ws = engine.worldState;
  const stage = homeStage(engine);

  const backAtWork: string[] = [];
  if (!isPrologueRunning(ws, COTW_PROLOGUE)) {
    for (const villager of PROLOGUE_VILLAGERS) {
      const id = villager.id as RaidVillagerId;
      if (!prologueVillagerSaved(engine, id)) continue;
      const home = RAID_VILLAGER_HOMES[id];
      const added = seat(engine, {
        npcId: home.npcId,
        name: villager.name,
        position: home.position,
        spriteKey: id,
        line: lineFor(id, stage, false),
      });
      if (added) backAtWork.push(`${villager.shortName} ${home.whereNow}`);
    }
  }

  // The first captive keeps a kettle on for a savior (`choice_returned_broth`), a flask a delve;
  // once this delve's is taken, she talks like the rest.
  const brothOnOffer = getFlag(ws, 'savior_of_jarnvidr') && !getFlag(ws, BROTH_CLAIMED_FLAG);
  const homeFromAltar: string[] = [];
  HOSTAGE_VILLAGERS.forEach((captive, i) => {
    if (!captiveRescued(engine, captive.id)) return;
    const identity = captiveIdentity(engine, captive.id);
    const spriteKey = identity.standIn?.villagerId ?? captive.id;
    const added = seat(engine, {
      npcId: `npc-returned-${i + 1}`,
      name: identity.name,
      position: identity.standIn ? RAID_VILLAGER_HOMES[identity.standIn.villagerId].position : RETURNED_CAPTIVE_POSITIONS[i],
      spriteKey,
      choiceId: i === 0 && brothOnOffer ? BROTH_CHOICE_ID : undefined,
      line: lineFor(spriteKey, stage, true),
    });
    if (added) homeFromAltar.push(identity.shortName);
  });

  if (backAtWork.length > 0) engine.log(`${listNames(backAtWork)}.`);
  if (homeFromAltar.length > 0) {
    const are = homeFromAltar.length > 1 ? 'are' : 'is';
    engine.log(`Word spreads through Bjarnarhaven: ${listNames(homeFromAltar)} ${are} home from the Siphon Altar, safe and whole.`);
  }
}

export const COTW_HOMECOMING_HOOK: ActionHook = {
  id: 'cotw-homecoming',
  phase: 'post',
  actionType: '*',
  execute: ({ engine }) => {
    if (engine.currentFloor > 0) {
      // A new delve, a new flask.
      if (getFlag(engine.worldState, BROTH_CLAIMED_FLAG)) setFlag(engine.worldState, BROTH_CLAIMED_FLAG, false);
      return;
    }
    populateHomecoming(engine);
  },
};
