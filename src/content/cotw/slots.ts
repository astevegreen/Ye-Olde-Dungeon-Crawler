import type { EquipmentSlotDefinition } from '../../engine';

export const COTW_EQUIPMENT_SLOTS: EquipmentSlotDefinition[] = [
  { id: 'head', name: 'Head', acceptedCategories: ['helmet', 'armor'], layout: { x: 93, y: 16, width: 34, height: 34, gridArea: 'head' } },
  { id: 'neck', name: 'Neck', acceptedCategories: ['amulet'], layout: { x: 93, y: 58, width: 34, height: 34, gridArea: 'neck' } },
  { id: 'torso', name: 'Torso', acceptedCategories: ['armor'], layout: { x: 93, y: 104, width: 34, height: 34, gridArea: 'torso' } },
  { id: 'overgarment', name: 'Overgarment', acceptedCategories: ['cloak'], layout: { x: 48, y: 58, width: 34, height: 34, gridArea: 'overgarment' } },
  { id: 'mainHand', name: 'Main Hand', acceptedCategories: ['weapon'], layout: { x: 34, y: 110, width: 34, height: 34, gridArea: 'mainHand' } },
  { id: 'offHand', name: 'Off Hand', acceptedCategories: ['shield', 'weapon'], layout: { x: 152, y: 110, width: 34, height: 34, gridArea: 'offHand' } },
  { id: 'hands', name: 'Hands', acceptedCategories: ['gauntlets'], layout: { x: 20, y: 162, width: 34, height: 34, gridArea: 'hands' } },
  { id: 'wrists', name: 'Wrists', acceptedCategories: ['bracers'], layout: { x: 166, y: 162, width: 34, height: 34, gridArea: 'wrists' } },
  { id: 'waist', name: 'Waist', acceptedCategories: ['container'], layout: { x: 93, y: 154, width: 34, height: 34, gridArea: 'waist' } },
  { id: 'feet', name: 'Feet', acceptedCategories: ['boots'], layout: { x: 93, y: 270, width: 34, height: 34, gridArea: 'feet' } },
  { id: 'fingerLeft', name: 'Left Finger', acceptedCategories: ['ring'], layout: { x: 58, y: 162, width: 34, height: 34, gridArea: 'fingerLeft' } },
  { id: 'fingerRight', name: 'Right Finger', acceptedCategories: ['ring'], layout: { x: 128, y: 162, width: 34, height: 34, gridArea: 'fingerRight' } },
  { id: 'pack', name: 'Pack', acceptedCategories: ['container'], layout: { x: 34, y: 224, width: 34, height: 34, gridArea: 'pack' } },
  { id: 'purse', name: 'Purse', acceptedCategories: ['container'], layout: { x: 152, y: 224, width: 34, height: 34, gridArea: 'purse' } },
];
