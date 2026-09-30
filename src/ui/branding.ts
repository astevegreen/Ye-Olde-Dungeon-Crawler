import type { GameContentManifest } from '../engine';

/** Every pack-specific string shared screens show, resolved with neutral fallbacks (§3). */
export interface ResolvedBranding {
  title: string;
  tagline: string;
  townName: string;
  hallOfFameName: string;
  hallOfFameShortName: string;
  worldName: string;
  victoryTitle: string;
  victoryBanner: string;
  fallenBanner: string;
  xpName: string;
  healthGlyph: string;
  manaGlyph: string;
  /** Who compacts coin in town, e.g. "Banker Haakon". */
  bankerTitle: string;
  /** The townsperson who attunes and refills the Rune of Return. */
  runeSmithName: string;
  /** Name used when the player embarks with a blank name field. */
  defaultHeroName: string;
}

export function resolveBranding(manifest?: GameContentManifest): ResolvedBranding {
  const b = manifest?.branding ?? {};
  return {
    title: manifest?.name ?? 'Dungeon Crawler',
    tagline: manifest?.description ?? 'A turn-based dungeon adventure.',
    townName: manifest?.town?.name ?? 'Town',
    hallOfFameName: b.hallOfFameName ?? 'Hall of Legends',
    hallOfFameShortName: b.hallOfFameShortName ?? 'Legends',
    worldName: b.worldName ?? 'the realm',
    victoryTitle: b.victoryTitle ?? 'Victory!',
    victoryBanner: b.victoryBanner ?? 'Your quest is complete.',
    fallenBanner: b.fallenBanner ?? 'Your journey ends here.',
    xpName: b.xpName ?? 'XP',
    healthGlyph: b.healthGlyph ?? '♥',
    manaGlyph: b.manaGlyph ?? '✦',
    bankerTitle: manifest?.town?.services?.bankerTitle ?? 'the town banker',
    runeSmithName: runeSmithOf(manifest) ?? 'the town smith',
    defaultHeroName: manifest?.presetNames?.[0] ?? 'Hero',
  };
}

function runeSmithOf(manifest?: GameContentManifest): string | undefined {
  const npcId = manifest?.runeOfReturn?.attunementNpcId;
  return npcId ? manifest?.town?.npcs?.find((npc) => npc.id === npcId)?.name : undefined;
}

/** The build's version, injected by vite.config.ts from package.json. */
export const APP_VERSION = `v${import.meta.env.VITE_APP_VERSION ?? '0.0.0'}`;

/**
 * Fills the static shell in index.html, which carries only neutral placeholder text,
 * with the active pack's wording.
 */
export function applyDocumentBranding(doc: Document, branding: ResolvedBranding): void {
  const set = (selector: string, text: string) => {
    doc.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  };
  doc.title = branding.title;
  set('.version-tag', APP_VERSION);
  set('#btn-valhalla', `🏆 ${branding.hallOfFameShortName}`);
  set('#valhalla-modal-title', `${branding.hallOfFameName} - Legends of ${branding.worldName}`);
  set('#valhalla-modal-banner', branding.hallOfFameName.toUpperCase());
  set('#valhalla-modal-sub', `Eternal honors of ${branding.worldName}'s champions`);
  set('#valhalla-status', `${branding.hallOfFameShortName} Leaderboard`);
  set('#error-dialog-title', `${branding.title} - Application Error`);
  set('#health-orb-glyph', branding.healthGlyph);
  set('#mana-orb-glyph', branding.manaGlyph);
}
