import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Position } from '../types';
import type { RevealEffect } from './types';
import { Monster } from '../entities/monster';
import { revealSecretDoor, revealTrap } from '../actions/search';
import { SENSING_OBJECTS_STATUS } from '../fov/sensing';

/*
 * What a reveal shows (`RevealEffect`). Unbounded, as the Detect spells and Clairvoyance
 * were: the whole floor's foes, piles or map. With `withinReach`, only what lies within the
 * spell's reach (its `areaOfEffect`, which the Area stat grows) of the caster, and each of
 * the narrower layers a seer's neighbours lend (Hliðskjálf's ravens): sleepers, hidden traps,
 * secret doors, item names, weaknesses, the floor's strongest foe, landmarks and the
 * creatures neither friend nor foe.
 */

/** A creature seen through walls for a while, as a reveal's `withinReach` foes are. */
export const SENSED_STATUS = 'sensed';

const within = (from: Position, radius: number) => (p: Position) =>
  Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y)) <= radius;

function sense(engine: GameEngine, caster: Entity, creature: Entity, duration: number): void {
  creature.statusManager.applyStatus({ type: SENSED_STATUS, duration, sourceEntityId: caster.id }, [], creature, engine);
  engine.fov.revealTile(creature.x, creature.y);
}

export function executeReveal(engine: GameEngine, caster: Entity, effect: RevealEffect, reach: number): void {
  const duration = effect.duration ?? 30;
  if (!effect.withinReach) {
    revealWholeFloor(engine, caster, effect, duration);
    return;
  }
  const radius = Math.max(0, reach);
  const near = within(caster, radius);
  const creatures = engine.map.getAllEntities().filter((e) => e !== caster && e.isAlive() && near(e));
  const foes = creatures.filter((e) => e.isHostileTo(caster));
  const say = (text: string) => engine.log(text);

  switch (effect.target) {
    case 'map': {
      for (let y = Math.max(0, caster.y - radius); y <= Math.min(engine.map.height - 1, caster.y + radius); y++) {
        for (let x = Math.max(0, caster.x - radius); x <= Math.min(engine.map.width - 1, caster.x + radius); x++) {
          engine.fov.revealTile(x, y);
        }
      }
      say(`The land within ${radius} paces lies open to you.`);
      return;
    }
    case 'monsters':
    case 'actors':
      for (const foe of foes) sense(engine, caster, foe, duration);
      say(foes.length > 0 ? `You sense ${foes.length} foe${foes.length === 1 ? '' : 's'} within reach.` : 'No foe stirs within reach.');
      return;
    case 'objects':
    case 'items': {
      caster.statusManager.applyStatus(
        { type: SENSING_OBJECTS_STATUS, duration, sourceEntityId: caster.id, data: { x: caster.x, y: caster.y, radius } },
        [],
        caster,
        engine
      );
      const piles = engine.map.getAllGroundItems().filter(near);
      for (const pile of piles) engine.fov.revealTile(pile.x, pile.y);
      say(piles.length > 0 ? `${piles.length} pile${piles.length === 1 ? '' : 's'} of loot glint within reach.` : 'Nothing of worth lies within reach.');
      return;
    }
    case 'sleepers': {
      const sleepers = foes.filter((e) => e instanceof Monster && e.aiState === 'sleeping');
      for (const s of sleepers) sense(engine, caster, s, duration);
      say(sleepers.length > 0 ? `Asleep within reach: ${namesOf(sleepers)}.` : 'Nothing within reach sleeps.');
      return;
    }
    case 'traps': {
      const traps = engine.map.getAllTraps().filter((t) => !t.revealed && near(t));
      for (const trap of traps) revealTrap(engine, trap, `A hidden ${trap.type ?? 'trap'} shows itself.`);
      if (traps.length === 0) say('No hidden trap lies within reach.');
      return;
    }
    case 'secretDoors': {
      let found = 0;
      for (let y = Math.max(0, caster.y - radius); y <= Math.min(engine.map.height - 1, caster.y + radius); y++) {
        for (let x = Math.max(0, caster.x - radius); x <= Math.min(engine.map.width - 1, caster.x + radius); x++) {
          const tile = engine.map.getTile(x, y);
          if (tile && (tile.isSecret || tile.type === 'secret_door') && tile.isDoor !== false) {
            revealSecretDoor(engine, x, y, 'A secret door stands out from the stone.');
            found++;
          }
        }
      }
      if (found === 0) say('No secret door lies within reach.');
      return;
    }
    case 'itemNames': {
      let named = 0;
      for (const pile of engine.map.getAllGroundItems().filter(near)) {
        for (const item of pile.items) {
          if (!item.identified) {
            item.identified = true;
            named++;
          }
        }
      }
      if (named > 0) say(`${named} unknown thing${named === 1 ? ' is' : 's are'} named within reach.`);
      return;
    }
    case 'weaknesses': {
      const compendium = engine.compendium;
      if (!compendium) return;
      const learned = new Set<string>();
      for (const foe of foes) {
        if (!(foe instanceof Monster)) continue;
        if (compendium.getTier(foe.definitionId) === 0) compendium.recordEncounter(foe.definitionId, foe.name);
        if (compendium.getTier(foe.definitionId) === 1 && compendium.raiseKnowledge(foe.definitionId) !== undefined) learned.add(foe.name);
      }
      if (learned.size > 0) say(`You learn the weaknesses of ${[...learned].join(', ')}.`);
      return;
    }
    case 'strongest': {
      const strongest = engine.map
        .getAllEntities()
        .filter((e) => e !== caster && e.isAlive() && e.isHostileTo(caster))
        .sort((a, b) => b.maxHp - a.maxHp || a.id.localeCompare(b.id))[0];
      if (!strongest) return;
      sense(engine, caster, strongest, duration);
      say(`The mightiest foe on this floor is ${strongest.name}.`);
      return;
    }
    case 'landmarks': {
      let found = 0;
      for (let y = Math.max(0, caster.y - radius); y <= Math.min(engine.map.height - 1, caster.y + radius); y++) {
        for (let x = Math.max(0, caster.x - radius); x <= Math.min(engine.map.width - 1, caster.x + radius); x++) {
          const tile = engine.map.getTile(x, y);
          if (tile?.landmarkLabel && !tile.isStairs) {
            engine.fov.revealTile(x, y);
            found++;
          }
        }
      }
      const others = creatures.filter((e) => e !== engine.player && e !== engine.companion && !e.isHostileTo(caster));
      for (const other of others) sense(engine, caster, other, duration);
      if (found + others.length > 0) say('Holy places and lost souls within reach show themselves.');
      return;
    }
  }
}

