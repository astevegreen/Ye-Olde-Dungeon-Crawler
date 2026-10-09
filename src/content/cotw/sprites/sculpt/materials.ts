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

// ---- bosses and named elites: one-off materials, prefixed so no family reuses them
mat('boss_jotun', '#6f8499', { hs: 10, tex: 'stone' }); // frost-jötunn hide
mat('boss_jotunHead', '#7489a0', { hs: 10, tex: 'stone' }); // the same hide; a second name draws a seam
mat('boss_rime', '#d4eaf4', { shiny: true, tex: 'ice', hs: 6 }); // hoarfrost crust
mat('boss_maul', '#55606e', { tex: 'stone', hs: 8 });
mat('boss_breath', '#d8f2fb', { a: 0.55, hs: 4 }); // a frost-breath puff
mat('boss_glint', '#ffffff', { em: true, hs: 0 });
mat('boss_sun', '#ffe7a6', { em: true, hs: 0 }); // the stolen solar core
mat('boss_sunWhite', '#fffaf0', { em: true, hs: 0 });
mat('boss_heat', '#ffcf86', { a: 0.4, hs: 0 }); // heat shimmer
mat('boss_iron', '#5e6674', { shiny: true, hs: 10 }); // riveted construct iron
mat('boss_tar', '#262d27', { shiny: true, hs: 16 }); // wet tar hide
mat('boss_maw', '#160f14', { hs: 4 });
mat('boss_bile', '#7fc040', { em: true, hs: 0 }); // bile, lit
mat('boss_pool', '#22361c', { shiny: true, hs: 10 }); // pooled bile, unlit
mat('boss_glassDead', '#3a3a34', { shiny: true, hs: 6 }); // snuffed lantern glass
mat('boss_smokeGrey', '#7b8088', { a: 0.5, hs: 4 });
mat('boss_root', '#4d4038', { tex: 'bark', hs: 12 }); // a rotten taproot
mat('boss_deadRoot', '#8a7a68', { tex: 'bark', hs: 10 }); // a crown of dead roots
mat('boss_sap', '#16141c', { shiny: true, hs: 8 }); // black sap
mat('boss_trollDead', '#7d8a82', { tex: 'rot', hs: 10 }); // undead troll skin
mat('boss_trollHead', '#808d85', { tex: 'rot', hs: 10 });
mat('boss_wyrmScale', '#577a5e', { tex: 'scale', shiny: true, hs: 12 }); // verdigris wyrm scales
mat('boss_banner', '#6a5232', { tex: 'cloth', hs: 14 }); // an old ochre war-banner
mat('boss_mantle', '#363940', { tex: 'cloth', hs: 12 });
mat('boss_ivory', '#e4d8bc', { shiny: true, hs: 12 }); // the shed fang
mat('boss_voidHide', '#4a4556', { tex: 'rot', hs: 10 }); // stretched hide over bone
mat('boss_voidCore', '#0e0918', { em: true, hs: 4 }); // the void bone: a light darker than what it touches
mat('boss_smoke', '#352c46', { a: 0.9, hs: 10 }); // a black smoke mane
mat('boss_smokeThin', '#3c3250', { a: 0.6, hs: 10 });
mat('boss_bileBelly', '#86c84a', { em: true, hs: 0 }); // a wyrm's ventral glow
mat('boss_wing', '#3a3240', { hs: 10 });
mat('boss_rootHorn', '#7a6b5a', { tex: 'bark', hs: 10 });
mat('boss_fibre', '#b49a72', { tex: 'wood', hs: 10 }); // splintered root fibres
mat('boss_crust', '#4a3f3b', { tex: 'stone', hs: 10 }); // cooling magma crust
mat('boss_trollWife', '#7a866f', { hs: 10 }); // grey-green troll-wife skin
mat('boss_mask', '#d8ceb4', { hs: 10 }); // the antler-crowned mask
mat('boss_moss', '#5d7642', { tex: 'fur', hs: 12 });

