import type { ProfileManager } from './profile-manager';
import type { AutosaveManager } from './autosaveManager';

/** What the main menu's Continue resumes, or `null` when no living run exists. */
export type ContinueTarget =
  | { kind: 'autosave'; profileId?: string; profileName: string; floor: number }
  | { kind: 'profile'; profileId: string; profileName: string; floor: number };

/**
 * Continue resumes a living run only: the autosave when its hero hasn't fallen, else the
 * most recently saved living hero. A fallen run's saves stay loadable through Load Saved
 * Game; they are just never offered as Continue (ARCHITECTURE.md §5).
 */
export function resolveContinueTarget(
  profiles: ProfileManager,
  autosaves?: AutosaveManager
): ContinueTarget | null {
  const living = profiles.listProfiles().filter((p) => p.questStatus !== 'fallen');

  const autosave = autosaves?.getAutosaveMetadata();
  if (autosave && (!autosave.profileId || living.some((p) => p.id === autosave.profileId))) {
    return { kind: 'autosave', ...autosave };
  }

  const latest = [...living].sort((a, b) => b.lastSaved - a.lastSaved)[0];
  return latest ? { kind: 'profile', profileId: latest.id, profileName: latest.name, floor: latest.floor } : null;
}