function namesOf(creatures: Entity[]): string {
  const names = creatures.slice(0, 4).map((c) => c.name);
  return creatures.length > 4 ? `${names.join(', ')} and ${creatures.length - 4} more` : names.join(', ');
}

function revealWholeFloor(engine: GameEngine, caster: Entity, effect: RevealEffect, duration: number): void {
  if (effect.target === 'monsters' || effect.target === 'actors') {
    if (duration > 0) engine.detectMonstersTurns += duration;
    const monsters = engine.map.getAllEntities().filter((e) => e.isHostileTo(caster) && e.isAlive());
    for (const m of monsters) engine.fov.revealTile(m.x, m.y);
    engine.log(`Your mind expands beyond physical barriers! Sensing living beings through stone (${duration} turns, ${monsters.length} detected).`);
  } else if (effect.target === 'objects' || effect.target === 'items') {
    if (duration > 0) engine.detectObjectsTurns += duration;
    const groundPiles = engine.map.getAllGroundItems();
    for (const pile of groundPiles) engine.fov.revealTile(pile.x, pile.y);
    engine.log(`A resonant shimmer reveals loose treasures through stone (${duration} turns, ${groundPiles.length} pile(s)).`);
  } else if (effect.target === 'map') {
    engine.fov.revealAllTiles();
    engine.log('*** The entire floor is revealed to you! ***');
  }
}
