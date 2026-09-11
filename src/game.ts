/**
 * @deprecated OBSOLETE LEGACY PROTOTYPE
 *
 * This file was the initial single-file proof-of-concept for Castle of the Winds.
 * The production engine is located in `src/engine/engine.ts` with dedicated
 * subsystems in `src/engine/`.
 *
 * All exports below are retained strictly for backward compatibility with legacy tooling
 * and should not be used in any new development.
 */

export type TileType = 'wall' | 'floor' | 'pillar' | 'door';

export interface Position {
  x: number;
  y: number;
}

export interface GameState {
  width: number;
  height: number;
  grid: TileType[][];
  player: Position;
  turn: number;
  lastAction: string;
}

/** @deprecated Use `GameEngine` and `GameMap` instead */
export function createInitialGameState(width = 24, height = 16): GameState {
  const grid: TileType[][] = [];

  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push('wall');
      } else if (
        (x === 6 && y > 3 && y < 12 && y !== 7) ||
        (x === 17 && y > 3 && y < 12 && y !== 8)
      ) {
        row.push('wall');
      } else if ((x === 6 && y === 7) || (x === 17 && y === 8)) {
        row.push('door');
      } else if ((x === 11 || x === 12) && (y === 5 || y === 10)) {
        row.push('pillar');
      } else {
        row.push('floor');
      }
    }
    grid.push(row);
  }

  return {
    width,
    height,
    grid,
    player: { x: 3, y: 7 },
    turn: 0,
    lastAction: 'Game initialized. Press Arrow keys, Numpad, or WASD to move.',
  };
}

/** @deprecated Use `GameMap.isPassable()` instead */
export function isPassable(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.width || y < 0 || y >= state.height) {
    return false;
  }
  const tile = state.grid[y][x];
  return tile === 'floor' || tile === 'door';
}

/** @deprecated Use `MovementAction` via `GameEngine.handlePlayerAction()` instead */
export function movePlayer(state: GameState, dx: number, dy: number): boolean {
  const targetX = state.player.x + dx;
  const targetY = state.player.y + dy;

  if (isPassable(state, targetX, targetY)) {
    state.player.x = targetX;
    state.player.y = targetY;
    state.turn += 1;
    state.lastAction = `Moved ${getDirectionName(dx, dy)} (Turn ${state.turn})`;
    return true;
  }

  state.lastAction = `Blocked: Cannot move into wall at (${targetX}, ${targetY})`;
  return false;
}

/** @deprecated Internal helper for obsolete game prototype */
function getDirectionName(dx: number, dy: number): string {
  if (dx === 0 && dy === -1) return 'North';
  if (dx === 1 && dy === -1) return 'North-East';
  if (dx === 1 && dy === 0) return 'East';
  if (dx === 1 && dy === 1) return 'South-East';
  if (dx === 0 && dy === 1) return 'South';
  if (dx === -1 && dy === 1) return 'South-West';
  if (dx === -1 && dy === 0) return 'West';
  if (dx === -1 && dy === -1) return 'North-West';
  return 'Unknown';
}

/** @deprecated Use `InputHandler` from `src/rendering/input-handler.ts` instead */
export function handleInputKey(state: GameState, code: string): boolean {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
    case 'Numpad8':
      return movePlayer(state, 0, -1);
    case 'ArrowDown':
    case 'KeyS':
    case 'Numpad2':
      return movePlayer(state, 0, 1);
    case 'ArrowLeft':
    case 'KeyA':
    case 'Numpad4':
      return movePlayer(state, -1, 0);
    case 'ArrowRight':
    case 'KeyD':
    case 'Numpad6':
      return movePlayer(state, 1, 0);
    case 'Numpad7':
    case 'KeyY':
      return movePlayer(state, -1, -1);
    case 'Numpad9':
    case 'KeyU':
      return movePlayer(state, 1, -1);
    case 'Numpad1':
    case 'KeyB':
      return movePlayer(state, -1, 1);
    case 'Numpad3':
    case 'KeyN':
      return movePlayer(state, 1, 1);
    case 'Numpad5':
    case 'Space':
    case 'Period':
      state.turn += 1;
      state.lastAction = `Waited a turn. (Turn ${state.turn})`;
      return true;
    default:
      return false;
  }
}
