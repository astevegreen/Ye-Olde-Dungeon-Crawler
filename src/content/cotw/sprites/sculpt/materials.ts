import { mat } from './kit';

/*
 * The cotw figure materials, registered by name for Sculpt models. Every hue means
 * something: gold helps you, the element hues are their elements, and figures sit
 * between L* 35 and 75 against the dark ground, their brightest point above 85.
 * Importing this module registers them.
 */

// ---- flesh, hair, cloth
mat('skin', '#c48d6a', { hs: 14 });
mat('skinPale', '#d6b39b', { hs: 12 });
mat('skinDark', '#8a5a40', { hs: 14 });
mat('hairFlax', '#c7a35e');
mat('hairRed', '#a3492c');
mat('hairDark', '#3e2e26');
mat('hairGrey', '#a8a49c', { hs: 8 });
mat('wool', '#55698a', { tex: 'cloth' });
mat('woolRed', '#8c3328', { tex: 'cloth' });
mat('woolGreen', '#4c6a3e', { tex: 'cloth' });
mat('woolBrown', '#6e5640', { tex: 'cloth' });
mat('linen', '#b8ae96', { tex: 'cloth', hs: 10 });
mat('cloak', '#3c4a60', { tex: 'cloth' });
mat('robe', '#5b4a7a', { tex: 'cloth' });
mat('leather', '#7c5438', { hs: 14 });
mat('leatherDark', '#4f3627', { hs: 14 });

// ---- metal, wood, stone, bone
mat('steel', '#97a2b2', { shiny: true, hs: 10 });
mat('iron', '#666e7c', { shiny: true, hs: 10 });
mat('mail', '#7f8896', { shiny: true, tex: 'mail', hs: 8 });
mat('blackIron', '#3b404b', { shiny: true, hs: 10 });
mat('bronze', '#b27a3c', { shiny: true });
mat('gold', '#d9a93a', { shiny: true });
mat('silver', '#c9d1dd', { shiny: true, hs: 8 });
mat('wood', '#7a5a3a', { tex: 'wood' });
mat('woodDark', '#4d3826', { tex: 'wood' });
mat('bark', '#5a4632', { tex: 'bark' });
mat('stone', '#6f727b', { tex: 'stone', hs: 10 });
mat('stoneDark', '#474a54', { tex: 'stone', hs: 10 });
mat('runestone', '#5e6470', { tex: 'stone', hs: 8 });
mat('bone', '#d4c9aa', { hs: 12 });
mat('boneOld', '#a89a7a', { hs: 12 });
mat('horn', '#b9a888', { hs: 12 });

// ---- hide, fur, scale, rot
mat('furGrey', '#7c7f88', { tex: 'fur', hs: 10 });
mat('furBrown', '#7b5b40', { tex: 'fur' });
mat('furDark', '#3a3b44', { tex: 'fur', hs: 10 });
mat('furWhite', '#cdd3dc', { tex: 'fur', hs: 8 });
mat('furTawny', '#a77c48', { tex: 'fur' });
mat('hide', '#8b6a52');
mat('scaleGreen', '#4f7a48', { tex: 'scale' });
mat('scaleRed', '#8c3a2c', { tex: 'scale' });
mat('scaleBlack', '#2f3440', { tex: 'scale', shiny: true });
mat('chitin', '#3d3a48', { shiny: true });
mat('rot', '#6f7b52', { tex: 'rot' });
mat('corpse', '#7d8a86', { tex: 'rot', hs: 10 });
mat('slime', '#6fb04a', { shiny: true, a: 0.88 });
mat('ice', '#93cfe8', { shiny: true, tex: 'ice', hs: 8 });
mat('ghost', '#a9c4d8', { a: 0.72, hs: 8 });
mat('mud', '#5b4a3a', { tex: 'stone' });
mat('feather', '#3a3c46', { tex: 'fur' });
mat('wingSkin', '#5a4250');

// ---- light: emissive materials are lit from within and cast glow
mat('emFire', '#ff8a2c', { em: true, hs: 0 });
mat('emFireCore', '#ffd27a', { em: true, hs: 0 });
mat('emFrost', '#9fe6ff', { em: true, hs: 0 });
mat('emBolt', '#fff27a', { em: true, hs: 0 });
mat('emPoison', '#95dc4c', { em: true, hs: 0 });
mat('emHoly', '#ffe9b0', { em: true, hs: 0 });
mat('emUnholy', '#a868ff', { em: true, hs: 0 });
mat('emArcane', '#6aa6ff', { em: true, hs: 0 });
mat('emKin', '#f0c062', { em: true, hs: 0 });
mat('eyeAmber', '#ffc23a', { em: true, hs: 0 });
mat('eyeRed', '#ff4a32', { em: true, hs: 0 });
