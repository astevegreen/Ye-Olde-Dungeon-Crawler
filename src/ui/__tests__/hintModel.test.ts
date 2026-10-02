import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { hintFlag, hintsMetByEvent, hintsMetByState, resolveHintText, unseenHints } from '../hints/hintModel';

function buildEngine(manifest: Record<string, unknown> = {}) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
  const engine = new GameEngine({ map, player, manifest: { id: 'test_pack', name: 'Test', ...manifest } as any });
  engine.fov.update(engine.map, player.x, player.y, 8);
  return engine;
}

const HINTS = {
  altar: { title: 'Altars', text: 'Burn an offering.' },
  story: { title: 'Your saga', text: 'The Story tab ({key:story}) keeps it.' },
  factionStanding: { title: 'Standing', text: 'It moved.' },
};

describe('first-time hints', () => {
  it('offers only hints the pack wrote and this hero has not been shown, once each', () => {
    const engine = buildEngine({ firstTimeHints: HINTS });
    expect(unseenHints(engine, ['altar', 'companion', 'altar', 'story'])).toEqual(['altar', 'story']);

    engine.player.markTutorialSeen(hintFlag('altar'));
    expect(unseenHints(engine, ['altar', 'story'])).toEqual(['story']);
  });

  it('meets the altar hint on reaching an altar, and the kill-rite hint on a rite', () => {
    expect(hintsMetByEvent({ type: 'altar_reached', turn: 3, data: {} } as any)).toEqual(['altar']);
    expect(hintsMetByEvent({ type: 'kill_rite_performed', turn: 3, data: {} } as any)).toEqual(['killRite']);
    expect(hintsMetByEvent({ type: 'entity_killed', turn: 3, data: {} } as any)).toEqual([]);
  });

  it('meets the standing hint once a faction moves from where it began, not before', () => {
    const engine = buildEngine({ initialWorldState: { flags: {}, counters: {}, factions: { clans: -10 } } });
    engine.worldState.factions.clans = -10;
    expect(hintsMetByState(engine)).not.toContain('factionStanding');
    engine.worldState.factions.clans = -5;
    expect(hintsMetByState(engine)).toContain('factionStanding');
  });

  it('meets the saga hint with the first deed done', () => {
    const engine = buildEngine({ trackedMilestones: [{ id: 'm1', flag: 'deed_one', title: 'One', description: '' }] });
    expect(hintsMetByState(engine)).not.toContain('story');
    engine.worldState.flags.deed_one = true;
    expect(hintsMetByState(engine)).toContain('story');
  });

  it('names the bound key in the text, or the action when nothing is bound', () => {
    expect(resolveHintText(HINTS.story, (a) => (a === 'story' ? 'O' : undefined)).text).toBe('The Story tab (O) keeps it.');
    expect(resolveHintText({ title: 't', text: 'Press {key:channel_rune}.' }, () => undefined).text).toBe('Press channel rune.');
  });
});
