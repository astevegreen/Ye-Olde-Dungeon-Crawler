import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../../../content/cotw';
import { FIXTURE_GRIMOIRES } from '../../../../tests/fixtures/fixture-pack';
import { deserializeGame, serializeGame } from '../serializer';
import { convertLegacyMagic } from '../legacyMagic';
import { WaitAction } from '../../actions/wait';
import { GRIMOIRE_ATTUNE_STATUS } from '../../magic/grimoireMatrix';
import { slotOfSpell, validateGrimoireSystem } from '../../magic/grimoires';
import type { GrimoireSystemConfig } from '../../magic/magicConfig';
import type { GameContentManifest } from '../../types/manifest';
import type { SaveData } from '../types';

/*
 * Old saves carried over to the three grimoires (P-29, plan 1a-2): the captured cotw
 * saves, loaded with the fixture pack's grimoire declaration and a retired-spell map.
 */
const DIR = path.resolve(__dirname, '../../../../tests/fixtures/saves');
const read = (name: string): SaveData => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')) as SaveData;

const GRIMOIRES: GrimoireSystemConfig = {
  ...FIXTURE_GRIMOIRES,
  retired: {
    spells: {
      steam_lance: { spellId: 'cold_ray', addedElement: 'fire' },
      teleport: 'phase_door',
      detect_monsters: 'clairvoyance',
    },
    glyphRunes: { kenaz: 'essence_kenaz', isa: 'essence_isa' },
  },
};
const manifest: GameContentManifest = { ...cotwManifest, magic: { ...cotwManifest.magic, grimoires: GRIMOIRES } };
const load = (name: string) => deserializeGame(read(name), manifest).engine;
const runes = (engine: ReturnType<typeof load>, itemId: string) =>
  engine.player.inventory
    .getAllCarriedItems()
    .filter((i) => i.definitionId === itemId)
    .reduce((n, i) => n + (i.quantity ?? 1), 0);

describe('carrying old magic over to the three grimoires', () => {
  it('the retired map is sound', () => {
    expect(validateGrimoireSystem(GRIMOIRES)).toEqual([]);
    const chained: GrimoireSystemConfig = { ...FIXTURE_GRIMOIRES, retired: { spells: { a: 'b', b: 'c', c: { spellId: 'd', addedElement: '' } } } };
    expect(validateGrimoireSystem(chained)).toEqual([
      'retired spell a maps to b, which is itself retired',
      'retired spell b maps to c, which is itself retired',
      'retired spell c adds no element',
    ]);
  });

  it.each(['glyphs-two-slots-one-doubled', 'grounded-slot', 'page-two-active', 'hybrid-steam-lance', 'blood-spells-volatile-corruption', 'detect-and-teleport', 'kill-rite-performed', 'attunement-channel'])(
    '%s loads with every known spell in a slot, and plays a turn',
    (name) => {
      const engine = load(name);
      const { spellsKnown, grimoireState } = engine.player;
      expect(grimoireState).toBeDefined();
      for (const id of spellsKnown) expect(slotOfSpell(grimoireState!, id), id).toBeDefined();
      expect(engine.handlePlayerAction(new WaitAction(engine.player)).success).toBe(true);
    }
  );

  it('keeps a spell in its old cell where the grimoire has it, and slots the rest in page order', () => {
    // Page 0: magic_arrow in slot 1 (0, -1), heal_minor in slot 3 (-1, 0), firebolt in slot 4 (0, 0).
    const state = load('glyphs-two-slots-one-doubled').player.grimoireState!;
    expect(state.opened).toEqual(['row']);
    expect(slotOfSpell(state, 'heal_minor')).toEqual({ grimoireId: 'row', x: -1, y: 0 });
    expect(slotOfSpell(state, 'firebolt')).toEqual({ grimoireId: 'row', x: 0, y: 0 });
    expect(slotOfSpell(state, 'magic_arrow')).toEqual({ grimoireId: 'row', x: 1, y: 0 });
  });

  it('refunds each glyph as its rune once, and takes the glyphs off the old pages', () => {
    const engine = load('glyphs-two-slots-one-doubled');
    expect(runes(engine, 'essence_kenaz')).toBe(1);
    expect(runes(engine, 'essence_isa')).toBe(1);
    expect(engine.player.grimoirePages.flatMap((p) => p.slots).some((s) => s.infusedGlyphs?.length)).toBe(false);

    const again = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))) as SaveData, manifest).engine;
    expect(runes(again, 'essence_kenaz')).toBe(1);
    expect(runes(again, 'essence_isa')).toBe(1);
  });

  it('turns a retired hybrid into its base spell forged with the added element, on the quick bar too', () => {
    const player = load('hybrid-steam-lance').player;
    expect(player.spellsKnown).toEqual(['magic_arrow', 'heal_minor', 'cold_ray']);
    expect(player.quickSpells.slice(0, 3)).toEqual(['magic_arrow', 'heal_minor', 'cold_ray']);
    expect(player.grimoireState!.forged).toEqual([{ spellId: 'cold_ray', element: 'fire' }]);
    expect(slotOfSpell(player.grimoireState!, 'cold_ray')).toEqual({ grimoireId: 'row', x: 0, y: 0 });
  });

  it('renames retired spells known, and keeps the forge through a save', () => {
    expect(load('detect-and-teleport').player.spellsKnown).toEqual(['magic_arrow', 'heal_minor', 'clairvoyance', 'phase_door']);
    const engine = load('hybrid-steam-lance');
    const again = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))) as SaveData, manifest).engine;
    expect(again.player.grimoireState!.forged).toEqual([{ spellId: 'cold_ray', element: 'fire' }]);
  });

  it('drops the page-switch channel', () => {
    const player = load('attunement-channel').player;
    expect(player.statusManager.hasStatus(GRIMOIRE_ATTUNE_STATUS)).toBe(false);
  });
});

describe('convertLegacyMagic', () => {
  it('maps saved new-model state, merges a replacement already known, and blanks a duplicate on the quick bar', () => {
    const result = convertLegacyMagic(GRIMOIRES, {
      spellsKnown: ['phase_door', 'teleport', 'cold_ray'],
      quickSpells: ['teleport', 'phase_door', null, 'steam_lance'],
      pages: [],
      state: {
        opened: ['row'],
        placements: [
          { grimoireId: 'row', x: 0, y: 0, spellId: 'teleport' },
          { grimoireId: 'row', x: 1, y: 0, spellId: 'cold_ray' },
        ],
        statPicks: [],
        extraSlots: [],
        doubledSlots: [],
        forgotten: ['steam_lance', 'firebolt'],
        forged: [],
      },
    });
    expect(result.spellsKnown).toEqual(['phase_door', 'cold_ray']);
    expect(result.quickSpells).toEqual(['phase_door', null, null, 'cold_ray']);
    expect(result.state.placements.map((p) => p.spellId)).toEqual(['phase_door', 'cold_ray']);
    expect(result.state.forgotten).toEqual(['firebolt']);
    expect(result.refunds).toEqual([]);
  });

  it('leaves a save with no retired spells, pages or statuses as it was', () => {
    const result = convertLegacyMagic(GRIMOIRES, { spellsKnown: ['healing_light'], pages: [] });
    expect(result.spellsKnown).toEqual(['healing_light']);
    expect(result.quickSpells).toBeUndefined();
    expect(result.statusEffects).toBeUndefined();
    expect(result.state.placements).toEqual([]);
  });
});
