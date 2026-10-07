import { resolveManaTerms } from '../engine';
import { attunementNpcName, type GameContentManifest, type RuneOfReturnTrack } from '../engine';

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
  manaName: string;
  /** Who compacts coin in town, e.g. "Banker Haakon". */
  bankerTitle: string;
  /** The townsperson who attunes and refills the Rune of Return. */
  runeSmithName: string;
  /** The Rune of Return's three rank tracks, as the pack names them. */
  runeTrackNames: Record<RuneOfReturnTrack, string>;
  /** Name used when the player embarks with a blank name field. */
  defaultHeroName: string;
  /** Decorative rule for menu headings; empty when the pack has none. */
  ornament: string;
  /** The Story's name for the lore the hero keeps. */
  loreTitle: string;
  /** Labels over a lore entry's verse and its practical lore. */
  loreVerseLabel: string;
  loreNoteLabel: string;
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
    manaName: resolveManaTerms(manifest).name,
    bankerTitle: manifest?.town?.services?.bankerTitle ?? 'the town banker',
    runeSmithName: attunementNpcName(manifest),
    runeTrackNames: {
      celerity: manifest?.runeOfReturn?.trackNames?.celerity ?? 'Channel Speed',
      weave: manifest?.runeOfReturn?.trackNames?.weave ?? 'Channel Retention',
      mobility: manifest?.runeOfReturn?.trackNames?.mobility ?? 'Channel Mobility',
    },
    defaultHeroName: manifest?.presetNames?.[0] ?? 'Hero',
    ornament: b.ornament ?? '',
    loreTitle: b.loreTitle ?? 'Lore',
    loreVerseLabel: b.loreVerseLabel ?? 'Verse',
    loreNoteLabel: b.loreNoteLabel ?? 'Lore',
  };
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
  set('#btn-valhalla', branding.hallOfFameShortName);
  set('#error-dialog-title', `${branding.title} - Application Error`);
  set('#health-orb-glyph', branding.healthGlyph);
  set('#mana-orb-glyph', branding.manaGlyph);
  set('#mana-orb-label', branding.manaName.toUpperCase());
  doc.querySelectorAll('#hud-mana-orb').forEach((el) => {
    el.setAttribute('title', `Current and Maximum ${branding.manaName} (Click to Open Spellbook)`);
  });
}
