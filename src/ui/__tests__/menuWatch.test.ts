import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster } from '../../engine';
import { MenuWatch } from '../characterMenu/menuWatch';
import { recentMessagesHtml } from '../recentMessages';

function buildEngine() {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
  const engine = new GameEngine({ map, player });
  engine.fov.update(engine.map, player.x, player.y, 8);
  return engine;
}

function monster(id: string, name: string, x: number, y: number) {
  return new Monster({ id, name, position: { x, y }, stats: { hp: 10, maxHp: 20, attack: 1, defense: 0 } });
}

describe('MenuWatch', () => {
  it('says nothing when nothing changed, and treats what was already in sight as known', () => {
    const engine = buildEngine();
    engine.map.addEntity(monster('wolf', 'Wolf', 13, 10));
    engine.fov.update(engine.map, 10, 10, 8);
    const watch = new MenuWatch();
    watch.reset(engine);
    expect(watch.check(engine)).toEqual([]);
  });

  it('warns once when a hostile comes into sight', () => {
    const engine = buildEngine();
    const watch = new MenuWatch();
    watch.reset(engine);
    engine.map.addEntity(monster('ogre', 'Ogre', 14, 10));
    engine.fov.update(engine.map, 10, 10, 8);
    expect(watch.check(engine)).toEqual(['An Ogre comes into view!']);
    expect(watch.check(engine)).toEqual([]);
  });

  it('warns when the hero lost health, whoever dealt it', () => {
    const engine = buildEngine();
    const watch = new MenuWatch();
    watch.reset(engine);
    engine.player.hp -= 3;
    expect(watch.check(engine)).toEqual(['You lose 3 HP.']);
    expect(watch.check(engine)).toEqual([]);
  });

  it('does not warn on healing', () => {
    const engine = buildEngine();
    engine.player.hp = 5;
    const watch = new MenuWatch();
    watch.reset(engine);
    engine.player.hp = 8;
    expect(watch.check(engine)).toEqual([]);
  });
});

describe('recentMessagesHtml', () => {
  it('shows only the newest lines, each escaped, with the vitals and the warning', () => {
    const html = recentMessagesHtml({
      messages: ['one', 'two', 'three <b>', 'four'],
      playerName: 'Hero',
      count: 3,
      vitals: 'HP 4/10 · Seiðr 2/5',
      alert: 'A Wolf comes into view!',
      flash: true,
    });
    expect(html).not.toContain('>one<');
    expect(html).toContain('two');
    expect(html).toContain('three &lt;b&gt;');
    expect(html).toContain('HP 4/10 · Seiðr 2/5');
    expect(html).toContain('recent-messages-alert');
    expect(html).toContain('is-flashing');
  });

  it('flashes only when told to, and omits the warning line when there is none', () => {
    const html = recentMessagesHtml({ messages: ['a'], playerName: 'Hero' });
    expect(html).not.toContain('is-flashing');
    expect(html).not.toContain('recent-messages-alert');
  });
});
