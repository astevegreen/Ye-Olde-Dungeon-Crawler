import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TacticalTargetOverlay, pileLabelHtml, targetCardHtml } from '../tacticalTargetOverlay';
import { Camera } from '../camera';
import { GameEngine, Item, Monster } from '../../engine';

describe('TacticalTargetOverlay', () => {
  let overlay: TacticalTargetOverlay;

  beforeEach(() => {
    overlay = new TacticalTargetOverlay();
  });

  it('tracks hovered coordinates and clears hover', () => {
    expect(overlay.hoveredTile).toBeNull();

    overlay.setHoveredTile(10, 15);
    expect(overlay.hoveredTile).toEqual({ x: 10, y: 15 });

    overlay.clearHover();
    expect(overlay.hoveredTile).toBeNull();
  });

  it('renders safely when no tile is hovered', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const camera = new Camera(20, 15);
    expect(() => {
      overlay.render(mockCtx, {} as GameEngine, camera, 32, 0, 0, 960, 600);
    }).not.toThrow();
  });

  it('has no card while nothing is hovered', () => {
    expect(overlay.card({} as GameEngine, new Camera(20, 15), 32, 0, 0)).toBeNull();
  });

  it('builds the target card from the monster, escaped, with a wind-up warning', () => {
    const ogre = new Monster({ id: 'o', name: '<Ogre>', position: { x: 1, y: 1 }, stats: { hp: 25, maxHp: 50, attack: 5, defense: 1 } });
    let html = targetCardHtml(ogre);
    expect(html).toContain('&lt;Ogre&gt;');
    expect(html).toContain('25 / 50');
    expect(html).toContain('width: 50%');
    expect(html).not.toContain('Winding up');
    ogre.intent = { type: 'windup', abilityName: 'Smash' } as Monster['intent'];
    html = targetCardHtml(ogre);
    expect(html).toContain('Winding up an attack');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });

  it("names the monster's conditions as the pack does, not by id", () => {
    const ogre = new Monster({ id: 'o', name: 'Ogre', position: { x: 1, y: 1 }, stats: { hp: 25, maxHp: 50, attack: 5, defense: 1 } });
    ogre.statusManager.applyStatus('giant_blood', 5);
    ogre.statusManager.applyStatus('sensory_masked', 5);
    const html = targetCardHtml(ogre, { statusEffects: [{ id: 'giant_blood', name: "Giant's Blood" }] } as GameEngine['manifest']);
    expect(html).toContain("Giant's Blood, Sensory masked");
    expect(html).not.toContain('giant_blood');
  });

  it('cards an ally as one: the shield, not the attack icon, and no wind-up warning', () => {
    const hound = new Monster({ id: 'h', name: 'Hound', position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 20, attack: 3, defense: 1 }, faction: 'player' });
    hound.intent = { type: 'windup', abilityName: 'Lunge' } as Monster['intent'];
    const html = targetCardHtml(hound);
    expect(html).toContain('At your side');
    expect(html).not.toContain('Winding up');
    expect(html).toContain('data-icon="shield"');
    expect(html).not.toContain('data-icon="attack"');

    const ogre = new Monster({ id: 'o', name: 'Ogre', position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 20, attack: 3, defense: 1 } });
    expect(targetCardHtml(ogre)).toContain('data-icon="attack"');
    expect(targetCardHtml(ogre)).not.toContain('At your side');
  });

  it('cards a neutral monster as standing aside, without the attack icon', () => {
    const wight = new Monster({ id: 'w', name: 'Wight', position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 } });
    wight.setFaction('neutral');
    const html = targetCardHtml(wight);
    expect(html).toContain('Stands aside');
    expect(html).not.toContain('data-icon="attack"');
  });

  it('labels a pile by its top item and how many more lie under it', () => {
    const ware = (id: string, name: string) => new Item({ id, name, category: 'misc', weight: 100, bulk: 100, quality: 'normal', identified: true, value: 1 });
    expect(pileLabelHtml([ware('a', 'Rock')])).toMatch(/Rock$/);
    expect(pileLabelHtml([ware('a', 'Rock'), ware('b', 'Stick'), ware('c', 'Bone')])).toContain('Rock (+2 more)');
  });
});
