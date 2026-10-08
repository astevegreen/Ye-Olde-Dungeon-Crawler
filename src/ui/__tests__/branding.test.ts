import { describe, it, expect } from 'vitest';
import { applyDocumentBranding, resolveBranding } from '../branding';
import { ContextHelp } from '../help/contextHelp';
import { cotwManifest } from '../../content/cotw';
import { fixtureManifest } from '../../../tests/fixtures/fixture-pack';

// Shared screens carry the active pack's wording, never another pack's (ARCHITECTURE.md §3).
describe('pack branding', () => {
  it("resolves each pack's own title, town, and hall of fame", () => {
    expect(resolveBranding(cotwManifest)).toMatchObject({
      title: cotwManifest.name,
      townName: 'Bjarnarhaven',
      hallOfFameName: 'Hall of Valhalla',
    });
    expect(resolveBranding(fixtureManifest)).toMatchObject({
      title: fixtureManifest.name,
      townName: 'Fixture Keep',
      hallOfFameName: 'Hall of Heroes',
    });
  });

  it('falls back to neutral wording without a manifest', () => {
    const neutral = JSON.stringify(resolveBranding());
    expect(neutral).not.toMatch(/Valhalla|Midgard|Bjarnarhaven|Testland|Fixture Keep|Haakon|Thrain|Sven/);
    expect(neutral).not.toMatch(/[ᚠ-᛿]/u);
  });

  it("takes orb glyphs, townsfolk, and the default hero from the pack", () => {
    expect(resolveBranding(cotwManifest)).toMatchObject({
      healthGlyph: 'ᚦ',
      manaGlyph: 'ᚨ',
      bankerTitle: 'Banker Haakon',
      runeSmithName: 'Thrain the Rune-Smith',
      defaultHeroName: 'Sven',
    });
    expect(resolveBranding(fixtureManifest)).toMatchObject({
      healthGlyph: '♥',
      manaGlyph: '✦',
      runeSmithName: 'the smith',
      defaultHeroName: 'Ash',
    });
  });

  it("names the Rune of Return's ranks as the pack does, neutrally without one (§3)", () => {
    expect(resolveBranding(cotwManifest).runeTrackNames).toEqual({
      celerity: 'Channel Celerity',
      weave: 'Steadfast Weave',
      mobility: 'Unbound Casting',
    });
    expect(Object.values(resolveBranding().runeTrackNames)).toEqual(['Channel Speed', 'Channel Retention', 'Channel Mobility']);
  });

  it('engraves the orbs with the active pack glyphs', () => {
    const els: Record<string, { textContent: string }> = {
      '#health-orb-glyph': { textContent: '' },
      '#mana-orb-glyph': { textContent: '' },
    };
    const doc = { title: '', querySelectorAll: (sel: string) => (els[sel] ? [els[sel]] : []) } as unknown as Document;

    applyDocumentBranding(doc, resolveBranding(cotwManifest));
    expect(els['#health-orb-glyph'].textContent).toBe('ᚦ');
    expect(els['#mana-orb-glyph'].textContent).toBe('ᚨ');

    applyDocumentBranding(doc, resolveBranding(fixtureManifest));
    expect(els['#health-orb-glyph'].textContent).toBe('♥');
  });

  it("names the active pack's banker in the shop help tip", () => {
    const help = new ContextHelp();
    expect(help.getHelpContent('shop', cotwManifest).tip).toContain('Banker Haakon');
    expect(help.getHelpContent('shop', fixtureManifest).tip).not.toContain('Haakon');
    expect(help.getHelpContent('shop').tip).toContain('the town banker');
  });

  it("lists the active pack's townsfolk in the town help card", () => {
    const help = new ContextHelp();
    const fixtureTown = JSON.stringify(help.getHelpContent('town', fixtureManifest));
    const cotwTown = JSON.stringify(help.getHelpContent('town', cotwManifest));

    expect(fixtureTown).toContain('Fixture Keep');
    expect(fixtureTown).not.toMatch(/Bjarnarhaven|Olaf|Mimir|Haakon|Torvald/);
    expect(cotwTown).toContain('Bjarnarhaven');
    expect(cotwTown).toContain('Olaf the Chandler');
  });
});
