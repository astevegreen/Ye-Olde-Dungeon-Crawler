import type { ScreenArt } from '../../../engine';
import { buildDeath, deathBoxes, paintDeath } from './death';
import { buildRagnarok, paintRagnarok, ragnarokBoxes } from './ragnarok';
import { screen } from './scene';
import { buildTitle, paintTitle, titleBoxes } from './title';
import { buildVictory, paintVictory, victoryBoxes } from './victory';

/**
 * The painted screens: the castle on its crag above the frozen fjord, by night for the title,
 * at sunrise when the root is sealed, burning at Ragnarök with the hero fighting one of
 * Surtr's fire-giants; and the runestone with Huginn and Muninn for a fallen hero.
 */
export const COTW_SCREEN_ART: ScreenArt = {
  title: screen((base) => buildTitle(base), paintTitle, titleBoxes),
  death: screen(buildDeath, paintDeath, deathBoxes),
  endings: {
    sealed: screen(buildVictory, paintVictory, victoryBoxes),
    ragnarok: screen(buildRagnarok, paintRagnarok, ragnarokBoxes),
  },
};
