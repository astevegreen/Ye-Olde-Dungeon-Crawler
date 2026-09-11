import type { TownLayoutDefinition } from '../../engine/types/manifest';
import { ItemFactory } from '../../engine/items/factory';

export const WARCRAFT_TOWN: TownLayoutDefinition = {
  name: 'Stormwind Outpost',
  width: 50,
  height: 30,
  playerSpawn: { x: 10, y: 14 },
  stairsDown: { x: 25, y: 8 },
  buildings: [
    {
      name: 'Outpost Armory',
      bounds: { x1: 3, y1: 2, x2: 16, y2: 9 },
      door: { x: 10, y: 9, isOpen: false },
    },
    {
      name: 'Alchemist Hut',
      bounds: { x1: 33, y1: 2, x2: 46, y2: 9 },
      door: { x: 40, y: 9, isOpen: false },
    },
    {
      name: 'Chapel of the Holy Light',
      bounds: { x1: 20, y1: 19, x2: 30, y2: 28 },
      door: { x: 25, y: 19, isOpen: true },
    },
  ],
  npcs: [
    {
      id: 'npc-lothar',
      name: 'Commander Lothar',
      role: 'villager',
      position: { x: 25, y: 12 },
      greeting: 'For the Alliance! The orcish Horde threatens the realm from Blackrock Mountain.',
      dialogText: 'Champion, delve into Blackrock Spire and strike down Warchief Blackhand!',
      isStationary: true,
    },
    {
      id: 'npc-blacksmith',
      name: 'Dwarven Armorer Grimstone',
      role: 'merchant',
      shopId: 'merchant-grimstone',
      position: { x: 10, y: 5 },
      greeting: 'Need sturdy steel? Khaz Modan iron will turn any orc blade!',
      merchantConfig: {
        id: 'merchant-grimstone',
        name: 'Outpost Armory',
        greeting: 'Need sturdy steel? Khaz Modan iron will turn any orc blade!',
        markupRatio: 1.2,
        markdownRatio: 0.5,
        initialInventory: [
          ItemFactory.createBroadsword('grimstone-sword-1'),
          ItemFactory.createWoodenShield('grimstone-shield-1'),
        ],
      },
    },
    {
      id: 'npc-cleric',
      name: 'Brother Anton',
      role: 'priest',
      position: { x: 25, y: 23 },
      greeting: 'The Light protects all who stand against the shadow.',
      dialogText: 'May the Holy Light shield your spirit and cleanse your wounds.',
      isStationary: true,
    },
  ],
  services: {
    templeName: 'Chapel of the Holy Light',
    priestTitle: 'Brother Anton',
    cleanseMessageTemplate: 'Brother Anton channels the Holy Light, purifying your spirit of all curses!',
    noCursesMessage: 'The Light finds no dark curses lingering upon your equipment.',
    healMessageTemplate: 'Holy radiance bathes your flesh, restoring {hp} HP! The Light be with you.',
  },
};
