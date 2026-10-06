import { describe, it, expect, afterEach, vi } from 'vitest';
import { InputHandler } from '../input-handler';
import { GameEngine, GameMap, Player, MemoryStorage } from '../../engine';
import { SettingsManager } from '../../ui/settings/settingsManager';

/**
 * Review 2026-10-06 C6 (R-docs-3): the freeze guard persists the replay data before every
 * input the game acts on (ARCHITECTURE.md §2). A held key acts on each auto-repeat, so each
 * repeat is noted too; otherwise a hang mid-corridor left a record from the first press.
 */
describe('a held key is noted on every repeat', () => {
  let inputHandler: InputHandler;
  afterEach(() => inputHandler.destroy());

  it('each auto-repeat of a held arrow reaches onBeforeInput', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ position: { x: 5, y: 5 } }) });
    inputHandler = new InputHandler(
      engine, vi.fn(), undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage())
    );
    inputHandler.enabled = true;
    const noted: string[] = [];
    inputHandler.onBeforeInput = (code) => noted.push(code);
    const press = (repeat: boolean) =>
      ({ code: 'ArrowRight', key: 'ArrowRight', repeat, shiftKey: false, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as KeyboardEvent;

    inputHandler.handleKeyDown(press(false));
    inputHandler.handleKeyDown(press(true));
    inputHandler.handleKeyDown(press(true));

    expect(noted).toEqual(['ArrowRight', 'ArrowRight', 'ArrowRight']);
  });
});
