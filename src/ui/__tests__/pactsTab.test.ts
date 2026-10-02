import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player, type GameContentManifest } from '../../engine';
import { COTW_PACTS } from '../../content/cotw/pacts';
import { PactsTab } from '../characterMenu/pactsTab';

const key = (code: string) => ({ code, preventDefault: () => {} }) as unknown as KeyboardEvent;

describe('PactsTab', () => {
  let engine: GameEngine;
  let tab: PactsTab;
  let el: HTMLElement;

  beforeEach(() => {
    engine = new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ position: { x: 5, y: 5 } }),
      manifest: { id: 'test', name: 'Test', monsters: [], items: [], spells: [], pacts: COTW_PACTS } as unknown as GameContentManifest,
    });
    tab = new PactsTab();
    el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } as unknown as HTMLElement;
    tab.mount(el);
    tab.onActivate({
      engine,
      worldState: engine.worldState,
      player: engine.player,
      map: engine.map,
      currentFloor: engine.currentFloor,
      turnCount: engine.turnCount,
      manifest: engine.manifest,
    });
  });

  it('shows every pact as a card with its cost and reward', () => {
    expect(el.innerHTML.match(/class="ui-card pc-card/g)?.length).toBe(COTW_PACTS.length);
    expect(el.innerHTML).toContain('Pact of the Blood Moon');
    expect(el.innerHTML).toContain('<span class="pc-label">Cost</span> -25% Maximum Health');
    expect(el.innerHTML).toContain('<span class="pc-label">Reward</span> 2.0x Gold drops');
    expect(el.innerHTML).toContain('No pacts sealed.');
  });

  it('chooses with Up/Down and seals or renounces with Enter, relabeling the footer button', () => {
    expect(el.innerHTML).toContain('pc-card is-selected" data-pact-id="pact_blood"');
    expect(tab.handleKeyDown(key('ArrowDown'))).toBe(true);
    expect(el.innerHTML).toContain('pc-card is-selected" data-pact-id="pact_gloom"');
    tab.handleKeyDown(key('ArrowUp'));
    expect(tab.footer().actions?.[0].label).toBe('Seal pact');

    expect(tab.handleKeyDown(key('Enter'))).toBe(true);
    expect(engine.pacts.isPactActive('pact_blood')).toBe(true);
    expect(el.innerHTML).toContain('<span class="pc-tag">Sealed</span>');
    expect(el.innerHTML).toContain('-25% maximum health');
    expect(tab.footer().actions?.[0].label).toBe('Renounce');

    tab.footer().actions?.[0].run();
    expect(engine.pacts.isPactActive('pact_blood')).toBe(false);
  });

  it('leaves Escape, Tab and the menu keys to the shell', () => {
    for (const code of ['Escape', 'Tab', 'KeyP', 'KeyI']) expect(tab.handleKeyDown(key(code))).toBe(false);
  });

  it('only reports, and names whom to visit, when the pack has a pact keeper in town', () => {
    const kept = new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ position: { x: 5, y: 5 } }),
      manifest: {
        id: 'test', name: 'Test', monsters: [], items: [], spells: [], pacts: COTW_PACTS,
        pactKeeperNpcId: 'npc-sage',
        town: { name: 'Bjarnarhaven', npcs: [{ id: 'npc-sage', name: 'Sage Mimir', role: 'sage', position: { x: 1, y: 1 } }] },
      } as unknown as GameContentManifest,
    });
    tab.onActivate({
      engine: kept,
      worldState: kept.worldState,
      player: kept.player,
      map: kept.map,
      currentFloor: kept.currentFloor,
      turnCount: kept.turnCount,
      manifest: kept.manifest,
    });
    expect(el.innerHTML).toContain('with <b>Sage Mimir</b> in Bjarnarhaven');
    tab.handleKeyDown(key('Enter'));
    expect(kept.pacts.isPactActive('pact_blood')).toBe(false);
    expect(tab.footer().actions).toEqual([]);
  });
});