// ---- monster families, part 1 (wave 3): the dead, beasts and vermin, goblins and casters, trolls
// the dead
mat('mon1_corpse', '#7d8ea6', { tex: 'rot', hs: 10 });
mat('mon1_corpseDust', '#8c8a86', { tex: 'rot', hs: 10 });
mat('mon1_rustMail', '#73706e', { shiny: true, tex: 'mail', hs: 10 });
mat('mon1_dustMail', '#857660', { tex: 'mail', hs: 10 });
mat('mon1_rust', '#9a5f38', { tex: 'rot', hs: 12 });
mat('mon1_helm', '#646c78', { shiny: true, hs: 10 });
mat('mon1_oldSteel', '#9aa2ae', { shiny: true, hs: 8 });
mat('mon1_rime', '#d3e6ee', { tex: 'ice', hs: 4 });
mat('mon1_beard', '#e0e5e9', { tex: 'fur', hs: 6 });
mat('mon1_shroud', '#4b5468', { tex: 'cloth', hs: 12 });
mat('mon1_wrap', '#625d52', { tex: 'cloth', hs: 12 });
mat('mon1_verdigris', '#5fa38c', { shiny: true, hs: 10 });
mat('mon1_royal', '#4c5d82', { tex: 'cloth' });
mat('mon1_rag', '#6d6758', { tex: 'cloth', hs: 12 });
mat('mon1_deadGlass', '#4a5a54', { shiny: true, hs: 8 });
mat('mon1_ore', '#c09048', { hs: 10 });
mat('mon1_hex', '#8c84ff', { em: true, hs: 0 });
mat('mon1_myling', '#b6cee2', { a: 0.6, hs: 8 });
mat('mon1_mylingFace', '#e2edf6', { a: 0.78, hs: 6 });
mat('mon1_grim', '#545b7e', { tex: 'fur', a: 0.94, hs: 14 });
mat('mon1_grimMist', '#626a96', { a: 0.55, hs: 10 });
mat('mon1_rootCloth', '#58644a', { tex: 'cloth', hs: 14 });
mat('mon1_root', '#665a42', { tex: 'bark', hs: 12 });
mat('mon1_rootBone', '#aeb48c', { hs: 10 });
mat('mon1_void', '#18141f', { hs: 6 });
mat('mon1_helIron', '#5a627c', { shiny: true, hs: 12 });
mat('mon1_helCloth', '#474462', { tex: 'cloth', hs: 12 });
mat('mon1_rotFlesh', '#7f8270', { tex: 'rot', hs: 10 });
// beasts and vermin
mat('mon1_muzzle', '#bdbab4', { tex: 'fur', hs: 8 });
mat('mon1_furRime', '#cad8e4', { tex: 'fur', hs: 8 });
mat('mon1_furStorm', '#66778f', { tex: 'fur', hs: 10 });
mat('mon1_hackle', '#5c5f69', { tex: 'fur', hs: 10 });
mat('mon1_frostMist', '#c4f2ff', { em: true, a: 0.6, hs: 0 });
mat('mon1_ratFur', '#77695c', { tex: 'fur', hs: 12 });
mat('mon1_ratSkin', '#c49e92', { hs: 12 });
mat('mon1_teeth', '#e6cc62', { hs: 8 });
mat('mon1_iceChitin', '#5f84a0', { shiny: true, hs: 10 });
mat('mon1_drill', '#aac8da', { shiny: true, hs: 8 });
mat('mon1_rotChitin', '#6e5844', { shiny: true, tex: 'rot', hs: 12 });
mat('mon1_quick', '#a9b5c4', { shiny: true, hs: 6 });
mat('mon1_quick2', '#7a8698', { shiny: true, hs: 6 });
// goblins and casters
mat('mon1_kobold', '#9c8c5e', { hs: 14 });
mat('mon1_shaman', '#a8704c', { hs: 14 });
mat('mon1_goblin', '#6f8e4c', { hs: 14 });
mat('mon1_skrael', '#8496a6', { hs: 10 });
mat('mon1_skFur', '#b4bab8', { tex: 'fur', hs: 8 });
mat('mon1_ragBrown', '#6c5642', { tex: 'cloth', hs: 12 });
mat('mon1_hagRobe', '#52607c', { tex: 'cloth' });
mat('mon1_hagShawl', '#6b6e86', { tex: 'cloth' });
mat('mon1_hagSkin', '#b0b6b2', { hs: 10 });
mat('mon1_hagHair', '#e6eff5', { tex: 'fur', hs: 6 });
mat('mon1_sorcRobe', '#514c6e', { tex: 'cloth' });
mat('mon1_trim', '#a9adb8', { shiny: true, hs: 8 });
mat('mon1_zealRobe', '#dccb9e', { tex: 'cloth', hs: 10 });
mat('mon1_char', '#3e322c', { tex: 'rot', hs: 10 });
mat('mon1_scar', '#8a4a32', { hs: 10 });
// jötnar and trolls
mat('mon1_trollHide', '#728266', { hs: 12 });
mat('mon1_trollLimb', '#7c8c6e', { hs: 12 });
mat('mon1_trollHead', '#84946f', { hs: 12 });
mat('mon1_moss', '#5f823c', { tex: 'fur', hs: 12 });
mat('mon1_ogre', '#a88c6c', { hs: 14 });
mat('mon1_jotun', '#82a2c8', { hs: 10 });
mat('mon1_basalt', '#6a5249', { tex: 'stone', hs: 12 });
mat('mon1_orc', '#748a68', { hs: 12 });
mat('mon1_cleaver', '#8c929a', { shiny: true, hs: 8 });
mat('mon1_twSkin', '#808e6c', { hs: 12 });
mat('mon1_twDress', '#5a4e48', { tex: 'cloth', hs: 12 });
mat('mon1_shawl', '#7c5638', { tex: 'cloth', hs: 12 });
mat('mon1_coven', '#5e5046', { tex: 'cloth', hs: 12 });
mat('mon1_ironHair', '#959ba3', { tex: 'fur', hs: 8 });
mat('mon1_ironSkin', '#93845f', { tex: 'bark', hs: 10 });
mat('mon1_blood', '#d8323c', { em: true, hs: 0 });

