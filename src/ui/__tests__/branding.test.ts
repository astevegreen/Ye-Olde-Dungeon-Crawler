import { describe, it, expect } from 'vitest';
import { resolveBranding } from '../branding';
import { ContextHelp } from '../help/contextHelp';
import { cotwManifest } from '../../content/cotw';
import { warcraftManifest } from '../../content/warcraft';

// Shared screens carry the active pack's wording, never another pack's (ARCHITECTURE.md §3).
describe('pack branding', () => {
  it("resolves each pack's own title, town, and hall of fame", () => {
    expect(resolveBranding(cotwManifest)).toMatchObject({
      title: cotwManifest.name,
      townName: 'Bjarnarhaven',
      hallOfFameName: 'Hall of Valhalla',
    });
    expect(resolveBranding(warcraftManifest)).toMatchObject({
      title: warcraftManifest.name,
      townName: 'Stormwind Outpost',
      hallOfFameName: 'Hall of Heroes',
    });
  });

  it('falls back to neutral wording without a manifest', () => {
    const neutral = JSON.stringify(resolveBranding());
    expect(neutral).not.toMatch(/Valhalla|Midgard|Bjarnarhaven|Azeroth|Stormwind/);
  });

  it("lists the active pack's townsfolk in the town help card", () => {
    const help = new ContextHelp();
    const warcraftTown = JSON.stringify(help.getHelpContent('town', warcraftManifest));
    const cotwTown = JSON.stringify(help.getHelpContent('town', cotwManifest));

    expect(warcraftTown).toContain('Stormwind Outpost');
    expect(warcraftTown).not.toMatch(/Bjarnarhaven|Olaf|Mimir|Haakon|Torvald/);
    expect(cotwTown).toContain('Bjarnarhaven');
    expect(cotwTown).toContain('Olaf the Chandler');
  });
});
