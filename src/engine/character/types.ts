export type Gender = 'male' | 'female';

export interface CharacterAttributes {
  strength: number;     // STR (3-18, impacts melee damage and carry capacity)
  intelligence: number; // INT (3-18, impacts max mana and magical affinity)
  constitution: number; // CON (3-18, impacts max health and stamina)
  dexterity: number;    // DEX (3-18, impacts defense evasion, speed, and accuracy)
}

export interface DerivedStats {
  maxHp: number;
  maxMana: number;
  maxCarryWeight: number; // in grams
  baseAttack: number;
  baseDefense: number;
  speed: number;
}

export interface AttributeRoll {
  attributes: CharacterAttributes;
  availablePoints: number;
}

export interface RolledHeroConfig {
  name: string;
  gender: Gender;
  attributes: CharacterAttributes;
}
