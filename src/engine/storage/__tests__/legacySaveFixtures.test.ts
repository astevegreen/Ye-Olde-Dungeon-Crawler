import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../../../content/cotw';
import { deserializeGame } from '../serializer';
import { WaitAction } from '../../actions/wait';
import { GRIMOIRE_ATTUNE_STATUS } from '../../magic/grimoireMatrix';
import { LEGACY_SAVE_CASES } from '../../../../tests/fixtures/saves/legacySaveBuilder';
import type { SaveData } from '../types';

/*
 * Saves captured from the grimoire as it stood before the three-grimoire redesign. Every
 * phase of that work must still load them and play a turn (the magic plan's "Saves").
 * `CAPTURE_LEGACY_SAVES=1` rewrites them from the builder; nothing else should.
 */
const DIR = path.resolve(__dirname, '../../../../tests/fixtures/saves');
const CASES = Object.keys(LEGACY_SAVE_CASES);

function read(name: string): SaveData {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')) as SaveData;
}

describe('legacy grimoire save fixtures', () => {
  it.runIf(process.env.CAPTURE_LEGACY_SAVES === '1')('captures them from the builder', () => {
    for (const name of CASES) {
      fs.writeFileSync(path.join(DIR, `${name}.json`), `${JSON.stringify(LEGACY_SAVE_CASES[name](), null, 1)}\n`);
    }
  });

  it.each(CASES)('%s loads and plays a turn', (name) => {
    const { engine } = deserializeGame(read(name), cotwManifest);
    const result = engine.handlePlayerAction(new WaitAction(engine.player));
    expect(result.success).toBe(true);
    expect(engine.player.isAlive()).toBe(true);
  });

  it('keep what each case staged, on the path that reads them today', () => {
    const load = (name: string) => deserializeGame(read(name), cotwManifest).engine;

    const glyphs = load('glyphs-two-slots-one-doubled').player.grimoire;
    expect(glyphs[1].infusedGlyphs).toEqual([{ glyphId: 'kenaz', potency: 1, sourceName: 'Fire Essence' }]);
    expect(glyphs[4]).toMatchObject({ spellId: 'firebolt', infusedGlyphs: [{ glyphId: 'isa', potency: 2 }] });

    const grounded = load('grounded-slot').player;
    expect(grounded.grimoireGrounds).toEqual({ 0: 'fire' });
    expect(grounded.grimoire[0].spellId).toBe('firebolt');

    const paged = load('page-two-active').player;
    expect(paged.activeGrimoireIndex).toBe(1);
    expect(paged.grimoire[4].spellId).toBe('cold_ray');

    expect(load('hybrid-steam-lance').player.spellsKnown).toEqual(['magic_arrow', 'heal_minor', 'steam_lance']);

    const blood = load('blood-spells-volatile-corruption').player;
    expect(blood.spellsKnown).toContain('exsanguinate');
    expect(blood.energyModel?.volatileEnergy).toBe(18);
    expect(blood.corruptionScore).toBe(30);

    expect(load('detect-and-teleport').player.spellsKnown).toEqual(['magic_arrow', 'heal_minor', 'detect_monsters', 'teleport']);
    expect(load('kill-rite-performed').compendium.isKillRitePerformed('kobold')).toBe(true);
    expect(load('attunement-channel').player.statusManager.getStatus(GRIMOIRE_ATTUNE_STATUS)?.data).toMatchObject({ targetPageIndex: 1 });
  });
});
