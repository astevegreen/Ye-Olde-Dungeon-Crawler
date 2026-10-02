import type { GameContentManifest } from '../types/manifest';
import { RUNE_OF_RETURN_STATUS } from '../magic/runeOfReturn';
import type { StatusType } from './types';

/**
 * What a status is called where a player reads it: the pack's name for it
 * (`manifest.statusEffects`), else its id in words ("sensory_masked" -> "Sensory masked").
 */
export function statusDisplayName(
  manifest: Pick<GameContentManifest, 'statusEffects'> | undefined,
  type: StatusType
): string {
  if (type === RUNE_OF_RETURN_STATUS) return 'Channeling rune';
  const named = manifest?.statusEffects?.find((s) => s.id === type)?.name;
  const label = named ?? type.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
