import type {
  RenownMilestoneDefinition,
  RenownTitleDefinition,
} from '../../engine';

export const COTW_RENOWN_MILESTONES: RenownMilestoneDefinition[] = [
  {
    id: 'secret_door_found',
    category: 'exploration',
    label: 'Keen Eye',
    description: 'Discovered a secret door hidden in the dungeon masonry.',
    icon: '🚪',
    renownValue: 5,
    repeatable: true,
  },
  {
    id: 'item_uncursed',
    category: 'combat',
    label: 'Purifier',
    description: "Cleansed a cursed relic of Loki's dark binding.",
    icon: '✨',
    renownValue: 15,
    repeatable: true,
  },
];

export const COTW_RENOWN_TITLES: RenownTitleDefinition[] = [
  { title: 'the Watchful', threshold: 25, category: 'exploration' },
  { title: 'the Purifier', threshold: 30, category: 'combat' },
  { title: 'Renowned', threshold: 100 },
];
