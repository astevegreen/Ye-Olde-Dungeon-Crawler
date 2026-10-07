import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { hintFlag, hintsMetByEvent, hintsMetByState, resolveHintText, unseenHints } from '../hints/hintModel';
import { FirstTimeHints } from '../hints/firstTimeHints';

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

  it('meets the grimoire hint in the dungeon once the hero knows two spells, not in town', () => {
    const engine = buildEngine({ magic: { grimoire: { title: 'Grimoire', pageNames: ['I'] } } });
    engine.player.learnSpell('a');
    engine.player.learnSpell('b');
    engine.currentFloor = 0;
    expect(hintsMetByState(engine)).not.toContain('grimoire');
    engine.currentFloor = 1;
    expect(hintsMetByState(engine)).toContain('grimoire');
    expect(hintsMetByState(buildEngine())).not.toContain('grimoire');
  });

  it('names the bound key in the text, or the action when nothing is bound', () => {
    expect(resolveHintText(HINTS.story, (a) => (a === 'story' ? 'O' : undefined)).text).toBe('The Story tab (O) keeps it.');
    expect(resolveHintText({ title: 't', text: 'Press {key:channel_rune}.' }, () => undefined).text).toBe('Press channel rune.');
  });
});

/** Just enough DOM for the hint card: elements that hold children, text and listeners. */
class HintEl {
  public className = '';
  public hidden = false;
  public textContent = '';
  public type = '';
  public title = '';
  public children: unknown[] = [];
  setAttribute(): void {}
  append(...children: unknown[]): void {
    this.children.push(...children);
  }
  replaceChildren(...children: unknown[]): void {
    this.children = children;
  }
  addEventListener(): void {}
}

describe('FirstTimeHints', () => {
  let originalDocument: unknown;
  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: () => new HintEl() };
  });
  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('records a hint as seen once it is on screen, so those queued behind it outlive a quit or load (R-ui-17)', () => {
    const engine = buildEngine({ firstTimeHints: HINTS });
    const hints = new FirstTimeHints({ keyFor: () => undefined, enabled: () => true });
    const [, text, next] = (hints.element as unknown as HintEl).children as HintEl[];
    const seen = (id: 'altar' | 'story' | 'factionStanding') => engine.player.tutorialFlags[hintFlag(id)] === true;

    hints.offer(engine, ['altar', 'story', 'factionStanding']);
    expect(text.textContent).toBe('Burn an offering.');
    expect([seen('altar'), seen('story'), seen('factionStanding')]).toEqual([true, false, false]);
    // Met again on the next turn: still queued once.
    hints.offer(engine, ['story', 'factionStanding']);
    expect(next.textContent).toBe('Next hint (2 more)');

    // A load (or hints turned off and on) drops the queue; what wasn't shown comes back.
    hints.clear();
    hints.offer(engine, ['altar', 'story', 'factionStanding']);
    expect(text.textContent).toBe('The Story tab (story) keeps it.');
    expect(next.textContent).toBe('Next hint (1 more)');
    expect(seen('story')).toBe(true);
    hints.dismiss();
    expect(text.textContent).toBe('It moved.');
    expect(seen('factionStanding')).toBe(true);
  });
});
