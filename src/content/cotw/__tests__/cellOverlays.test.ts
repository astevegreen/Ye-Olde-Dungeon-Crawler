import { describe, it, expect } from 'vitest';
import { BUILTIN_SURFACE_TYPES, type GasType } from '../../../engine';
import { cotwManifest } from '..';

// R-rend-18: surface and gas art is the pack's (`atlas.overlays`); cotw draws every surface
// and gas the engine can make, so none of them falls to the renderer's neutral wash.
describe('cotw surface and gas art', () => {
  const overlays = cotwManifest.atlas.overlays ?? {};
  const GASES: GasType[] = ['fire_storm', 'poison_cloud', 'dense_steam'];

  it('draws every surface and every gas', () => {
    for (const type of BUILTIN_SURFACE_TYPES) expect(overlays[`surface~${type}`], type).toBeTypeOf('function');
    for (const type of GASES) expect(overlays[`gas~${type}`], type).toBeTypeOf('function');
  });

  it('keys nothing but surfaces and gases', () => {
    for (const key of Object.keys(overlays)) expect(key).toMatch(/^(surface|gas)~[a-z_]+$/);
  });
});
