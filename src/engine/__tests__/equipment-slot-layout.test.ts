import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EQUIPMENT_SLOTS,
  Paperdoll,
  type EquipmentSlotDefinition,
} from '../inventory/paperdoll';
import { COTW_EQUIPMENT_SLOTS } from '../../content/cotw/slots';

describe('Equipment Slot Layout & Data-Driven Schema', () => {
  it('defines valid layout coordinates for all 14 standard equipment slots in DEFAULT_EQUIPMENT_SLOTS', () => {
    expect(DEFAULT_EQUIPMENT_SLOTS.length).toBe(14);

    const requiredSlots = [
      'head', 'neck', 'torso', 'overgarment', 'mainHand', 'offHand',
      'hands', 'wrists', 'waist', 'feet', 'fingerLeft', 'fingerRight',
      'pack', 'purse',
    ];

    for (const slotId of requiredSlots) {
      const slot = DEFAULT_EQUIPMENT_SLOTS.find((s) => s.id === slotId);
      expect(slot).toBeDefined();
      expect(slot?.layout).toBeDefined();
      expect(typeof slot?.layout?.x).toBe('number');
      expect(typeof slot?.layout?.y).toBe('number');
      expect(slot?.layout?.width).toBe(34);
      expect(slot?.layout?.height).toBe(34);
      expect(slot?.layout?.gridArea).toBe(slotId);
    }
  });

  it('COTW_EQUIPMENT_SLOTS matches manifest layout coordinate requirements', () => {
    expect(COTW_EQUIPMENT_SLOTS.length).toBe(14);
    for (const slot of COTW_EQUIPMENT_SLOTS) {
      expect(slot.layout).toBeDefined();
      expect(slot.layout!.x).toBeGreaterThanOrEqual(0);
      expect(slot.layout!.y).toBeGreaterThanOrEqual(0);
      expect(slot.layout!.width).toBe(34);
      expect(slot.layout!.height).toBe(34);
    }
  });

  it('allows custom slot layout overrides when instantiating Paperdoll', () => {
    const customSlots: EquipmentSlotDefinition[] = [
      {
        id: 'head',
        name: 'Crown',
        acceptedCategories: ['helmet'],
        layout: { x: 100, y: 10, width: 40, height: 40, gridArea: 'crown' },
      },
      {
        id: 'mainHand',
        name: 'Primary Weapon',
        acceptedCategories: ['weapon'],
        layout: { x: 20, y: 100, width: 36, height: 36, gridArea: 'weapon' },
      },
      {
        id: 'torso',
        name: 'Chestplate',
        acceptedCategories: ['armor'],
        // intentionally omitting layout to test optionality
      },
    ];

    const doll = new Paperdoll(customSlots);
    const defs = doll.getSlotDefinitions();
    expect(defs.length).toBe(3);

    const headDef = doll.getSlotDefinition('head');
    expect(headDef?.layout?.x).toBe(100);
    expect(headDef?.layout?.y).toBe(10);
    expect(headDef?.layout?.width).toBe(40);
    expect(headDef?.layout?.gridArea).toBe('crown');

    const torsoDef = doll.getSlotDefinition('torso');
    expect(torsoDef?.layout).toBeUndefined();
  });

  it('maintains anatomical symmetry: left/right finger and hands/wrists layout positioning', () => {
    const lFinger = DEFAULT_EQUIPMENT_SLOTS.find((s) => s.id === 'fingerLeft');
    const rFinger = DEFAULT_EQUIPMENT_SLOTS.find((s) => s.id === 'fingerRight');
    expect(lFinger?.layout?.y).toBe(rFinger?.layout?.y);
    expect(lFinger!.layout!.x).toBeLessThan(rFinger!.layout!.x);

    const mainHand = DEFAULT_EQUIPMENT_SLOTS.find((s) => s.id === 'mainHand');
    const offHand = DEFAULT_EQUIPMENT_SLOTS.find((s) => s.id === 'offHand');
    expect(mainHand?.layout?.y).toBe(offHand?.layout?.y);
    expect(mainHand!.layout!.x).toBeLessThan(offHand!.layout!.x);
  });
});
