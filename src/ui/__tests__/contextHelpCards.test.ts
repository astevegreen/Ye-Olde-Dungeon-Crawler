import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, Player } from '../../engine';
import { ContextHelp } from '../help/contextHelp';
import { cotwManifest } from '../../content/cotw';

describe('F1 cards for altars, the Story and the Rune of Return', () => {
  const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ position: { x: 5, y: 5 } }) });

  it('takes the screen the composition root names before guessing from the floor', () => {
    const help = new ContextHelp();
    expect(help.detectContext(engine)).toBe('exploration');
    let screen: 'altar' | 'story' | 'rune' | null = 'story';
    help.setScreenContext(() => screen);
    expect(help.detectContext(engine)).toBe('story');
    screen = 'rune';
    expect(help.detectContext(engine)).toBe('rune');
    screen = null;
    expect(help.detectContext(engine)).toBe('exploration');
  });

  it("names the pack's rune-smith on the Rune of Return card", () => {
    const keys = new ContextHelp().getHelpContent('rune', cotwManifest).bullets.map((b) => b.key);
    expect(keys).toContain('Thrain the Rune-Smith');
  });

  it('lists the companion keys only for a pack with companions', () => {
    const help = new ContextHelp();
    const rows = (m?: typeof cotwManifest) => help.getHelpContent('exploration', m).bullets.map((b) => b.key);
    expect(rows(cotwManifest)).toContain('Shift+C / Shift+R');
    expect(rows({ ...cotwManifest, companions: [] })).not.toContain('Shift+C / Shift+R');
  });

  it('has an altar card and a Story card', () => {
    const help = new ContextHelp();
    expect(help.getHelpContent('altar', cotwManifest).title).toBe('Altars & Glyphs');
    expect(help.getHelpContent('story', cotwManifest).title).toBe('Story');
  });

  it("has a Spellbook card that explains the grimoire in the pack's own words", () => {
    const card = new ContextHelp().getHelpContent('spellbook', cotwManifest);
    expect(card.title).toBe('Spellbook & Grimoire');
    expect(card.bullets.map((b) => b.label).join(' ')).toContain('placing it again moves it');
    expect(card.tip).toContain(cotwManifest.magic!.grimoire!.centerSlotLabel!);
    // Without a grid, the card says nothing about one.
    expect(new ContextHelp().getHelpContent('spellbook', { ...cotwManifest, magic: {} }).tip).not.toContain('slot');
  });

  it('has a card for the Bestiary, Character and Pacts tabs, each from its own keys', () => {
    const help = new ContextHelp();
    const bestiary = help.getHelpContent('bestiary', cotwManifest);
    expect(bestiary.title).toBe('Bestiary');
    expect(bestiary.bullets.map((b) => b.key)).toContain('Left / Right');
    const character = help.getHelpContent('character', cotwManifest);
    expect(character.bullets.map((b) => b.key)).toEqual(expect.arrayContaining(['S / D / C / I', 'Enter']));
    const pacts = help.getHelpContent('pacts', cotwManifest);
    // cotw's pacts are sealed with the keeper in town, named from the pack.
    expect(pacts.bullets.map((b) => b.key)).toContain('Sage Mimir');
    expect(help.getHelpContent('pacts', { ...cotwManifest, pactKeeperNpcId: undefined }).bullets.map((b) => b.key)).toContain('Enter');
  });

  it("shows the opening's card during the prologue, not the town's shops, which it bars", () => {
    const card = new ContextHelp().getHelpContent('opening', cotwManifest);
    expect(card.title).toBe(cotwManifest.town!.name);
    const keys = card.bullets.map((b) => b.key).join(' ');
    for (const npc of cotwManifest.town!.npcs ?? []) expect(keys).not.toContain(npc.name);
    expect(keys).toContain('Arrows / Numpad');

    // Chosen while the prologue runs, after the map, look, aim and inventory cards.
    const e = new GameEngine({ map: new GameMap(10, 10), player: new Player({ position: { x: 5, y: 5 } }), floor: 0, manifest: cotwManifest });
    e.setWorldFlag(cotwManifest.prologue!.startFlag, true);
    const help = new ContextHelp();
    expect(help.detectContext(e)).toBe('opening');
    expect(help.detectContext(e, { isOpen: true })).toBe('inventory');
  });
});

