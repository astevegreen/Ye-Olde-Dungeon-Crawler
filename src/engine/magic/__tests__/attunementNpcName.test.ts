import { describe, it, expect } from 'vitest';
import { attunementNpcName } from '../runeOfReturn';
import type { GameContentManifest } from '../../types/manifest';

// Engine messages about awakening the rune name the pack's attunement NPC, never a
// hardcoded one (ARCHITECTURE.md §3, No Engine Creep).
describe('attunementNpcName', () => {
  const manifest = (npcs: Array<{ id: string; name: string }>, attunementNpcId?: string) =>
    ({ town: { npcs }, runeOfReturn: { attunementNpcId } }) as unknown as GameContentManifest;

  it("names the town NPC the pack declares as the rune's attuner", () => {
    const m = manifest([{ id: 'npc-forge', name: 'Mira the Engraver' }], 'npc-forge');
    expect(attunementNpcName(m)).toBe('Mira the Engraver');
  });

  it('falls back to a neutral title when the pack names no attuner or it is missing', () => {
    expect(attunementNpcName()).toBe('the smith');
    expect(attunementNpcName(manifest([{ id: 'npc-forge', name: 'Mira' }]))).toBe('the smith');
    expect(attunementNpcName(manifest([], 'npc-forge'))).toBe('the smith');
  });
});
