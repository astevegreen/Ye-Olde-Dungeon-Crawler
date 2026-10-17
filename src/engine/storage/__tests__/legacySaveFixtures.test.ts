import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../../../content/cotw';
import { deserializeGame } from '../serializer';
import { WaitAction } from '../../actions/wait';
import { slotOfSpell } from '../../magic/grimoires';
import type { SaveData } from '../types';

/*
 * Saves captured from the grimoire as it stood before the three-grimoire redesign (the
 * magic plan's session 1a-1). Every phase of that work must still load them and play a
 * turn (the magic plan's "Saves"); since the switch they load through the carry-over
 * (`legacyMagic.ts`). The JSON is the fixture; its builder went with the old grimoire.
 */
const DIR = path.resolve(__dirname, '../../../../tests/fixtures/saves');
const CASES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -'.json'.length));

function read(name: string): SaveData {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')) as SaveData;
}

const load = (name: string) => deserializeGame(read(name), cotwManifest).engine;

describe('legacy grimoire save fixtures', () => {
  it('finds every case', () => {
    expect(CASES).toHaveLength(8);
  });

  it.each(CASES)('%s loads and plays a turn', (name) => {
    const engine = load(name);
    const result = engine.handlePlayerAction(new WaitAction(engine.player));
    expect(result.success).toBe(true);
    expect(engine.player.isAlive()).toBe(true);
  });

  it.each(CASES)('%s carries every known spell into a grimoire slot', (name) => {
    const player = load(name).player;
    for (const id of player.spellsKnown) expect(slotOfSpell(player.grimoireState!, id), id).toBeDefined();
  });

  it('refunds each glyph as its Essence-Rune', () => {
    const player = load('glyphs-two-slots-one-doubled').player;
    const runes = cotwManifest.magic?.grimoires?.retired?.glyphRunes ?? {};
    const carried = player.inventory.getAllCarriedItems().map((i) => i.definitionId);
    expect(carried).toContain(runes.kenaz);
    expect(carried).toContain(runes.isa);
    expect(slotOfSpell(player.grimoireState!, 'firebolt')).toEqual({ grimoireId: 'mani', x: 0, y: 0 });
  });

  it('maps retired spells to their replacements', () => {
    const steam = load('hybrid-steam-lance').player;
    expect(steam.spellsKnown).toEqual(['magic_arrow', 'heal_spell', 'cold_ray']);
    expect(steam.grimoireState!.forged).toEqual([{ spellId: 'cold_ray', element: 'fire' }]);
    expect(load('detect-and-teleport').player.spellsKnown).toEqual(['magic_arrow', 'heal_spell', 'hlidskjalf', 'phase_door']);
  });

  it('keeps what the other cases staged', () => {
    const blood = load('blood-spells-volatile-corruption').player;
    // The old altar's five blood spells come back as the trade's two (cotw's retired map).
    expect(blood.spellsKnown).toEqual(expect.arrayContaining(['blood_reap', 'draugr_call']));
    expect(blood.spellsKnown).not.toContain('exsanguinate');
    // Volatile Energy and the corruption number are gone: the save's are read and let go.
    expect(blood).not.toHaveProperty('energyModel');
    expect(blood).not.toHaveProperty('corruptionScore');
    expect(load('kill-rite-performed').compendium.isKillRitePerformed('kobold')).toBe(true);
    expect(load('grounded-slot').player.spellsKnown).toContain('firebolt');
    expect(load('page-two-active').player.spellsKnown).toContain('cold_ray');
  });
});