// ---- monster families, part 2 (wave 4): vættir and spirits, made things, fiends, wyrms
// huldra
mat('mon2_hSkin', '#dccab6', { hs: 10 });
mat('mon2_hHair', '#a3a862', { hs: 12 });
mat('mon2_moss', '#56733e', { tex: 'cloth' });
mat('mon2_hollow', '#3a2818', { tex: 'rot' });
mat('mon2_rim', '#8a7052', { tex: 'bark', hs: 12 });
mat('mon2_tail', '#b39a7c', { hs: 12 });
mat('mon2_oldSkin', '#a7a38a', { tex: 'bark', hs: 10 });
mat('mon2_oldHair', '#84906a', { hs: 8 });
mat('mon2_barkGown', '#5e4a34', { tex: 'bark' });
mat('mon2_lichen', '#8fae5a', { tex: 'rot' });
mat('mon2_fungus', '#d2c09a', { hs: 8 });
mat('mon2_flower', '#f1ead6', { hs: 6 });
// fylgja
mat('mon2_fetch', '#e2eaf0', { a: 0.78, hs: 6 });
mat('mon2_fetchFade', '#d6e2ea', { a: 0.42, hs: 6 });
mat('mon2_fetchGold', '#ffe3a0', { em: true, a: 0.9, hs: 0 });
mat('mon2_antler', '#eadcb0', { a: 0.9, hs: 8 });
mat('mon2_fetchMist', '#cfdce6', { a: 0.3, hs: 4 });
// näcken
mat('mon2_nSkin', '#a7b7ad', { shiny: true, hs: 10 });
mat('mon2_wetHair', '#36403f', { shiny: true, hs: 8 });
mat('mon2_water', '#3f7f98', { shiny: true, a: 0.82, hs: 8 });
mat('mon2_rockWet', '#5a6168', { tex: 'stone', shiny: true, hs: 8 });
mat('mon2_fiddle', '#94532a', { tex: 'wood', shiny: true });
// nisse, skratti
mat('mon2_nWool', '#6e6b63', { tex: 'cloth', hs: 10 });
mat('mon2_nose', '#c97a5c', { hs: 10 });
mat('mon2_iceSkin', '#86b8d2', { hs: 8 });
mat('mon2_earIn', '#4f7c9c', { hs: 8 });
// bound spirits
mat('mon2_holyCore', '#fffaf0', { em: true, hs: 0 });
mat('mon2_ray', '#f0c35a', { em: true, hs: 0 });
mat('mon2_gas', '#b2ba5a', { a: 0.6, hs: 8 });
mat('mon2_gasDeep', '#86903e', { a: 0.55, hs: 8 });
mat('mon2_gasLight', '#dce29a', { a: 0.55, hs: 4 });
mat('mon2_gasHole', '#2e3418', { a: 0.9, hs: 6 });
mat('mon2_lampGlass', '#c9aa52', { em: true, hs: 0 });
// constructs, slag
mat('mon2_sap', '#cddc52', { em: true, hs: 0 });
mat('mon2_soot', '#6c686e', { a: 0.8, hs: 6 });
mat('mon2_bellowsHide', '#8a4a40', { hs: 10, tex: 'cloth' });
mat('mon2_mirror', '#b2c0d0', { shiny: true, hs: 6 });
mat('mon2_glass', '#8cc6da', { shiny: true, a: 0.82, hs: 6 });
mat('mon2_sun', '#fff1ba', { em: true, hs: 0 });
mat('mon2_crust', '#56483f', { tex: 'stone', hs: 10 });
// fiends, horrors
mat('mon2_smoke', '#5c5474', { a: 0.95, hs: 8 });
mat('mon2_smokeThin', '#7a70a0', { a: 0.45, hs: 8 });
mat('mon2_claw', '#c8c0dc', { shiny: true, hs: 6 });
mat('mon2_hellFur', '#4a4556', { tex: 'fur', hs: 10 });
mat('mon2_feastFlesh', '#8c849a', { tex: 'rot', hs: 10 });
mat('mon2_maw', '#7a44c4', { em: true, hs: 0 });
mat('mon2_chitin', '#4e4b62', { shiny: true, hs: 8 });
mat('mon2_brain', '#78acff', { em: true, a: 0.94, hs: 0 });
mat('mon2_brainFold', '#2c4aa6', { em: true, hs: 0 });
// wyrms
mat('mon2_frostScale', '#b4cee0', { tex: 'scale', hs: 8 });
mat('mon2_frostBelly', '#dde9f0', { hs: 6 });
mat('mon2_mist', '#d4f2ff', { a: 0.5, hs: 4 });
mat('mon2_wyrmScale', '#5c4c36', { tex: 'scale', shiny: true });
mat('mon2_wyrmBelly', '#8a6c46', { hs: 12 });
mat('mon2_wyrmWing', '#4a3a34', { hs: 12 });
mat('mon2_scar', '#a8927a', { hs: 8 });
mat('mon2_graveScale', '#5a627a', { tex: 'scale', shiny: true, hs: 8 });
mat('mon2_graveBelly', '#7c8492', { hs: 8 });
mat('mon2_graveWing', '#604a62', { hs: 8 });

