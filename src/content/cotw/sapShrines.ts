import type { ChoiceDefinition, FixedTilePlacement, LoreEntryDefinition, TileDefinition } from '../../engine';

/**
 * The sap-shrines of Act II (floors 28, 33, 38 and 41): small root-altars where a skald cut a
 * verse about the Rot. Reading one keeps its verse in the Story's Carved Verses and does
 * nothing else. Read in order, the four tell how the Rot came: the tappers' silver spigots, the
 * sap they drink, the blight that leaks, the wyrm behind it. One choice per shrine, so each
 * settles on its own, as the clan barrows do (ironClans.ts).
 */
const SAP_SHRINES = [
  {
    n: 1,
    floor: 28,
    title: 'The Silver Spigots',
    sight: 'A silver spigot, black with old sap, is still driven into the root beside it.',
    verse:
      'Down the root-stair came the tappers, mallets at their belts and silver at their hips.\nThey drove their spigots into the World Tree’s flesh, a hand’s breadth deep.\nThe Tree bled gold, and they called it plenty.',
    lore: 'The Sap-tappers drive silver spigots into Yggdrasil’s roots and draw off its sap.',
  },
  {
    n: 2,
    floor: 33,
    title: 'The Sap-Drinkers',
    sight: 'Empty horn cups lie in the moss at its foot, their rims crusted amber.',
    verse:
      'The sap ran warm, and they drank, and they drank again.\nTheir skin went to bark, their eyes to amber, and no frost could bite them.\nWho drinks from the World Tree never thirsts, and never stops.',
    lore: 'The tappers drink the sap they draw: it hardens them, and they cannot leave it.',
  },
  {
    n: 3,
    floor: 38,
    title: 'The Wound That Weeps',
    sight: 'Below the carving the root has gone soft and grey, and black sap weeps from it.',
    verse:
      'Where a spigot sits, the wound never closes.\nBlack sap weeps past the silver, and the root goes grey and soft beneath it.\nThe Rot is no curse of the Aesir: it is the Tree, bleeding out.',
    lore: 'The Rot is what leaks from the tappers’ spigots: the blight that eats the roots below.',
  },
  {
    n: 4,
    floor: 41,
    title: 'The Gnawer Below',
    sight: 'Tooth-marks the size of shields score the root under the last line of the verse.',
    verse:
      'Below the last spigot, something drinks what the tappers spill.\nNíðhögg gnaws, and every wound they cut is a wound for his teeth.\nAsk the tappers whom they tap for.',
    lore: 'Níðhögg feeds on the wounds the spigots open, and the tappers may know it.',
  },
];

const shrineId = (n: number): string => `sap_shrine_${n}`;
const readFlag = (n: number): string => `${shrineId(n)}_read`;

export const SAP_SHRINE_TILES: TileDefinition[] = SAP_SHRINES.map((s) => ({
  type: shrineId(s.n),
  name: `Sap-Shrine: ${s.title}`,
  passable: true,
  walkable: true,
  transparent: true,
  visual: 'altar',
  glyph: 'ᛇ',
  description: `A small altar of living root, where a skald cut a verse about the Rot into the bark. ${s.sight}`,
  interactionHandlerId: shrineId(s.n),
  landmarkLabel: 'Sap-Shrine ᛇ',
}));

export const SAP_SHRINE_CHOICES: Record<string, ChoiceDefinition> = Object.fromEntries(
  SAP_SHRINES.map((s) => {
    const id = shrineId(s.n);
    const choice: ChoiceDefinition = {
      id,
      title: `Sap-Shrine: ${s.title}`,
      description: `A skald cut these lines into a knot of living root. ${s.sight}\n\n“${s.verse}”`,
      options: [
        {
          id: 'read',
          label: 'Read the verse',
          description: 'Take the skald’s words with you. They are kept under Carved Verses.',
          consequences: [
            { type: 'setFlag', flag: readFlag(s.n), value: true },
            { type: 'logMessage', message: `You read the verse cut into the root: “${s.verse.replace(/\n/g, ' ')}”` },
          ],
        },
      ],
      cancelable: true,
      cancelLabel: 'Leave the shrine',
      resolvedStates: [{ flag: readFlag(s.n), message: 'You have already read this shrine’s verse. It is kept under Carved Verses.' }],
    };
    return [id, choice];
  })
);

export const SAP_SHRINE_PLACEMENTS: FixedTilePlacement[] = SAP_SHRINES.map((s) => ({
  floor: s.floor,
  tileId: shrineId(s.n),
  placement: 'middle_room_center',
  requiresChoiceId: shrineId(s.n),
}));

/** The shrines' verses, kept in the Story's Carved Verses once read. */
export const SAP_SHRINE_LORE: LoreEntryDefinition[] = SAP_SHRINES.map((s) => ({
  flag: readFlag(s.n),
  title: s.title,
  verse: s.verse,
  lore: s.lore,
}));
