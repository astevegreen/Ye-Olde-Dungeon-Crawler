export type TerrainSpriteKey =
  | 'wall'
  | 'floor'
  | 'door_closed'
  | 'door_open'
  | 'stairs_up'
  | 'stairs_down'
  | 'trap'
  | 'secret_door';

export type EntitySpriteKey =
  | 'player'
  | 'player_female'
  | 'kobold'
  | 'skeleton'
  | 'giant_rat'
  | 'orc'
  | 'giant_boss'
  | 'shopkeeper'
  | 'townsperson'
  | 'priest'
  | 'sage'
  | 'banker'
  | 'guard';

export type ItemSpriteKey =
  | 'broadsword'
  | 'leather_armor'
  | 'wooden_shield'
  | 'health_potion'
  | 'gold_coins'
  | 'dagger'
  | 'helmet'
  | 'boots'
  | 'backpack'
  | 'purse'
  | 'cursed_mace'
  | 'chest'
  | 'belt'
  | 'sun_stone'
  | 'travel_bread';

export type SpriteKey = TerrainSpriteKey | EntitySpriteKey | ItemSpriteKey;

export interface AtlasCoords {
  col: number;
  row: number;
}