// ---- monster families, part 3 (wave 5): the dwarves of the works, the walking dead, the World-Bark's things
// dwarves
mat('mon3_char', '#3a3434', { tex: 'rot', hs: 10 });
mat('mon3_gilt', '#c09032', { shiny: true, hs: 14 });
mat('mon3_cinderPlate', '#4c4644', { shiny: true, hs: 12 });
mat('mon3_ashBeard', '#8a8682', { tex: 'fur', hs: 8 });
mat('mon3_barrowCloak', '#5a4a38', { tex: 'cloth', hs: 12 });
mat('mon3_turf', '#4e6436', { tex: 'fur', hs: 12 });
mat('mon3_grass', '#8a9a52', { hs: 10 });
mat('mon3_soot', '#9a8a80', { tex: 'rot', hs: 12 });
mat('mon3_wretchSkin', '#b08a74', { hs: 12 });
mat('mon3_scorchBeard', '#5a4232', { tex: 'fur', hs: 12 });
mat('mon3_milk', '#d6d2c6', { hs: 6 });
// the walking dead of the silver veins
mat('mon3_narSkin', '#8f9478', { tex: 'rot', hs: 10 });
mat('mon3_tarnish', '#3a3c46', { shiny: true, hs: 8 });
mat('mon3_wightSkin', '#6c7280', { shiny: true, tex: 'rot', hs: 8 });
mat('mon3_wightMail', '#747a88', { shiny: true, tex: 'mail', hs: 8 });
mat('mon3_wightShroud', '#514c64', { tex: 'cloth', hs: 10 });
mat('mon3_lode', '#4a4448', { tex: 'stone', hs: 8 });
mat('mon3_vein', '#d4dcea', { shiny: true, hs: 8 });
// things of the World-Bark
mat('mon3_shell', '#4c3624', { shiny: true, tex: 'bark', hs: 12 });
mat('mon3_shellBelly', '#2e241e', { shiny: true, hs: 10 });
mat('mon3_resin', '#d88a24', { shiny: true, a: 0.92, hs: 14 });
mat('mon3_grub', '#b4a07e', { tex: 'rot', hs: 10 });
mat('mon3_grubPlate', '#56402c', { shiny: true, tex: 'bark', hs: 12 });
mat('mon3_egg', '#a8c048', { em: true, hs: 0 });
mat('mon3_bsSkin', '#857c6a', { tex: 'rot', hs: 10 });
mat('mon3_pelt', '#4e3a2a', { tex: 'fur', hs: 12 });
mat('mon3_taproot', '#6a5236', { tex: 'bark', hs: 12 });
