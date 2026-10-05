import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { LoreService } from '../lore';
import { CompendiumManager } from '../../compendium/compendiumManager';
import { cotwManifest } from '../../../content/cotw';

/** Tracker 4.1: the Sage sells Study and Rumors (Q11 "A"), priced by home floor (Q60 "A"), a rumor picked from a list (Q61 "B"). */
function heroEngine(): GameEngine {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 } });
  const engine = new GameEngine({ map: GameMap.createBoxRoom(12, 12), player, manifest: cotwManifest, floor: 0 });
  player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
  return engine;
}

const monster = (engine: GameEngine, id: string) => engine.registries.monsters.get(id)!;

describe('Study and Rumors prices follow the home floor (Q60 "A")', () => {
  it('Study is 50 + 10 × floor, Rumors 500 + 50 × floor', () => {
    const engine = heroEngine();
    const byFloor = (floor: number) => engine.registries.monsters.getAll().find((m) => (m.minFloor ?? 1) === floor)!;
    const f1 = byFloor(1);
    expect(LoreService.studyPrice(engine, f1)).toBe(60);
    expect(LoreService.rumorPrice(engine, f1)).toBe(550);
    const deep = engine.registries.monsters.getAll().find((m) => (m.minFloor ?? 1) === 25)!;
    expect(LoreService.studyPrice(engine, deep)).toBe(300);
    expect(LoreService.rumorPrice(engine, deep)).toBe(1750);
  });
});

describe('Study raises a known creature one rank', () => {
  let engine: GameEngine;
  beforeEach(() => {
    engine = heroEngine();
    addCurrencyToPlayer(engine.player, 5000);
  });

  it('takes a Seen creature to Slain, then Studied, charging each step, and no further', () => {
    const def = engine.registries.monsters.getAll().find((m) => (m.minFloor ?? 1) === 1)!;
    engine.compendium.recordEncounter(def.id, def.name, 1);
    expect(LoreService.studyCandidates(engine).map((m) => m.id)).toContain(def.id);

    const before = getPlayerTotalCp(engine.player);
    expect(LoreService.study(engine, def.id).success).toBe(true);
    expect(engine.compendium.getTier(def.id)).toBe(2);
    expect(LoreService.study(engine, def.id).success).toBe(true);
    expect(engine.compendium.getTier(def.id)).toBe(3);
    expect(before - getPlayerTotalCp(engine.player)).toBe(120);
    expect(engine.compendium.getEntry(def.id).kills).toBe(0);

    expect(LoreService.studyCandidates(engine).map((m) => m.id)).not.toContain(def.id);
    const again = LoreService.study(engine, def.id);
    expect(again.success).toBe(false);
    expect(getPlayerTotalCp(engine.player)).toBe(before - 120);
  });

  it('refuses an unmet creature, and charges nothing without the coin', () => {
    const def = monster(engine, engine.registries.monsters.getAll()[0].id);
    expect(LoreService.study(engine, def.id).success).toBe(false);

    const poor = heroEngine();
    poor.compendium.recordEncounter(def.id, def.name, 1);
    const res = LoreService.study(poor, def.id);
    expect(res.success).toBe(false);
    expect(poor.compendium.getTier(def.id)).toBe(1);
  });

  it('keeps a studied rank through a save, though the kills are fewer than the rank needs', () => {
    const def = engine.registries.monsters.getAll().find((m) => (m.minFloor ?? 1) === 1)!;
    engine.compendium.recordEncounter(def.id, def.name, 1);
    LoreService.study(engine, def.id);
    LoreService.study(engine, def.id);
    const loaded = new CompendiumManager(JSON.parse(JSON.stringify(engine.compendium.serialize())));
    expect(loaded.getTier(def.id)).toBe(3);
    // A kill after studying adds to the count without lowering the rank.
    loaded.recordKill(def.id, def.name);
    expect(loaded.getTier(def.id)).toBe(3);
  });
});

describe('Rumors reveal an unmet creature the hero picks (Q61 "B")', () => {
  it('lists every unmet creature with a home floor, and a rumor reveals the chosen one as Seen', () => {
    const engine = heroEngine();
    addCurrencyToPlayer(engine.player, 5000);
    const unmet = LoreService.rumorCandidates(engine);
    expect(unmet.length).toBeGreaterThan(30);
    expect(unmet.every((m) => (m.minFloor ?? 1) >= 1)).toBe(true);
    // Nearest first.
    const floors = unmet.map((m) => m.minFloor ?? 1);
    expect([...floors].sort((a, b) => a - b)).toEqual(floors);

    const pick = unmet[3];
    const before = getPlayerTotalCp(engine.player);
    const res = LoreService.rumor(engine, pick.id);
    expect(res.success).toBe(true);
    expect(res.message).toContain(pick.name);
    expect(engine.compendium.getTier(pick.id)).toBe(1);
    expect(before - getPlayerTotalCp(engine.player)).toBe(LoreService.rumorPrice(engine, pick));
    expect(LoreService.rumorCandidates(engine).map((m) => m.id)).not.toContain(pick.id);
    expect(LoreService.rumor(engine, pick.id).success).toBe(false);
  });

  it('leaves out the prologue raiders, who have no floor', () => {
    const engine = heroEngine();
    expect(LoreService.rumorCandidates(engine).map((m) => m.id)).not.toContain('prologue_coven_thrall');
  });
});
