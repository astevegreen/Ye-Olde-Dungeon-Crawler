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
});
