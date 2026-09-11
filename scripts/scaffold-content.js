import fs from 'fs';
import path from 'path';

const [,, name, hp, attack, xp] = process.argv;

if (!name) {
  console.error('Usage: node scripts/scaffold-content.js <Name> <HP> <Attack> <XP>');
  process.exit(1);
}

const id = name.toLowerCase().replace(/\s+/g, '-');
const template = `
export const ${name.replace(/\s+/g, '')}: MonsterDefinition = {
  id: '${id}',
  name: '${name}',
  stats: { hp: ${hp || 10}, maxHp: ${hp || 10}, attack: ${attack || 2}, defense: 1 },
  experienceReward: ${xp || 15},
  dropTableId: 'loot-tier-1',
};
`;

console.log('Generated content snippet:\n', template);
