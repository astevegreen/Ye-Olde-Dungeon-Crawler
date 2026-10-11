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

// ---- companions and townsfolk
mat('ally_furWar', '#62656f', { tex: 'fur', hs: 10 });
mat('ally_furWarDark', '#3d3f49', { tex: 'fur', hs: 10 });
mat('ally_furWarPale', '#a9abb2', { tex: 'fur', hs: 8 });
mat('ally_furFrost', '#93a8bf', { tex: 'fur', hs: 8 });
mat('ally_furFrostDark', '#677d96', { tex: 'fur', hs: 8 });
mat('ally_furFrostPale', '#cfdeeb', { tex: 'fur', hs: 6 });
mat('ally_furRust', '#9a5333', { tex: 'fur' });
mat('ally_furRustDark', '#4e281e', { tex: 'fur' });
mat('ally_furRustPale', '#cfa67b', { tex: 'fur' });
mat('ally_nose', '#2b2427', { shiny: true });
mat('ally_breath', '#e2f6ff', { a: 0.72, hs: 4 });
mat('ally_mailDark', '#5b6170', { shiny: true, tex: 'mail', hs: 8 });
mat('ally_collar', '#8a4f2c', { hs: 14 });
mat('ally_indigo', '#41458a', { tex: 'cloth' });
mat('ally_indigoDark', '#2b2d5e', { tex: 'cloth' });
mat('ally_hairWhite', '#dddcd3', { hs: 6 });
mat('ally_hairAsh', '#bcae86', { hs: 10 });
mat('ally_hairAshDark', '#7e7058', { hs: 10 });
mat('ally_skinWeather', '#b67f5d', { hs: 14 });
mat('ally_skinIron', '#8c919c', { hs: 8 });
mat('ally_skinBald', '#c08868', { hs: 14, shiny: true });
mat('ally_soot', '#6b5045', { tex: 'rot', hs: 12 });
mat('ally_shirt', '#4a4a52', { tex: 'cloth' });
mat('ally_glass', '#a8c4d0', { a: 0.55, shiny: true });
mat('ally_ochre', '#a07a2e', { tex: 'cloth' });
mat('ally_ochreDark', '#6e5222', { tex: 'cloth' });
mat('ally_tallow', '#e6dab2', { hs: 8 });
mat('ally_teal', '#2f5c5c', { tex: 'cloth' });
mat('ally_tealDark', '#1e3d42', { tex: 'cloth' });
mat('ally_hairAuburn', '#8c4226', { hs: 12 });
mat('ally_elixir', '#f6c64a', { em: true, hs: 0 });
mat('ally_vapour', '#f4e8c4', { a: 0.6, hs: 4 });
mat('ally_robeWhite', '#d6d1c4', { tex: 'cloth', hs: 8 });
mat('ally_wine', '#6c2636', { tex: 'cloth' });
mat('ally_wineDark', '#451a28', { tex: 'cloth' });
mat('ally_shieldBlue', '#3b5888', { hs: 10 });
mat('ally_hairBrown', '#6a4a30', { hs: 12 });
mat('ally_horn', '#d8b070', { a: 0.6, shiny: true, hs: 8 });
// the raid's villagers, the gate-ward and the Siphon Altar's captives (villagers.ts)
mat('vil_mantle', '#6c88a2', { tex: 'cloth' });
mat('vil_herb', '#5f8a46', { hs: 12 });
mat('vil_clay', '#a5674a', { hs: 12 });
mat('vil_madder', '#985757', { tex: 'cloth' });
mat('vil_madderDark', '#663a3c', { tex: 'cloth' });
mat('vil_flour', '#ddd7c7', { tex: 'cloth', hs: 8 });
mat('vil_fleece', '#e0dacb', { tex: 'fur', hs: 8 });
mat('vil_yarn', '#cdbf9c', { hs: 8 });
mat('vil_frost', '#cfeefa', { shiny: true, tex: 'ice', hs: 6 });

// ---- items (wave 6): only material or element colour; alignment is the aura's job
mat('item_glass', '#a3bccb', { shiny: true, a: 0.78, hs: 8 });
mat('item_glint', '#f6fbff', { em: true, hs: 0 });
mat('item_heal', '#b9342c', { shiny: true, hs: 10 });
mat('item_mana', '#3d68d6', { shiny: true, hs: 10 });
mat('item_mead', '#d9a53c', { shiny: true, hs: 10 });
mat('item_stew', '#6e4a2c', { tex: 'rot', hs: 12 });
mat('item_parch', '#d6c49a', { tex: 'cloth', hs: 10 });
mat('item_ink', '#4a3a30', { hs: 8 });
mat('item_twine', '#a08a62', { hs: 8 });
mat('item_tar', '#3e2c22', { hs: 8 });
mat('item_frost', '#c6d3dc', { shiny: true, hs: 6 });
mat('item_slab', '#6d717b', { hs: 8 });
mat('item_herb', '#5f6b3e', { hs: 10 });
mat('item_ironwood', '#5f574d', { tex: 'rot', hs: 10 });
mat('item_birch', '#d9d3c5', { hs: 8 });
mat('item_ash', '#a08660', { hs: 12 });
mat('item_copper', '#b4693c', { shiny: true });
mat('item_crystal', '#d6dee4', { shiny: true, hs: 6 });
mat('item_amber', '#e0992e', { shiny: true, a: 0.95 });
mat('item_fang', '#ddd3b2', { hs: 12 });
mat('item_fangRoot', '#a08a5e', { hs: 12 });
mat('item_sunglass', '#f2d488', { shiny: true, hs: 6 });
mat('item_suncore', '#fff4cc', { em: true, hs: 0 });
mat('item_crust', '#9c6538', { hs: 14 });
mat('item_crumb', '#e2cb98', { hs: 10 });
mat('item_pitch', '#3b302a', { tex: 'cloth', hs: 10 });
mat('item_paint', '#3e5b88', { tex: 'cloth' });
mat('item_void', '#16171d', { hs: 6 });

// ---- relics (wave 8): each relic's own stuff; colour is its material or element, never its alignment
mat('relic_prism', '#dde8ee', { shiny: true, hs: 6 }); // the Sól-Shard's clear cut crystal
mat('relic_sun', '#ffaa36', { em: true, hs: 0 }); // a coin of sun-chariot glare caught in it
mat('relic_petri', '#7a6c5c', { tex: 'bark', hs: 12 }); // World-Bark turned to stone
mat('relic_petriDeep', '#4a4038', { tex: 'bark', hs: 12 }); // its fissures, knot and roots
mat('relic_quartz', '#d8e0dc', { shiny: true, hs: 6 }); // quartz grown in the cracks
mat('relic_sap', '#c4e05a', { em: true, hs: 0 }); // the World-Tree's sap, still alive in the knot
mat('relic_mask', '#d8ceb4', { tex: 'wood', hs: 10 }); // Iviðja's mask (boss_mask) up close: bleached wood
mat('relic_dragonBone', '#c4b48e', { tex: 'rot', hs: 12 }); // a pitted dragon vertebra
mat('relic_marrow', '#3a2c26', { hs: 10 }); // the marrow stain in its channel
mat('relic_rootRot', '#3c4230', { shiny: true, tex: 'bark', hs: 12 }); // a world-root's corruption, wet
mat('relic_lodestone', '#3a3c42', { shiny: true, tex: 'stone', hs: 10 }); // magnetite

// ---- fixtures (wave 8): altars, portals, the siphon, chests and loot heaps
mat('fix_weathered', '#6f6c66', { tex: 'stone', hs: 10 }); // Tyr: old grey stone
mat('fix_paleStone', '#8e9199', { tex: 'stone', hs: 10 }); // Urðr's basin
mat('fix_blackStone', '#3c3a46', { tex: 'stone', hs: 10 }); // Hel, the siphon
mat('fix_ravenStone', '#454a58', { tex: 'stone', hs: 8 });
mat('fix_serpent', '#5a6a4c', { tex: 'scale', hs: 14 });
mat('fix_helFlesh', '#434a66', { tex: 'rot', hs: 10 }); // Hel's dead half
mat('fix_bloodDry', '#5c1a1c', { hs: 6 });
mat('fix_bloodPool', '#7a121c', { shiny: true, hs: 6 });
mat('fix_rawWood', '#b09062', { tex: 'wood', hs: 12 }); // the fresh split in the root
mat('fix_chestIn', '#2b2019', { hs: 10 });
mat('fix_plank', '#7e5a39', { tex: 'cloth', hs: 14 });
mat('fix_plankDark', '#4f3a2a', { tex: 'cloth', hs: 14 });
mat('fix_glass', '#3f7a62', { shiny: true, a: 0.94, hs: 10 });
mat('fix_water', '#20324c', { hs: 8 });
// fixture light
mat('fix_coldIron', '#c4d8ff', { em: true, hs: 0 });
mat('fix_goldWhite', '#ffe8a8', { em: true, hs: 0 });
mat('fix_silver', '#dde8ff', { em: true, hs: 0 });
mat('fix_starWater', '#3b5f96', { em: true, hs: 0 });
mat('fix_star', '#f4f8ff', { em: true, hs: 0 });
mat('fix_rootGlow', '#a7b83a', { em: true, hs: 0 }); // sickly green-gold
mat('fix_rootCore', '#f2f1a6', { em: true, hs: 0 });
mat('fix_dawn', '#ffdf96', { em: true, hs: 0 }); // the Path of Light
mat('fix_dawnCore', '#fffaf0', { em: true, hs: 0 });
mat('fix_crystal', '#9558ee', { em: true, hs: 0 });
mat('fix_crystalCore', '#efe2ff', { em: true, hs: 0 });
// Loki's rune, one hue per frame (altar.ts's CHAOS lights match)
mat('fix_chaos0', '#e05cff', { em: true, hs: 0 });
mat('fix_chaos1', '#6f8cff', { em: true, hs: 0 });
mat('fix_chaos2', '#35e0c8', { em: true, hs: 0 });
mat('fix_chaos3', '#f2dc5a', { em: true, hs: 0 });
// the siphon stream, blood turning violet as it rises
mat('fix_sip0', '#c21c2e', { em: true, hs: 0 });
mat('fix_sip1', '#c4245a', { em: true, hs: 0 });
mat('fix_sip2', '#b8348a', { em: true, hs: 0 });
mat('fix_sip3', '#a444c4', { em: true, hs: 0 });
mat('fix_sip4', '#a868ff', { em: true, hs: 0 });

// ---- shrines (wave 8): the Norns' loom and mirror, Ratatoskr's roost, the duergar barrows, the skaldic runestones
// Verðandi's loom
mat('alt_heartwood', '#6e5434', { tex: 'bark', hs: 12 }); // living heartwood boughs
mat('alt_leaf', '#6c9444', { hs: 12 });
mat('alt_weave', '#b39a6a', { tex: 'cloth', hs: 10 }); // the woven web
mat('alt_rot', '#2f2b25', { tex: 'rot', hs: 8 }); // blackened fungal rot
mat('alt_fungus', '#c7b088', { hs: 10 });
mat('alt_sap', '#e2a63a', { em: true, hs: 0 }); // golden sap on the warp
// Skuld's mirror
mat('alt_obsidian', '#25212e', { shiny: true, hs: 8 }); // volcanic glass (also the Stolen Dawn stone)
mat('alt_sheen', '#9a96b4', { a: 0.8, hs: 6 }); // a reflection streak on the glass
mat('alt_frostBone', '#d6d6cc', { hs: 10 }); // dragon ribs, frost-carved
mat('alt_rime', '#e4f2fa', { shiny: true, tex: 'ice', hs: 4 });
mat('alt_omenGreen', '#3ccf8c', { em: true, hs: 0 }); // the portent of renewal
mat('alt_omenRed', '#e44a3a', { em: true, hs: 0 }); // the portent of Ragnarök
// Ratatoskr's roost
mat('alt_worldBark', '#5f5749', { tex: 'bark', hs: 10 }); // Yggdrasil's grey bark (also the Norns' runestone)
mat('alt_hollow', '#1d1510', { hs: 6 });
mat('alt_moss', '#5e7c3a', { tex: 'fur', hs: 12 });
mat('alt_squirrel', '#b5562a', { tex: 'fur', hs: 14 }); // rust-red
mat('alt_squirrelBelly', '#e2c69c', { tex: 'fur', hs: 10 });
mat('alt_cone', '#7c5734', { tex: 'scale', hs: 12 });
mat('alt_pebble', '#aaa79e', { shiny: true, hs: 8 });
mat('alt_riverGlass', '#5aa6c4', { shiny: true, a: 0.92, hs: 8 });
mat('alt_amber', '#ffb24c', { em: true, hs: 0 }); // the messenger's rune, sap-amber
// the duergar barrows
mat('alt_barrowStone', '#78726a', { tex: 'stone', hs: 10 }); // dressed stone
mat('alt_sealStone', '#5c5852', { tex: 'stone', hs: 10 });
mat('alt_wight', '#b4f0d0', { em: true, hs: 0 }); // the barrow's rune: wight-light, a warning
mat('alt_ember', '#ff7a36', { em: true, hs: 0 }); // the Smithy's Accord stone's rune
// the skaldic runestones: each chapter's stone, and the paint in its carved band
mat('alt_rimeStone', '#7e8b99', { tex: 'stone', hs: 8 });
mat('alt_sootStone', '#3c3838', { tex: 'stone', hs: 8 });
mat('alt_veinStone', '#545862', { tex: 'stone', hs: 8 });
mat('alt_silverVein', '#d6deea', { shiny: true, hs: 6 });
mat('alt_mercury', '#c9d2de', { shiny: true, hs: 4 });
mat('alt_paintRime', '#c2d6e4', { hs: 6 });
mat('alt_paintOchre', '#8e3a26', { hs: 10 }); // red ochre, as the old stones were painted
mat('alt_paintViolet', '#5c4c80', { hs: 10 });
mat('alt_bolt', '#d8b4ff', { em: true, hs: 0 }); // the Twilight stone's lightning
// ---- portraits: each one's ground is an emissive dark material drawn in flat ink bands
mat('scr_gDraugr', '#2c3a4e', { em: true, hs: 14 });
mat('scr_gMimir', '#262850', { em: true, hs: 12 });
mat('scr_haloMimir', '#34509a', { em: true, hs: 10 });
mat('scr_gNid', '#1c2d1b', { em: true, hs: 14 });
// the draugr, moonlit: cold lights
mat('scr_corpse', '#7c8c99', { hs: 10, warm: 200 });
mat('scr_rustMail', '#5c5f66', { shiny: true, tex: 'mail', hs: 8, warm: 200 });
mat('scr_helm', '#50545c', { shiny: true, tex: 'rot', hs: 10, warm: 200 });
mat('scr_cloakDark', '#353c4a', { tex: 'cloth', hs: 12, warm: 210 });
mat('scr_rust', '#6e4630', { tex: 'rot', hs: 12 });
mat('scr_bronzeOld', '#86683f', { shiny: true, hs: 12 });
mat('scr_blade', '#8b939c', { shiny: true, hs: 8, warm: 200 });
mat('scr_beard', '#aab3bc', { hs: 6, warm: 200 });
mat('scr_gum', '#2a2030');
mat('scr_rime', '#a9c6d6', { shiny: true, tex: 'ice', hs: 6, warm: 190 });
// Mímir
mat('scr_indigo', '#252a55', { tex: 'cloth', hs: 12 });
mat('scr_oldSkin', '#8f766c', { hs: 12 });
mat('scr_beardW', '#9ea3aa', { hs: 6, warm: 210 });
mat('scr_milk', '#c3ccd1', { shiny: true, hs: 6 });
mat('scr_water', '#3b77a0', { shiny: true, tex: 'ice', hs: 8 });
mat('scr_hornTip', '#4e4234', { hs: 10 });
// Níðhögg: its scales drawn one by one (the scale texture reads as stripes at this size)
mat('scr_scaleBlack', '#2f3440', { hs: 18 });
mat('scr_maw', '#1d2a17');
mat('scr_fang', '#d8d1b8', { hs: 10 });
mat('scr_root', '#5a4630', { tex: 'bark' });
mat('scr_splinter', '#b39a6a', { tex: 'wood' });
mat('scr_hornRoot', '#2a241d', { tex: 'bark', hs: 14 });
mat('scr_wing', '#302c36', { hs: 12 });
mat('scr_bellyDark', '#27321f', { hs: 10 });
// ---- wave 9b portraits: Gálmr, the Sun-Chariot Warden, Glóð (portraitsFrostFire.ts)
mat('scr_gGalmr', '#1b3040', { em: true, hs: 14 });
mat('scr_galmrHide', '#586c82', { hs: 10, warm: 200 });
mat('scr_galmrBeard', '#a3b6c6', { hs: 8, warm: 200 });
mat('scr_galmrFur', '#5a5e6a', { tex: 'fur', hs: 10, warm: 200 });
mat('scr_galmrRime', '#d4eaf4', { shiny: true, hs: 6, warm: 190 });
mat('scr_galmrIce', '#86c4de', { shiny: true, hs: 8, warm: 190 });
mat('scr_galmrMaw', '#141c28', { hs: 8 });
mat('scr_galmrShade', '#2c3a4c', { hs: 10, warm: 200 });
mat('scr_galmrTooth', '#b9c2c4', { hs: 8, warm: 200 });
mat('scr_galmrBreath', '#d8f2fb', { a: 0.5, hs: 4 });
mat('scr_gChariot', '#2e1d15', { em: true, hs: 16 });      // the dwarven forge, soot and ember
mat('scr_chariotIron', '#5e6674', { hs: 10 }); // riveted construct iron
mat('scr_chariotSun', '#ffe0a0', { em: true, hs: 0 });     // the stolen sun-disc
mat('scr_chariotSunWhite', '#fffaf0', { em: true, hs: 0 });
mat('scr_chariotHeat', '#ffcf86', { a: 0.35, hs: 0 });     // heat shimmer
mat('scr_chariotMaw', '#1c1310', { hs: 6 });
mat('scr_gGlod', '#261922', { em: true, hs: 16 });          // obsidian and smoke, violet-black
mat('scr_glodCrust', '#3a2f2e', { tex: 'stone', hs: 12 });  // cooling magma crust
mat('scr_glodCrustDark', '#2a2023', { hs: 10 });            // the deep crust, the cracks' walls
mat('scr_glodMaw', '#170c0a', { hs: 6 });
// Gloom-Tarr, Svartr, the Root-Bound Berserker (portraitsRot.ts)
mat('scr_gTarr', '#2b3139', { em: true, hs: 14 });
mat('scr_tarrHide', '#262d27', { hs: 16 });              // wet tar
mat('scr_tarrMaw', '#160f14', { hs: 4 });
mat('scr_tarrPool', '#203519', { em: true, hs: 10 });    // the bile, pooled black
mat('scr_tarrBile', '#7fc040', { em: true, hs: 0 });     // the bile where it glows
mat('scr_tarrGlass', '#3a3a34', { shiny: true, hs: 6 }); // the snuffed lantern's glass
mat('scr_tarrSmoke', '#7b8088', { a: 0.5, hs: 4 });
mat('scr_gSvartr', '#2b2236', { em: true, hs: 14 });
mat('scr_svartrSkin', '#666d69', { hs: 5 });                 // undead troll hide
mat('scr_svartrRoot', '#4d4038', { tex: 'bark', hs: 12 });  // the rotten taproot she is grown into
mat('scr_svartrCrown', '#8a7a68', { tex: 'bark', hs: 10 }); // her crown of dead roots
mat('scr_svartrSap', '#17141d', { hs: 6 });                 // black sap
mat('scr_gBerserker', '#1e2c2b', { em: true, hs: 14 });
mat('scr_bsSkin', '#7b7362', { hs: 10 });                   // a dead man's skin
mat('scr_bsSteel', '#7a828a', { hs: 8 });                   // his axe, old steel
mat('scr_bsPelt', '#4e3a2a', { tex: 'fur', hs: 12 });       // the bear-shirt
mat('scr_bsRoot', '#6a5236', { tex: 'bark', hs: 12 });      // the taproots that hold him
mat('scr_bsSap', '#cddc52', { em: true, hs: 0 });           // their sap
// Víðnir, Sköll, the Malice-Weaver (portraitsMaw.ts)
mat('scr_gVidnir', '#3a2b26', { em: true, hs: 14 });
mat('scr_vidnirScale', '#4b6a58', { hs: 14, warm: 170 });
mat('scr_vidnirMantle', '#363940', { tex: 'cloth', hs: 12 });
mat('scr_vidnirBanner', '#6a5232', { tex: 'cloth', hs: 14 });
mat('scr_vidnirIvory', '#a39d8a', { hs: 8, warm: 190 });
mat('scr_vidnirThroat', '#8a8c76', { hs: 10, warm: 170 });
mat('scr_gSkoll', '#2a2536', { em: true, hs: 12 });
mat('scr_skollCorona', '#8e8aa6', { em: true, hs: 8 });
mat('scr_skollHide', '#4a4556', { tex: 'fur', hs: 10 });
mat('scr_skollBone', '#a29e96', { hs: 8, warm: 240 });
mat('scr_skollVoidBone', '#2c2240', { hs: 8 });
mat('scr_skollSocket', '#160f1e');
mat('scr_gWeaver', '#202630', { em: true, hs: 12 });
mat('scr_weaverChitin', '#4e4b62', { hs: 10 });
mat('scr_weaverBrain', '#78acff', { em: true, hs: 6 });
mat('scr_weaverFold', '#2c4aa6', { em: true, hs: 6 });
mat('scr_weaverEye', '#0b1020', { hs: 6 });
// Iviðja, the Ironwood Troll-Wife, the Hel Warden (portraitsIronwoodHel.ts)
mat('scr_gIvidja', '#1f2b25', { em: true, hs: 14 });
mat('scr_gTrollWife', '#2b2129', { em: true, hs: 12 });
mat('scr_haloTrollWife', '#5a2230', { em: true, hs: 8 });
mat('scr_gHelWarden', '#2a2636', { em: true, hs: 12 });
mat('scr_ividjaMask', '#d2c6a8', { hs: 10 });
mat('scr_ividjaAntler', '#a0937a', { hs: 10 });
mat('scr_ividjaSkin', '#626d59', { hs: 10 });
mat('scr_ironwoodMoss', '#5d7642', { tex: 'fur', hs: 12 });
mat('scr_ironwoodMossDark', '#3e5232', { tex: 'fur', hs: 12 }); // the Ironwood witches' mantles of moss
mat('scr_trollWifeSkin', '#93845f', { hs: 12 });
mat('scr_trollWifeHair', '#8a9098', { tex: 'fur', hs: 8 });
mat('scr_trollWifeDress', '#574b46', { tex: 'cloth', hs: 12 });
mat('scr_trollWifeBlood', '#d8323c', { em: true, hs: 0 });
mat('scr_helWardenIron', '#4c5269', { shiny: true, hs: 12 });
mat('scr_helWardenCloth', '#474462', { tex: 'cloth', hs: 12 });
mat('scr_helWardenRot', '#7c8170', { tex: 'rot', hs: 10 });
// Olaf, Astrid, Haakon (portraitsTraders.ts)
mat('scr_olafGround', '#3a2a1e', { em: true, hs: 14 });
mat('scr_olafHalo', '#6a4224', { em: true, hs: 10 });
mat('scr_olafSkin', '#c48d6a', { hs: 14 });
mat('scr_olafRuddy', '#c27a62', { hs: 10 });
mat('scr_olafBeard', '#c2a062', { hs: 12 });
mat('scr_olafHat', '#7b5b40', { tex: 'fur', hs: 12 });
mat('scr_olafBrim', '#a77c48', { tex: 'fur', hs: 12 });
mat('scr_olafTunic', '#a07a2e', { tex: 'cloth', hs: 12 });
mat('scr_olafScarf', '#8c4329', { tex: 'cloth', hs: 12 });
mat('scr_olafMouth', '#3a1814', { hs: 6 });
mat('scr_olafTeeth', '#e4d8bc', { hs: 6 });
mat('scr_olafEye', '#2a1a16', { hs: 6 });
mat('scr_olafIron', '#3b404b', { shiny: true, hs: 10 });
mat('scr_olafPane', '#e89a46', { em: true, hs: 4 });
mat('scr_olafTallow', '#e6dab2', { hs: 8 });
mat('scr_astridGround', '#1c3033', { em: true, hs: 14 });
mat('scr_astridHalo', '#5a5426', { em: true, hs: 10 });
mat('scr_astridSkin', '#dcb8a0', { hs: 12 });
mat('scr_astridHair', '#8c4226', { hs: 12 });
mat('scr_astridGown', '#2f5c5c', { tex: 'cloth', hs: 12 });
mat('scr_astridShawl', '#1e3d42', { tex: 'cloth', hs: 12 });
mat('scr_astridLip', '#a8564c', { hs: 8 });
mat('scr_astridWhite', '#e8ded2', { hs: 6 });
mat('scr_astridIris', '#5b7a4c', { hs: 8 });
mat('scr_astridLash', '#2a1814', { hs: 6 });
mat('scr_astridGlass', '#a8c4d0', { shiny: true, hs: 6 });
mat('scr_astridElixir', '#f6c64a', { em: true, hs: 0 });
mat('scr_astridSteam', '#f4e8c4', { em: true, hs: 4 });
mat('scr_astridFrost', '#86cce0', { shiny: true, hs: 6 });
mat('scr_astridVenom', '#6faa3a', { shiny: true, hs: 8 });
mat('scr_astridRune', '#4c7ed2', { shiny: true, hs: 8 });
mat('scr_haakonGround', '#2a1d26', { em: true, hs: 14 });
mat('scr_haakonHalo', '#5e4426', { em: true, hs: 10 });
mat('scr_haakonSkin', '#cfa88e', { hs: 12 });
mat('scr_haakonHair', '#a8a49c', { hs: 8 });
mat('scr_haakonCoat', '#6c2636', { tex: 'cloth', hs: 12 });
mat('scr_haakonCoatDark', '#451a28', { tex: 'cloth', hs: 12 });
mat('scr_haakonFur', '#7b5b40', { tex: 'fur', hs: 12 });
mat('scr_haakonWhite', '#d4c8b6', { hs: 6 });
mat('scr_haakonIris', '#55687a', { hs: 8 });
mat('scr_haakonEye', '#1e1618', { hs: 6 });
mat('scr_haakonLamp', '#4a3f38', { hs: 10 });
mat('scr_haakonCounter', '#4d3826', { tex: 'wood', hs: 12 });
// Gunther, Thrain, Ivalda (portraitsForge.ts)
mat('scr_gGunther', '#3a2a25', { em: true, hs: 12 });
mat('scr_guntherHalo', '#6a361c', { em: true, hs: 6 });
mat('scr_gThrain', '#232a3a', { em: true, hs: 12 });
mat('scr_thrainHalo', '#2c4a8e', { em: true, hs: 8 });
mat('scr_gIvalda', '#251d1d', { em: true, hs: 12 });
mat('scr_ivaldaHalo', '#5a2a16', { em: true, hs: 6 });
mat('scr_guntherScalp', '#b98064', { shiny: true, hs: 14 });
mat('scr_guntherSkin', '#b98064', { hs: 14 });
mat('scr_guntherFlush', '#b06a54', { hs: 12 });
mat('scr_guntherBrow', '#4a2c1e', { hs: 10 });
mat('scr_guntherBeard', '#9c4428', { hs: 12 });
mat('scr_guntherShirt', '#424250', { tex: 'cloth', hs: 12 });
mat('scr_guntherApron', '#74503a', { hs: 14 });
mat('scr_guntherStrap', '#4a3326', { hs: 14 });
mat('scr_guntherSoot', '#5e4a44', { tex: 'rot', hs: 12 });
mat('scr_guntherDark', '#1d1416');
mat('scr_thrainSkin', '#bf8868', { hs: 14 });
mat('scr_thrainFlush', '#b46c58', { hs: 12 });
mat('scr_thrainHood', '#5a3c2b', { hs: 14 });
mat('scr_thrainBeard', '#2c2422', { hs: 10 });
mat('scr_thrainTunic', '#7e3e2e', { tex: 'cloth', hs: 12 });
mat('scr_thrainApron', '#6a4834', { hs: 14 });
mat('scr_thrainDark', '#140d0f');
mat('scr_ivaldaSkin', '#727888', { hs: 8 });
mat('scr_ivaldaHair', '#dcdee4', { hs: 10 });
mat('scr_ivaldaHairDk', '#5e606e', { hs: 8 });
mat('scr_ivaldaWarm', '#8a6f6a', { hs: 8 });
mat('scr_ivaldaPlate', '#34363e', { hs: 10 });
mat('scr_ivaldaMail', '#4e5462', { shiny: true, tex: 'mail', hs: 8 });
mat('scr_ivaldaApron', '#463226', { hs: 14 });
mat('scr_ivaldaDark', '#101116');
mat('scr_ivaldaCoal', '#ee6a2a', { em: true, hs: 0 });
mat('scr_ivaldaAsh', '#4a4442', { tex: 'stone', hs: 8 });
// Father Torvald, Bjorn (portraitsTempleGate.ts)
mat('scr_gTorvald', '#272c38', { em: true, hs: 12 }); // the hall, storm-dark
mat('scr_haloTorvald', '#b8b084', { em: true, hs: 2 }); // the lightning's halo
mat('scr_gTorvaldPillar', '#3a2f28', { em: true, hs: 12 }); // a carved high-seat pillar
mat('scr_torvaldSkin', '#c08a68', { hs: 14 });
mat('scr_torvaldHair', '#3e2e26', { hs: 12 });
mat('scr_torvaldRobe', '#d6d1c4', { hs: 8 });
mat('scr_torvaldStole', '#7c2e26', { tex: 'cloth', hs: 12 });
mat('scr_torvaldGold', '#d9a93a', { shiny: true });
mat('scr_torvaldIron', '#4a505c', { em: true, hs: 10 }); // the hammer's head, dark against its own lightning
mat('scr_torvaldHaft', '#4d3826', { tex: 'wood' });
mat('scr_torvaldIris', '#2a3444', { hs: 8 });
mat('scr_torvaldWhite', '#d2ccbe', { hs: 6 });
mat('scr_torvaldMouth', '#2a1a18');
mat('scr_torvaldBolt', '#fff4b8', { em: true, hs: 0 });
mat('scr_torvaldBlessing', '#ffe2a0', { em: true, hs: 0 });
mat('scr_gBjorn', '#29241f', { em: true, hs: 12 }); // the gatehouse timbers at night
mat('scr_haloBjorn', '#6e4024', { em: true, hs: 6 }); // the torch's halo, ember
mat('scr_gBjornStone', '#3a3936', { em: true, hs: 8 }); // the cellar arch
mat('scr_bjornPit', '#100d10', { em: true, hs: 6 }); // the dark below
mat('scr_bjornSkin', '#c08868', { hs: 14 });
mat('scr_bjornBeard', '#6a4a30', { hs: 12 });
mat('scr_bjornHelm', '#666e7c', { shiny: true, hs: 10 });
mat('scr_bjornBronze', '#9c7444', { shiny: true, hs: 12 });
mat('scr_bjornMail', '#7f8896', { tex: 'mail', hs: 8 });
mat('scr_bjornCloak', '#4c6189', { tex: 'cloth', hs: 12 });
mat('scr_bjornShield', '#3b5888', { hs: 10 });
mat('scr_bjornBoneHalf', '#b8ae96', { hs: 10 });
mat('scr_bjornShaft', '#7a5a3a', { tex: 'wood' });
mat('scr_bjornTorch', '#4d3826', { tex: 'wood' });
mat('scr_bjornTorchWrap', '#4a3426', { em: true, hs: 10 }); // pitch-black rags: emissive so the flame's own light cannot wash them out
mat('scr_bjornSteel', '#97a2b2', { shiny: true, hs: 10 });
mat('scr_bjornIris', '#3a3a3c', { hs: 8 });
mat('scr_bjornWhite', '#d0c8b8', { hs: 6 });
mat('scr_bjornMouth', '#2a1a16');
mat('scr_bjornFlame', '#ff8a2c', { em: true, hs: 0 });
mat('scr_bjornFlameCore', '#ffd27a', { em: true, hs: 0 });
// Ranvild, the Frost-Ward Hound and the Ember-Fang Wolf (portraitsKennel.ts)
mat('scr_gRanvild', '#29323a', { em: true, hs: 12 });
mat('scr_ranvildSkin', '#b98060', { hs: 14 });
mat('scr_ranvildScar', '#d9b0a0', { hs: 8 });
mat('scr_ranvildWhite', '#d2ccc2', { hs: 6 });
mat('scr_ranvildIris', '#46606e', { hs: 8 });
mat('scr_ranvildLip', '#9a5c4c', { hs: 12 });
mat('scr_ranvildMouth', '#3a201c');
mat('scr_ranvildHair', '#b4a888', { hs: 10 });
mat('scr_ranvildHairDark', '#786c58', { hs: 10 });
mat('scr_ranvildFur', '#76716a', { tex: 'fur', hs: 10 });
mat('scr_ranvildFurDark', '#46423e', { tex: 'fur', hs: 10 });
mat('scr_ranvildFurPale', '#a8a296', { tex: 'fur', hs: 8 });
mat('scr_ranvildWool', '#4c6a3e', { tex: 'cloth' });
mat('scr_ranvildLeather', '#7c5438', { hs: 14 });
mat('scr_ranvildLead', '#8a4f2c', { hs: 14 });
mat('scr_gFrostHound', '#1f2a3b', { em: true, hs: 12 });
mat('scr_gEmberWolf', '#2b201d', { em: true, hs: 10 });
mat('scr_frostFur', '#a0aab6', { tex: 'fur', hs: 4 });
mat('scr_frostFurDark', '#66717f', { tex: 'fur', hs: 4 });
mat('scr_frostFurPale', '#dde4ea', { tex: 'fur', hs: 3 });
mat('scr_frostMask', '#3e4654', { tex: 'fur', hs: 4 });
mat('scr_frostChin', '#dde4ea', { tex: 'fur', hs: 3 });
mat('scr_frostRim', '#2c3a50', { hs: 8 });
mat('scr_frostEye', '#8be4ff', { em: true, hs: 0 });
mat('scr_frostMist', '#c4dde6', { em: true, hs: 2 });
mat('scr_emberFur', '#9a5333', { tex: 'fur' });
mat('scr_emberFurDark', '#4e281e', { tex: 'fur' });
mat('scr_emberFurPale', '#cfa67b', { tex: 'fur' });
mat('scr_emberChin', '#cfa67b', { tex: 'fur' });
mat('scr_emberRim', '#2a1612', { hs: 8 });
mat('scr_emberEye', '#ffa03c', { em: true, hs: 0 });
mat('scr_houndNose', '#2b2427', { shiny: true });
mat('scr_houndMouth', '#1a1012');
mat('scr_houndGum', '#4e2c2e', { hs: 8 });
mat('scr_houndCollar', '#8a4f2c', { hs: 14 });
// the villagers who come home to Bjarnarhaven (portraitsVillagers.ts): their map sprites' colours
// Eir the Acolyte, by the temple's lamp
mat('scr_gEir', '#1f2632', { em: true, hs: 12 });
mat('scr_eirHalo', '#6a5a2e', { em: true, hs: 6 });
mat('scr_eirSkin', '#dcc0ac', { hs: 12 });
mat('scr_eirBlush', '#cf9a86', { hs: 10 });
mat('scr_eirHair', '#3e2e26', { hs: 12 });
mat('scr_eirBand', '#d8cfb6', { tex: 'cloth', hs: 8 });
mat('scr_eirRobe', '#d6d1c4', { tex: 'cloth', hs: 8 });
mat('scr_eirMantle', '#6c88a2', { tex: 'cloth', hs: 12 });
mat('scr_eirHerb', '#5f8a46', { hs: 12 });
mat('scr_eirFlower', '#e8d36a', { hs: 8 });
mat('scr_eirClay', '#a5674a', { hs: 12 });
mat('scr_eirWhite', '#e6dccf', { hs: 6 });
mat('scr_eirIris', '#56708c', { hs: 8 });
mat('scr_eirLash', '#2a1c18', { hs: 6 });
mat('scr_eirLip', '#b46c60', { hs: 8 });
mat('scr_eirFlame', '#ffc95a', { em: true, hs: 0 });
mat('scr_eirFlameCore', '#fff2c4', { em: true, hs: 0 });
// Sigrun, Olaf's daughter, by her candle in his store
mat('scr_gSigrun', '#2e201c', { em: true, hs: 12 });
mat('scr_sigrunHalo', '#6e3c1e', { em: true, hs: 6 });
mat('scr_sigrunSkin', '#c99274', { hs: 14 });
mat('scr_sigrunRuddy', '#c8705a', { hs: 10 });
mat('scr_sigrunHair', '#c7a35e', { hs: 12 });
mat('scr_sigrunScarf', '#8c3328', { tex: 'cloth', hs: 12 });
mat('scr_sigrunDress', '#985757', { tex: 'cloth', hs: 12 });
mat('scr_sigrunApron', '#b8ae96', { tex: 'cloth', hs: 10 });
mat('scr_sigrunWhite', '#ece2d6', { hs: 6 });
mat('scr_sigrunIris', '#4f7092', { hs: 8 });
mat('scr_sigrunLash', '#3a2418', { hs: 6 });
mat('scr_sigrunMouth', '#4a1e1a', { hs: 6 });
mat('scr_sigrunTeeth', '#eadfc6', { hs: 6 });
mat('scr_sigrunTallow', '#e6dab2', { hs: 8 });
// Brandr the Apprentice, by Gunther's forge
mat('scr_gBrandr', '#261f1c', { em: true, hs: 12 });
mat('scr_brandrHalo', '#6e3418', { em: true, hs: 6 });
mat('scr_brandrCoal', '#ff7a2a', { em: true, hs: 0 });
mat('scr_brandrRimeHalo', '#3e6670', { em: true, hs: 6 });
mat('scr_brandrSkin', '#c48d6a', { hs: 14 });
mat('scr_brandrFreckle', '#a8664a', { hs: 10 });
mat('scr_brandrHair', '#a3492c', { hs: 12 });
mat('scr_brandrShirt', '#4a4a52', { tex: 'cloth', hs: 12 });
mat('scr_brandrApron', '#7c5438', { hs: 14 });
mat('scr_brandrStrap', '#4f3627', { hs: 14 });
mat('scr_brandrSoot', '#5e4a44', { tex: 'rot', hs: 12 });
mat('scr_brandrWhite', '#e8ddd0', { hs: 6 });
mat('scr_brandrIris', '#6a5a36', { hs: 8 });
mat('scr_brandrLash', '#2e1a14', { hs: 6 });
mat('scr_brandrMouth', '#401a16', { hs: 6 });
mat('scr_brandrTeeth', '#e8dcc4', { hs: 6 });
mat('scr_brandrSteel', '#97a2b2', { shiny: true, hs: 10 });
mat('scr_brandrRime', '#cfeefa', { shiny: true, tex: 'ice', hs: 6 });
mat('scr_brandrHandle', '#7a5a3a', { tex: 'wood' });
// Ingrid of the Mill, in the light of the mill door
mat('scr_gIngrid', '#2a2620', { em: true, hs: 10 });
mat('scr_ingridShaft', '#625c48', { em: true, hs: 6 });
mat('scr_ingridSkin', '#c68c6a', { hs: 14 });
mat('scr_ingridRuddy', '#c27a62', { hs: 10 });
mat('scr_ingridKerchief', '#d6cebb', { tex: 'cloth', hs: 10 });
mat('scr_ingridHair', '#6a4a30', { hs: 12 });
mat('scr_ingridDress', '#6e5640', { tex: 'cloth', hs: 12 });
mat('scr_ingridFlour', '#ddd7c7', { tex: 'cloth', hs: 8 });
mat('scr_ingridSack', '#b19c72', { tex: 'cloth', hs: 10 });
mat('scr_ingridWhite', '#e8ded0', { hs: 6 });
mat('scr_ingridIris', '#5e4630', { hs: 8 });
mat('scr_ingridLash', '#2e1c14', { hs: 6 });
mat('scr_ingridMouth', '#46201a', { hs: 6 });
mat('scr_ingridTeeth', '#eadfc6', { hs: 6 });
// Torstein the Cooper, by the fire that bends his staves
mat('scr_gTorstein', '#1f2320', { em: true, hs: 12 });
mat('scr_torsteinHalo', '#6a3a1c', { em: true, hs: 6 });
mat('scr_torsteinSpark', '#ffb050', { em: true, hs: 0 });
mat('scr_torsteinSkin', '#c08868', { hs: 14 });
mat('scr_torsteinBeard', '#4a3424', { hs: 12 });
mat('scr_torsteinCap', '#4c6a3e', { tex: 'cloth', hs: 12 });
mat('scr_torsteinTunic', '#3c4a60', { tex: 'cloth', hs: 12 });
mat('scr_torsteinApron', '#7c5438', { hs: 14 });
mat('scr_torsteinHoop', '#666e7c', { shiny: true, hs: 10 });
mat('scr_torsteinMallet', '#5a4230', { tex: 'wood', hs: 12 });
mat('scr_torsteinHaft', '#7a5a3a', { tex: 'wood' });
mat('scr_torsteinWhite', '#dcd2c2', { hs: 6 });
mat('scr_torsteinIris', '#4a3626', { hs: 8 });
mat('scr_torsteinLash', '#22160f', { hs: 6 });
// Sigrid the Weaver, spinning by the hearth before her loom
mat('scr_gSigrid', '#1b2526', { em: true, hs: 12 });
mat('scr_sigridHalo', '#5e3e20', { em: true, hs: 6 });
mat('scr_sigridSkin', '#c8937c', { hs: 12 });
mat('scr_sigridHair', '#b2aea6', { hs: 8 });
mat('scr_sigridShawl', '#4c6a3e', { tex: 'cloth', hs: 12 });
mat('scr_sigridBorder', '#8c3328', { tex: 'cloth', hs: 12 });
mat('scr_sigridDress', '#55698a', { tex: 'cloth', hs: 12 });
mat('scr_sigridFleece', '#e0dacb', { tex: 'fur', hs: 8 });
mat('scr_sigridYarn', '#cdbf9c', { hs: 8 });
mat('scr_sigridWhite', '#e2d8cc', { hs: 6 });
mat('scr_sigridIris', '#5a6c58', { hs: 8 });
mat('scr_sigridLash', '#3a2a24', { hs: 6 });
mat('scr_sigridLip', '#a8665a', { hs: 8 });
// Young Leif, in the snowy yard at sundown
mat('scr_gLeif', '#1d2636', { em: true, hs: 12 });
mat('scr_leifSky', '#7a4c3c', { em: true, hs: 6 });
mat('scr_leifSnow', '#c4d0dc', { em: true, hs: 4 });
mat('scr_leifSkin', '#d29f84', { hs: 14 });
mat('scr_leifFreckle', '#ad6a48', { hs: 10 });
mat('scr_leifHair', '#c7a35e', { hs: 12 });
mat('scr_leifTunic', '#55698a', { tex: 'cloth', hs: 12 });
mat('scr_leifSword', '#8a6844', { tex: 'wood', hs: 12 });
mat('scr_leifWhite', '#eee4d8', { hs: 6 });
mat('scr_leifIris', '#4c7090', { hs: 8 });
mat('scr_leifLash', '#3a2418', { hs: 6 });
mat('scr_leifMouth', '#4a1e1a', { hs: 6 });
mat('scr_leifTeeth', '#eee2ca', { hs: 6 });

// ---- wave 9d portraits
// the Myling, the Kirkegrim, the Root-Wraith (portraitsRestless.ts)
mat('scr_gMyling', '#222a40', { em: true, hs: 12 });
mat('scr_gKirkegrim', '#1e2030', { em: true, hs: 12 });
mat('scr_kirkegrimHaze', '#5c6290', { em: true, hs: 8 });
mat('scr_gRootWraith', '#1c2419', { em: true, hs: 12 });
mat('scr_mylingShroud', '#aebdca', { hs: 5, warm: 210 }); // the bible also passed cold: 230; the game's ramp has no such option and hs: 5 clamps it away (bakes identical)
mat('scr_mylingFace', '#dfe5ea', { hs: 4, warm: 220 });
mat('scr_mylingHollow', '#3a3150', { hs: 6 });
mat('scr_mylingMouth', '#1c1626');
mat('scr_mylingCord', '#6c6a7a', { hs: 8 });
mat('scr_kirkegrimFur', '#34374c', { hs: 14 });
mat('scr_kirkegrimRuff', '#34374c', { tex: 'fur', hs: 14 });
mat('scr_kirkegrimMist', '#626a96', { em: true, hs: 8 });
mat('scr_kirkegrimNose', '#1e1c26', { shiny: true });
mat('scr_kirkegrimMouth', '#120e18');
mat('scr_kirkegrimTooth', '#c4c2cc', { hs: 6 });
mat('scr_rootWraithCloth', '#4e5842', { tex: 'cloth', hs: 14 });
mat('scr_rootWraithRoot', '#665a42', { tex: 'bark', hs: 12 });
mat('scr_rootWraithBone', '#aeb48c', { hs: 10 });
mat('scr_rootWraithVoid', '#18141f', { hs: 6 });
mat('scr_rootWraithBile', '#3e5a26', { em: true, hs: 6 });

// the Skeleton, the Nár, the Silver Wight (portraitsWalkingDead.ts)
// skeleton
mat('scr_gSkel', '#2b2724', { em: true, hs: 12 });          // the barrow's stones
mat('scr_skelBone', '#cdbf98', { hs: 12 });                 // old bone, yellowed
mat('scr_skelPit', '#110d15', { hs: 4 });                   // sockets, the nose, the mouth
mat('scr_skelTooth', '#b8a985', { hs: 10 });
mat('scr_skelSteel', '#8c939c', { shiny: true, hs: 8, warm: 200 });
mat('scr_skelRust', '#8e5532', { tex: 'rot', hs: 12 });
mat('scr_skelWood', '#4e3b29', { tex: 'wood', hs: 12 });
mat('scr_skelGrip', '#45302a', { hs: 12 });
mat('scr_skelStain', '#8c7752', { hs: 10 });                // barrow earth soaked into the bone
// nár
mat('scr_gNar', '#25212b', { em: true, hs: 12 });           // the drift's rock
mat('scr_narSkin', '#8e937e', { tex: 'rot', hs: 8 });       // a drowned miner's skin
mat('scr_narLip', '#6c6070', { hs: 10 });                   // bruised lips, swollen lids
mat('scr_narVein', '#2a2b36', { shiny: true, hs: 8 });      // tarnished silver, black in the veins
mat('scr_narHair', '#2c2522', { hs: 10 });
mat('scr_narRag', '#66625a', { tex: 'cloth', hs: 12 });     // the torn shirt
mat('scr_narPit', '#0f0b10', { hs: 4 });                    // the mouth, the empty socket
mat('scr_narTooth', '#9c8f6e', { hs: 10 });
mat('scr_narNail', '#3b3339', { hs: 8 });
// silver wight
mat('scr_gWight', '#20242a', { em: true, hs: 12 });         // the lode-chamber's rock, cold slate
mat('scr_wightSkin', '#727888', { shiny: true, hs: 8 });    // skin gone the grey of tarnished silver
mat('scr_wightShroud', '#514c64', { tex: 'cloth', hs: 10 });
mat('scr_wightMail', '#747a88', { shiny: true, tex: 'mail', hs: 8 });
mat('scr_wightTarn', '#3a3c46', { shiny: true, hs: 8 });    // tarnished silver: the circlet, the pick
mat('scr_wightBeard', '#d6dae2', { tex: 'fur', hs: 6 });
mat('scr_wightPit', '#0d0b13', { hs: 4 });                  // the hood's dark, the sockets, the mouth
mat('scr_wightLode', '#4a4448', { em: true, hs: 8 });       // dark in its own silver's light: drawn by value, like the ground
mat('scr_wightVein', '#d4dcea', { em: true, hs: 6 });       // the silver in the lode, alight
mat('scr_wightHaft', '#3e3029', { tex: 'wood', hs: 12 });

// the Wolf, the Rime-Wolf, the Brim-Howler (portraitsWolves.ts)
mat('scr_gWolf', '#20262e', { em: true, hs: 12 });
mat('scr_wolfFur', '#7c7f88', { tex: 'fur', hs: 6 });
mat('scr_wolfFurDark', '#4a4d57', { tex: 'fur', hs: 6 });
mat('scr_wolfFurPale', '#b3b6bc', { tex: 'fur', hs: 4 });
mat('scr_wolfEye', '#ffb23a', { em: true, hs: 0 });
mat('scr_wolfRim', '#16151a', { hs: 6 });
mat('scr_wolfNose', '#24222a', { shiny: true });
mat('scr_wolfMouth', '#140c0f');
mat('scr_wolfGum', '#5e3036', { hs: 8 });
mat('scr_wolfTooth', '#e4dccb', { hs: 4 });
mat('scr_gRimeWolf', '#1f2738', { em: true, hs: 12 });
mat('scr_rimeWolfFur', '#b6bfca', { tex: 'fur', hs: 0 });
mat('scr_rimeWolfFurDark', '#7c8797', { tex: 'fur', hs: 0 });
mat('scr_rimeWolfFurPale', '#dfe4ea', { tex: 'fur', hs: 0 });
mat('scr_rimeWolfIce', '#8fe0ff', { em: true, hs: 2 });
mat('scr_rimeWolfEye', '#ffc04a', { em: true, hs: 0 });
mat('scr_rimeWolfWhite', '#d8dccf', { hs: 4 });
mat('scr_gBrim', '#18232e', { em: true, hs: 12 });
mat('scr_brimFur', '#66778f', { tex: 'fur', hs: 6 });
mat('scr_brimFurDark', '#3e4a5c', { tex: 'fur', hs: 6 });
mat('scr_brimFurPale', '#a9b8c8', { tex: 'fur', hs: 4 });
mat('scr_brimIce', '#93cfe8', { shiny: true, tex: 'ice', hs: 2 });
mat('scr_brimMist', '#bcdce6', { em: true, hs: 2 });
mat('scr_brimEye', '#ffb23a', { em: true, hs: 0 });

// the draugr's kin: the Draugr Warrior, the Deep-Lode Pit-Draugr, the Coven Thrall (portraitsDraugr.ts)
mat('scr_gDraugrWar', '#2b3140', { em: true, hs: 14 });
mat('scr_warShroud', '#414a5c', { tex: 'cloth', hs: 12, warm: 210 });
mat('scr_warWood', '#4f3b2a', { tex: 'wood', hs: 14 });
mat('scr_gPitDraugr', '#2e2a26', { em: true, hs: 14 });
mat('scr_pitVein', '#a7b0bb', { em: true, hs: 6 });
mat('scr_pitSkin', '#8a8780', { hs: 10, warm: 200 });
mat('scr_pitMail', '#7a6d59', { shiny: true, tex: 'mail', hs: 10 });
mat('scr_pitBeard', '#8f8f8c', { hs: 6 });
mat('scr_pitShroud', '#4f483f', { tex: 'cloth', hs: 12 });
mat('scr_pitOre', '#c09048', { hs: 10 });
mat('scr_pitGlass', '#3e4c47', { shiny: true, hs: 8 });
mat('scr_pitRind', '#a39b86', { tex: 'stone', hs: 8 });
mat('scr_pitHelm', '#5d6068', { shiny: true, tex: 'rot', hs: 10 });
mat('scr_gThrall', '#252a3d', { em: true, hs: 12 });
mat('scr_thrallRag', '#5f5a4e', { tex: 'cloth', hs: 12 });
mat('scr_thrallHex', '#8c84ff', { em: true, hs: 0 });
mat('scr_thrallIron', '#5a606c', { shiny: true, hs: 10 });

// the Giant Rat, the Glacier Borer, the Rotwood Crawler, the Quicksilver Leech (portraitsVermin.ts)
mat('scr_gRat', '#2a221e', { em: true, hs: 12 });
mat('scr_ratHalo', '#6a3e22', { em: true, hs: 8 });
mat('scr_ratFur', '#6c6155', { tex: 'fur', hs: 12 });
mat('scr_ratFurDark', '#3e352e', { tex: 'fur', hs: 12 });
mat('scr_ratSkin', '#8e746c', { hs: 12 });
mat('scr_ratScar', '#a48c7e', { hs: 8 });
mat('scr_ratNose', '#86605a', { shiny: true, hs: 10 });
mat('scr_ratTeeth', '#b89a62', { hs: 8 });
mat('scr_ratMaw', '#1c1014', { em: true });
mat('scr_ratGum', '#7e4446', { hs: 10 });
mat('scr_ratEyeBall', '#120c0e', { shiny: true });
mat('scr_ratWhisker', '#6e665e', { hs: 6 });
mat('scr_ratClaw', '#2a201c', { shiny: true });
mat('scr_ratTallow', '#b8a47c', { hs: 10 });
mat('scr_ratWick', '#1a120e');
mat('scr_gBorer', '#14242f', { em: true, hs: 10 });
mat('scr_borerHole', '#070d12', { em: true });
mat('scr_borerShell', '#5f84a0', { tex: 'ice', hs: 10 });
mat('scr_borerIce', '#30566e', { tex: 'ice', hs: 8 });
mat('scr_borerLeg', '#2a2d3c', { hs: 10 });
mat('scr_borerChitin', '#2e3242', { shiny: true, hs: 10 });
mat('scr_borerPlate', '#3c465c', { hs: 10 });
mat('scr_borerDrill', '#aac8da', { shiny: true, hs: 8 });
mat('scr_borerGroove', '#2c4458');
mat('scr_borerRime', '#c4efff', { em: true, hs: 6 });
mat('scr_borerSocket', '#0b0a10');
mat('scr_borerChip', '#d8f2fa', { hs: 6 });
mat('scr_gCrawl', '#1e1813', { em: true, hs: 10 });
mat('scr_crawlPlate', '#6e5844', { tex: 'rot', hs: 10 });
mat('scr_crawlBark', '#5a4632', { tex: 'bark', hs: 10 });
mat('scr_crawlLeg', '#4c3c2e', { hs: 10 });
mat('scr_crawlFang', '#7a5e40', { shiny: true, hs: 8 });
mat('scr_crawlFangTip', '#3a2c22', { shiny: true });
mat('scr_crawlMaw', '#120d0a');
mat('scr_gLeech', '#161a22', { em: true, hs: 10 });
mat('scr_leechVein', '#dde5ef', { em: true, hs: 6 });
mat('scr_leechQuick', '#a9b5c4', { shiny: true, hs: 8 });
mat('scr_leechQuickDark', '#4e5a6c', { shiny: true, hs: 8 });
mat('scr_leechLip', '#705658', { shiny: true, hs: 8 });
mat('scr_leechFlesh', '#5e4448', { em: true, hs: 8 });
mat('scr_leechMaw', '#0b0a0f', { em: true });
mat('scr_leechTooth', '#d6cdb8', { shiny: true, hs: 6 });

// the Kobold, the Kobold Shaman, the Goblin, the Hoarfrost Skraeling (portraitsGoblins.ts)
// grounds
mat('scr_gKobold', '#182627', { em: true, hs: 12 });
mat('scr_koboldTorchWall', '#34423e', { em: true, hs: 8 });
mat('scr_gKoboldShaman', '#201c32', { em: true, hs: 12 });
mat('scr_koboldShamanHalo', '#6e3a1c', { em: true, hs: 6 });
mat('scr_gGoblin', '#281c25', { em: true, hs: 12 });
mat('scr_gSkraeling', '#132230', { em: true, hs: 10 });
// skins (the map's colours)
mat('scr_koboldSkin', '#9c8c5e', { hs: 14 });
mat('scr_koboldShamanSkin', '#a8704c', { hs: 14 });
mat('scr_goblinSkin', '#6f8e4c', { hs: 14 });
mat('scr_skraelingSkin', '#8496a6', { hs: 10 });
// shared by the kin
mat('scr_goblinKinMaw', '#170c0e');
mat('scr_goblinKinTooth', '#d6caa2', { hs: 8 });
mat('scr_goblinKinNail', '#2a2220', { shiny: true });
// kobold
mat('scr_koboldHorn', '#b9a888', { hs: 12 });
mat('scr_koboldBlade', '#9aa2ae', { shiny: true, hs: 8 });
mat('scr_koboldBronze', '#8a6a3c', { shiny: true, hs: 10 });
// kobold shaman
mat('scr_koboldShamanBone', '#d4c9aa', { hs: 12 });
mat('scr_koboldShamanFeather', '#5a4e44', { hs: 10 });
mat('scr_koboldShamanLinen', '#a89a7c', { tex: 'cloth', hs: 10 });
mat('scr_koboldShamanStaff', '#4a3526', { tex: 'wood', hs: 12 });
mat('scr_koboldShamanTongue', '#6a3a40', { hs: 8 });
// goblin
mat('scr_goblinClub', '#6e5038', { tex: 'wood', hs: 12 });
mat('scr_goblinStud', '#6a6e78', { shiny: true, hs: 8 });
mat('scr_goblinLeather', '#4e3828', { hs: 12 });
mat('scr_goblinFireGlow', '#5c2c14', { em: true, hs: 6 });
// hoarfrost skraeling
mat('scr_skraelingFur', '#bcc6cc', { hs: 8 });
mat('scr_skraelingFurDark', '#3e4a5e', { hs: 8 });
mat('scr_skraelingRime', '#d6e6f0', { shiny: true, hs: 6 });
mat('scr_skraelingEye', '#d8f8ff', { em: true, hs: 0 });
mat('scr_skraelingIce', '#a6e4fa', { em: true, hs: 4 });
mat('scr_skraelingShaft', '#5e4634', { tex: 'wood', hs: 12 });
mat('scr_skraelingThong', '#2e2420', { hs: 10 });

// the Troll-Wife Warlock, the Coven Warlock, the Winter Hag (portraitsWitches.ts)
mat('scr_gTwWarlock', '#29232f', { em: true, hs: 12 });
mat('scr_twWarlockHalo', '#4a3472', { em: true, hs: 8 });
mat('scr_twWarlockSkin', '#7a8770', { hs: 12 });
mat('scr_twWarlockHair', '#3a2c27', { hs: 10 });
mat('scr_twWarlockShawl', '#7c5638', { tex: 'cloth', hs: 12 });
mat('scr_twWarlockDress', '#4e4542', { tex: 'cloth', hs: 12 });
mat('scr_twWarlockStaff', '#4a3728', { tex: 'wood', hs: 12 });
mat('scr_twWarlockStone', '#4a4855', { tex: 'stone', hs: 10 });
mat('scr_twWarlockHex', '#8c84ff', { em: true, hs: 0 });
mat('scr_twWarlockLip', '#40463a', { hs: 10 });
mat('scr_twWarlockMouth', '#160f12');
mat('scr_twWarlockNail', '#221d26', { shiny: true, hs: 8 });
mat('scr_twWarlockTooth', '#cbbf9c', { hs: 10 });
mat('scr_gCoven', '#232a3c', { em: true, hs: 12 });
mat('scr_covenHood', '#5e5046', { tex: 'cloth', hs: 12 });
mat('scr_covenHollow', '#141014');
mat('scr_covenSkin', '#66734f', { hs: 12 });
mat('scr_covenEye', '#120d10', { em: true });                // the eye-pits: the fire below never reaches them
mat('scr_covenMouth', '#170e0e');
mat('scr_covenTooth', '#c4b894', { hs: 10 });
mat('scr_covenFrostbite', '#23222c', { shiny: true, hs: 10 });
mat('scr_covenBowl', '#66625e', { tex: 'stone', hs: 10 });
mat('scr_covenSnow', '#c9d6e2', { hs: 6 });
mat('scr_covenFirelit', '#b8a25a', { em: true, hs: 10 });    // her skin where the bowl's fire catches it
mat('scr_gWinterHag', '#16222f', { em: true, hs: 10 });
mat('scr_winterHagHalo', '#2b5670', { em: true, hs: 6 });
mat('scr_winterHagSkin', '#a9b2b0', { hs: 10, warm: 200 });
mat('scr_winterHagHair', '#dde8ef', { hs: 6, warm: 200 });
mat('scr_winterHagRobe', '#52607c', { tex: 'cloth', hs: 10 });
mat('scr_winterHagShawl', '#6b6e86', { tex: 'cloth', hs: 10 });
mat('scr_winterHagCrook', '#4d3826', { tex: 'wood', hs: 12 });
mat('scr_winterHagCrystal', '#9fe6ff', { em: true, hs: 0 });
mat('scr_winterHagEye', '#c8f4ff', { em: true, hs: 0 });
mat('scr_winterHagRime', '#d3e6ee', { shiny: true, tex: 'ice', hs: 4 });
mat('scr_winterHagMouth', '#151a24');
mat('scr_winterHagSocket', '#24303e', { em: true, hs: 6 }); // the eye-pits, which the lamp never reaches
mat('scr_winterHagNail', '#9cb6c6', { shiny: true, hs: 6 });

// the Dark Sorcerer, the Sól-Brand Zealot (portraitsDarkArts.ts)
mat('scr_gSorcerer', '#202328', { em: true, hs: 12 }); // the rock of the silver veins
mat('scr_gSorcererVein', '#60646e', { em: true, hs: 6 }); // tarnished silver in it
mat('scr_sorcererShade', '#343a58', { em: true, hs: 6 }); // bone in the hood's dark, touched by the eyes' light
mat('scr_sorcererEyeGlow', '#2c4470', { em: true, hs: 4 });
mat('scr_sorcererRobe', '#514c6e', { tex: 'cloth', hs: 12 });
mat('scr_sorcererTrim', '#a9adb8', { shiny: true, hs: 8 });
mat('scr_sorcererVoid', '#120e18', { em: true, hs: 6 }); // the dark under the hood: no light reaches it
mat('scr_sorcererSkin', '#b39a8e', { hs: 10 });
mat('scr_sorcererNail', '#3a3236', { shiny: true, hs: 8 });
mat('scr_sorcererMouth', '#1a1216');
mat('scr_sorcererEye', '#9cc6ff', { em: true, hs: 0 });
mat('scr_sorcererBolt', '#fff27a', { em: true, hs: 0 });
mat('scr_sorcererBoltCore', '#fffef0', { em: true, hs: 0 });
mat('scr_gZealot', '#221a1d', { em: true, hs: 12 }); // obsidian, black glass
mat('scr_gZealotGlass', '#3a2a2a', { em: true, hs: 10 }); // its facets, catching the fire
mat('scr_haloZealot', '#6a3a22', { em: true, hs: 8 }); // the stolen sun's halo, ember
mat('scr_zealotSkin', '#b08670', { hs: 14 });
mat('scr_zealotBrow', '#3e2a22', { hs: 10 });
mat('scr_zealotScar', '#8a4a32', { hs: 10 });
mat('scr_zealotBlister', '#a86a4c', { shiny: true, hs: 10 });
mat('scr_zealotRobe', '#d6c69c', { hs: 10 });
mat('scr_zealotChar', '#3e322c', { tex: 'rot', hs: 10 });
mat('scr_zealotIron', '#3b404b', { shiny: true, hs: 10 });
mat('scr_zealotWhite', '#d8cbb6', { hs: 6 });
mat('scr_zealotIris', '#3a2a20', { hs: 8 });
mat('scr_zealotMouth', '#241012', { em: true });
mat('scr_zealotTongue', '#6a3034', { hs: 10 });
mat('scr_zealotTooth', '#d2c4a6', { hs: 8 });
mat('scr_zealotBrand', '#ffd9b8', { em: true, hs: 0 }); // white-hot at the heart, ember at the edge
mat('scr_zealotSun', '#fff3e4', { em: true, hs: 0 });

// the Cave Troll, the Ogre, the Orc (portraitsBrutes.ts)
mat('scr_gCaveTroll', '#1b2129', { em: true, hs: 12 });
mat('scr_caveTrollSky', '#3a4c66', { em: true, hs: 10 }); // the night outside the cave mouth
mat('scr_caveTrollMoon', '#dfe8f2', { em: true, hs: 4 });
// moonlit: the lights go cold, not warm
mat('scr_caveTrollHide', '#566056', { tex: 'stone', hs: 14, warm: 205 }); // a hide gone half to stone
mat('scr_caveTrollHead', '#6e786a', { hs: 14, warm: 205 });
mat('scr_caveTrollMoss', '#4a5838', { tex: 'fur', hs: 10, warm: 190 });
mat('scr_caveTrollLichen', '#868c70', { hs: 8 });
mat('scr_caveTrollFir', '#1f2f27', { hs: 12 });
mat('scr_caveTrollTusk', '#cdbf98', { hs: 10 });
mat('scr_caveTrollMaw', '#1a1214', { hs: 4 });
mat('scr_gOgre', '#2a211e', { em: true, hs: 12 });
mat('scr_ogreForge', '#c4521c', { em: true, hs: 6 }); // the forge-mouth's glow
mat('scr_ogreSkin', '#a4876a', { hs: 14 });
mat('scr_ogreStrap', '#4a3326', { hs: 14 });
mat('scr_ogreCleaver', '#8c929a', { shiny: true, hs: 8 });
mat('scr_ogreHandle', '#4d3826', { tex: 'wood' });
mat('scr_ogreBlood', '#5e1a16', { hs: 6 }); // old blood on the blade
mat('scr_ogreMaw', '#24141a', { hs: 4 });
mat('scr_ogreTooth', '#d8cba6', { hs: 10 });
mat('scr_ogreIron', '#5c616c', { shiny: true, hs: 10 });
mat('scr_gOrc', '#18202c', { em: true, hs: 12 });
mat('scr_orcTorchHalo', '#3c302c', { em: true, hs: 8 }); // the torch's warmth on the ice
mat('scr_orcIce', '#33506a', { em: true, hs: 8 }); // icicles and the ice wall
mat('scr_orcSkin', '#5f7650', { hs: 12 });
mat('scr_orcHelm', '#535a66', { shiny: true, hs: 10 });
mat('scr_orcMail', '#6c7482', { shiny: true, tex: 'mail', hs: 8 });
mat('scr_orcFur', '#3e342c', { tex: 'fur', hs: 10 }); // a wolfskin against the cold
mat('scr_orcHair', '#2c2420', { hs: 8 });
mat('scr_orcTusk', '#cdbf98', { hs: 10 });
mat('scr_orcMaw', '#1c1216', { hs: 4 });
mat('scr_orcAxe', '#97a2b2', { shiny: true, hs: 10 });
mat('scr_orcHaft', '#4d3826', { tex: 'wood' });
mat('scr_orcStrap', '#4f3627', { hs: 14 });

// the Jötunn Champion, the Fire Giant (portraitsGiants.ts)
mat('scr_gJotunChamp', '#1f2338', { em: true, hs: 12 });
mat('scr_jotunChampSkin', '#6c87b0', { hs: 10, warm: 200 });
mat('scr_jotunChampFur', '#aab5c6', { tex: 'fur', hs: 8, warm: 200 });
mat('scr_jotunChampBeard', '#a9bacb', { hs: 6, warm: 195 });
mat('scr_jotunChampMail', '#5d6676', { shiny: true, tex: 'mail', hs: 8, warm: 200 });
mat('scr_jotunChampHelm', '#566070', { shiny: true, hs: 10, warm: 200 });
mat('scr_jotunChampRime', '#dcecf5', { shiny: true, tex: 'ice', hs: 6, warm: 190 });
mat('scr_jotunChampAxe', '#99a5b5', { shiny: true, hs: 8, warm: 200 });
mat('scr_jotunChampMaw', '#141a2c', { hs: 8 });
mat('scr_gFireGiant', '#24171a', { em: true, hs: 14 });
mat('scr_fireGiantCrust', '#272224', { tex: 'stone', hs: 12, contrast: 0.8 });
mat('scr_fireGiantChar', '#342a27', { tex: 'rot', hs: 10 });
mat('scr_fireGiantBlade', '#28262c', { shiny: true, hs: 10 });
mat('scr_fireGiantMaw', '#160a08', { hs: 6 });

// the Huldra, the Huldra Hollow-Back, the Fylgja, the Näcken (portraitsHiddenFolk.ts)
// the huldra: a summer night in the birch wood, moonlight
mat('scr_gHuldra', '#1e2b2c', { em: true, hs: 12 });
mat('scr_huldraSkin', '#cdc3b8', { hs: 8 });
mat('scr_huldraHair', '#aeaa66', { hs: 12 });
mat('scr_huldraHairDark', '#666b3a', { hs: 12 });
mat('scr_huldraMoss', '#56733e', { tex: 'cloth', hs: 12 });
mat('scr_huldraTail', '#b39a7c', { hs: 12 });
mat('scr_huldraTuft', '#3e2e26', { tex: 'fur', hs: 12 });
mat('scr_huldraFlower', '#f1ead6', { hs: 6 });
mat('scr_huldraIris', '#9a7a3a', { hs: 10 });
mat('scr_huldraLash', '#2c2420', { hs: 8 });
mat('scr_huldraLip', '#b48e88', { hs: 10 });
// her hollow back, both kinds
mat('scr_huldraRim', '#8a7052', { tex: 'bark', hs: 12 });
mat('scr_huldraHollow', '#3a2818', { tex: 'rot', hs: 12 });
mat('scr_huldraHollowDeep', '#120a06', { em: true });
mat('scr_huldraFungus', '#d2c09a', { hs: 8 });
mat('scr_huldraLichen', '#8fae5a', { tex: 'rot', hs: 10 });
// the Hollow-Back: gone to bark, lit by the foxfire in her own rot
mat('scr_gHuldraOld', '#1f2622', { em: true, hs: 12 });
mat('scr_huldraOldSkin', '#8e826c', { hs: 10 });
mat('scr_huldraOldBark', '#76664e', { tex: 'bark', hs: 12 });
mat('scr_huldraOldHair', '#7a8462', { tex: 'fur', hs: 8 });
mat('scr_huldraOldHairDark', '#3e4634', { tex: 'fur', hs: 8 });
mat('scr_huldraBarkGown', '#5e4a34', { tex: 'bark', hs: 12 });
mat('scr_huldraSocket', '#120c0a', { em: true });
mat('scr_huldraFoxfire', '#9ee8c4', { em: true, hs: 0 });
// the fylgja
mat('scr_gFylgja', '#1a2232', { em: true, hs: 10 });
mat('scr_fylgjaFur', '#e2eaf0', { hs: 6, warm: 210 });
mat('scr_fylgjaMist', '#7c8ca8', { em: true, hs: 6 });
mat('scr_fylgjaFade', '#6a7a94', { hs: 6 });
mat('scr_fylgjaAntler', '#e2dccc', { hs: 6 });
mat('scr_fylgjaGold', '#ffe3a0', { em: true, hs: 0 });
mat('scr_fylgjaNose', '#3c4454', { shiny: true, hs: 8 });
mat('scr_fylgjaEye', '#ffe6a8', { em: true, hs: 0 });
mat('scr_fylgjaPupil', '#1c2232', { shiny: true, hs: 6 });
mat('scr_fylgjaInner', '#8e9cb0', { hs: 8 });
// the Näcken
mat('scr_gNacken', '#14232a', { em: true, hs: 10 });
mat('scr_nackenSkin', '#a7b7ad', { shiny: true, hs: 10 });
mat('scr_nackenHair', '#36403f', { shiny: true, hs: 8 });
mat('scr_nackenWeed', '#4e6a3a', { hs: 10 });
mat('scr_nackenFiddle', '#94532a', { tex: 'wood', shiny: true, hs: 12 });
mat('scr_nackenFiddleDark', '#2e1a10', { hs: 10 });
mat('scr_nackenString', '#c8c0a8', { hs: 6 });
mat('scr_nackenEye', '#d8f6ee', { em: true, hs: 0 });
mat('scr_nackenMouth', '#141c1e', { em: true });
mat('scr_nackenIce', '#56788a', { shiny: true, tex: 'ice', hs: 6 });
mat('scr_nackenBody', '#869890', { hs: 10 });
mat('scr_nackenWater', '#5a9cb0', { em: true, hs: 6 });

// the Vengeful Nisse, the Skratti, the Slag Amorphous (portraitsFaeSlag.ts)
mat('scr_gNisse', '#2a2019', { em: true, hs: 12 });
mat('scr_nisseHalo', '#6e4024', { em: true, hs: 8 });
mat('scr_nisseWool', '#5c5850', { tex: 'cloth', hs: 10 });
mat('scr_nisseWoolDark', '#423e38', { tex: 'cloth', hs: 10 });
mat('scr_nisseCap', '#7c3226', { tex: 'cloth', hs: 12 });
mat('scr_nisseSkin', '#a6765a', { hs: 14 });
mat('scr_nisseNose', '#b5664a', { hs: 10 });
mat('scr_nisseBeard', '#9d998e', { hs: 6 });
mat('scr_nisseMaw', '#1a100c');
mat('scr_nisseTooth', '#bca472', { hs: 8 });
mat('scr_nisseIron', '#3c4048', { shiny: true, hs: 10 });
mat('scr_nissePane', '#f0903a', { em: true, hs: 4 });
mat('scr_nisseStraw', '#b0985a', { hs: 10 });
mat('scr_nisseNail', '#2c201a', { shiny: true });
mat('scr_gSkratti', '#142232', { em: true, hs: 10 });
mat('scr_skrattiSkin', '#7eaecb', { hs: 8 });
mat('scr_skrattiEar', '#3f6a8c', { hs: 8 });
mat('scr_skrattiHide', '#4a7494', { hs: 8 });
mat('scr_skrattiSocket', '#0a121c');
mat('scr_skrattiMaw', '#0a1018', { em: true });
mat('scr_skrattiTooth', '#e6f4fc', { shiny: true, hs: 6 });
mat('scr_skrattiIce', '#b4e2f4', { shiny: true, tex: 'ice', hs: 6 });
mat('scr_gSlag', '#231a16', { em: true, hs: 10 });
mat('scr_slagHalo', '#6a321a', { em: true, hs: 8 });
mat('scr_slagHeart', '#ff7a26', { em: true, hs: 0 });
mat('scr_slagCrust', '#4f433c', { tex: 'stone', hs: 10 });
mat('scr_slagClinker', '#2c2522', { tex: 'stone', hs: 10 });
mat('scr_slagCooling', '#6e3e24', { tex: 'stone', hs: 8 });
mat('scr_slagMaw', '#160c08', { em: true });

// the Captive of the Chariot, the Choke-Damp Phantasm (portraitsBound.ts)
mat('scr_gCaptive', '#271c1b', { em: true, hs: 12 });
mat('scr_captiveHalo', '#6a4622', { em: true, hs: 8 });
mat('scr_gChokeDamp', '#1f2119', { em: true, hs: 10 });
mat('scr_chokeDampPool', '#4a5030', { em: true, hs: 8 });
mat('scr_captiveLight', '#f8cf78', { em: true, hs: 16, warm: 55 }); // a body of Sól's light, its shadows sliding to ember
mat('scr_captiveCore', '#fffaf0', { em: true, hs: 0 });
mat('scr_captiveRay', '#eeb84a', { em: true, hs: 14 });
mat('scr_captiveBurn', '#ff8a2c', { em: true, hs: 0 });
mat('scr_captiveIron', '#363840', { shiny: true, hs: 10 });
mat('scr_captiveMaw', '#3a1a0e', { hs: 8 });
mat('scr_chokeDampGas', '#8e9650', { hs: 8, warm: 60 }); // mine gas, opaque, read by value
mat('scr_chokeDampGasDeep', '#636a38', { hs: 8, warm: 60 });
mat('scr_chokeDampGasFaint', '#41462a', { hs: 8 });
mat('scr_chokeDampGasLight', '#c4c888', { hs: 6, warm: 60 });
mat('scr_chokeDampHole', '#1c200f', { hs: 6 });
mat('scr_chokeDampGlass', '#d8b25a', { em: true, hs: 0 });
mat('scr_chokeDampFlame', '#ffd27a', { em: true, hs: 0 });

// the Bark-Husk Miner, the Bellows-Automaton, the Prismatic Mirror-Skulker (portraitsConstructs.ts)
mat('scr_gBarkHusk', '#232220', { em: true, hs: 12 }); // the gallery it digs, under the World-Bark
mat('scr_barkHuskBark', '#4f3d2c', { tex: 'cloth', hs: 14 });
mat('scr_barkHuskHeart', '#a08258', { tex: 'wood', hs: 12 }); // the pale wood where it is split
mat('scr_barkHuskHollow', '#130d09', { hs: 4 }); // the hollow inside
mat('scr_barkHuskSap', '#cddc52', { em: true, hs: 0 }); // the sap, alight
mat('scr_barkHuskLichen', '#7a8f5a', { tex: 'rot', hs: 10 });
mat('scr_barkHuskIron', '#363a42', { shiny: true, hs: 10 }); // the cap and the hoops
mat('scr_barkHuskRust', '#6a4430', { tex: 'rot', hs: 12 });
mat('scr_gBellows', '#24252a', { em: true, hs: 12 }); // a cold forge of the Dwarven Works
mat('scr_bellowsHide', '#7c4238', { tex: 'cloth', hs: 10 });
mat('scr_bellowsBrass', '#7a5c36', { shiny: true, hs: 14 }); // brass gone brown
mat('scr_bellowsSoot', '#4c494f', { hs: 6 });
mat('scr_bellowsPit', '#120d0c', { hs: 4 });
mat('scr_gMirrorSkulker', '#1d1a24', { em: true, hs: 12 }); // the Siphon's obsidian
mat('scr_mirrorSkulkerSeam', '#5a2c14', { em: true, hs: 6 }); // a magma seam in the floor, kept dark
mat('scr_mirrorSkulkerGlass', '#b4c6dc', { shiny: true, hs: 6 });
mat('scr_mirrorSkulkerDark', '#2a3244', { shiny: true, hs: 8 }); // facets mirroring the dark
mat('scr_mirrorSkulkerQuartz', '#9ccbdc', { shiny: true, hs: 6 });
mat('scr_mirrorSkulkerSun', '#fff1ba', { em: true, hs: 0 });
mat('scr_mirrorSkulkerRose', '#ff9ae8', { em: true, hs: 0 }); // the spectrum a prism throws
mat('scr_mirrorSkulkerLemon', '#fff59a', { em: true, hs: 0 });
mat('scr_mirrorSkulkerCyan', '#9af0ff', { em: true, hs: 0 });

// the Shadow Fiend, the Garmling, the Náströnd Feaster (portraitsFiends.ts)
mat('scr_gShadowFiend', '#221d31', { em: true, hs: 12 });
mat('scr_shadowFiendSmoke', '#4a4462', { hs: 8 });
mat('scr_shadowFiendDeep', '#2c2740', { hs: 8 });
mat('scr_shadowFiendWisp', '#6a6290', { hs: 8 });
mat('scr_shadowFiendMask', '#383050', { shiny: true, hs: 8 });
mat('scr_shadowFiendHeart', '#ecd8ff', { em: true });
mat('scr_shadowFiendMaw', '#0e0918');
mat('scr_shadowFiendClaw', '#c8c0dc', { shiny: true, hs: 6 });
mat('scr_gGarmling', '#2a2321', { em: true, hs: 12 });
mat('scr_garmlingHide', '#423d4c', { tex: 'fur', hs: 10 });
mat('scr_garmlingHideDark', '#26222c', { tex: 'fur', hs: 10 });
mat('scr_garmlingNose', '#1c1a20', { shiny: true });
mat('scr_garmlingGum', '#4a2a2c', { hs: 8 });
mat('scr_garmlingThroat', '#2a0c06', { em: true });
mat('scr_garmlingFang', '#e2d6c0', { hs: 6 });
mat('scr_garmlingIron', '#4a4e58', { shiny: true, hs: 10 });
mat('scr_garmlingBlood', '#48100f', { shiny: true, hs: 6 });
mat('scr_garmlingSocket', '#120d12');
mat('scr_gNastrondFeaster', '#23202a', { em: true, hs: 12 });
mat('scr_feasterFlesh', '#8c849a', { tex: 'rot', hs: 10 });
mat('scr_feasterFleshDark', '#5e576c', { tex: 'rot', hs: 10 });
mat('scr_feasterVein', '#3e3052', { hs: 8 });
mat('scr_feasterLip', '#6a4a6e', { hs: 8 });
mat('scr_feasterMaw', '#7a44c4', { em: true, hs: 0 });
mat('scr_feasterGullet', '#1a0c2a', { em: true });
mat('scr_feasterTooth', '#cfc3a4', { hs: 10 });
mat('scr_feasterHair', '#9a968e', { hs: 8 });
mat('scr_feasterMouth', '#140c18');

// the Frost Drake, the Ancient Wyrm, the Grave-Wyrmling (portraitsDrakes.ts)
mat('scr_gFrostDrake', '#17203a', { em: true, hs: 12 });
mat('scr_frostDrakeScale', '#a2bdd2', { hs: 8, warm: 200 });
mat('scr_frostDrakeBelly', '#d4e3ec', { hs: 6, warm: 200 });
mat('scr_frostDrakeIce', '#8ccbe8', { shiny: true, hs: 8, warm: 190 });
mat('scr_frostDrakeMaw', '#111830', { hs: 8 });
mat('scr_frostDrakeShade', '#4a6684', { hs: 8, warm: 200 });
mat('scr_frostDrakeTooth', '#e2f0f6', { hs: 6, warm: 200 });
mat('scr_frostDrakeBreath', '#c6dce4', { em: true, hs: 3 });
mat('scr_gAncientWyrm', '#161b26', { em: true, hs: 10 });
mat('scr_gAncientWyrmGlow', '#3c2416', { em: true, hs: 12 });
mat('scr_ancientWyrmScale', '#4c3e2e', { hs: 14 });
mat('scr_ancientWyrmPlate', '#7c5e3a', { shiny: true, hs: 12 });
mat('scr_ancientWyrmHorn', '#a69478', { hs: 12 });
mat('scr_ancientWyrmWing', '#382c28', { hs: 12 });
mat('scr_ancientWyrmScar', '#a08a72', { hs: 8 });
mat('scr_ancientWyrmMaw', '#150e0b', { em: true });
mat('scr_ancientWyrmFang', '#d0c2a2', { hs: 10 });
mat('scr_ancientWyrmSmoke', '#5c554e', { hs: 6, warm: 40 });
mat('scr_gGraveWyrmling', '#221a2c', { em: true, hs: 12 });
mat('scr_graveWyrmlingScale', '#56486e', { hs: 12 });
mat('scr_graveWyrmlingBelly', '#807690', { hs: 8 });
mat('scr_graveWyrmlingWing', '#5c405e', { hs: 10 });
mat('scr_graveWyrmlingBone', '#a89a7c', { hs: 10 });
mat('scr_graveWyrmlingMaw', '#1a0e1c', { em: true });
mat('scr_graveWyrmlingGum', '#5e3456', { shiny: true, hs: 8 });
mat('scr_graveWyrmlingTooth', '#d8d0b4', { hs: 8 });
mat('scr_graveWyrmlingSkull', '#8e8268', { hs: 10 });

// the Cinder-Gilded Duergar, the Haugbúi, the Forge Wretch (portraitsDwarves.ts)
mat('scr_gildedGround', '#2a2321', { em: true, hs: 12 }); // the cold works: soot on stone
mat('scr_gildedHalo', '#5c2c16', { em: true, hs: 6 }); // the tongs' glow, banded
mat('scr_gildedMask', '#a87a2e', { shiny: true, hs: 14 }); // the gold death-mask (the sprite's gilt), tarnished
mat('scr_gildedSoot', '#3a2a22', { hs: 10 }); // soot burnt into the gold's hollows
mat('scr_gildedChar', '#3a3434', { hs: 10 }); // the charcoal of him
mat('scr_gildedPlate', '#4c4644', { shiny: true, hs: 12 }); // charred plate
mat('scr_gildedAsh', '#8a8682', { tex: 'fur', hs: 8 }); // the ash beard
mat('scr_gildedPit', '#120c10', { hs: 4 }); // the slits, the mouth-slot, the cracks
mat('scr_haugbuiGround', '#25231c', { em: true, hs: 12 }); // the mound's earth
mat('scr_haugbuiSkin', '#56648a', { tex: 'rot', hs: 10 }); // blár sem hel: dead-blue
mat('scr_haugbuiPit', '#0e0a14', { hs: 4 });
mat('scr_haugbuiHelm', '#646c78', { shiny: true, hs: 10 });
mat('scr_haugbuiBronze', '#9c6c36', { shiny: true, hs: 12 }); // old bronze
mat('scr_haugbuiBeard', '#a8a49c', { tex: 'fur', hs: 8 });
mat('scr_haugbuiTurf', '#4e6436', { tex: 'fur', hs: 12 });
mat('scr_haugbuiGrass', '#8a9a52', { hs: 10 });
mat('scr_haugbuiRime', '#b4d2e2', { shiny: true, tex: 'ice', hs: 6, warm: 190 });
mat('scr_haugbuiMail', '#73706e', { shiny: true, tex: 'mail', hs: 10 });
mat('scr_haugbuiRust', '#9a5f38', { tex: 'rot', hs: 12 });
mat('scr_haugbuiCloak', '#5a4a38', { tex: 'cloth', hs: 12 });
mat('scr_haugbuiEarth', '#4a3a2a', { tex: 'stone', hs: 12 });
mat('scr_haugbuiRoot', '#4e3e2c', { tex: 'bark', hs: 12 });
mat('scr_haugbuiHaft', '#4d3826', { tex: 'wood', hs: 12 });
mat('scr_wretchGround', '#262120', { em: true, hs: 12 });
mat('scr_wretchHalo', '#6a3018', { em: true, hs: 6 }); // the forge mouth's glow, banded
mat('scr_wretchSkin', '#b08a74', { hs: 12 });
mat('scr_wretchScar', '#8a4a32', { hs: 10 }); // burns
mat('scr_wretchSoot', '#9a8a80', { tex: 'rot', hs: 12 }); // soot-grey arms
mat('scr_wretchSmear', '#2a201c', { tex: 'rot', hs: 10 }); // the black soot across the eyes
mat('scr_wretchMilk', '#d6d2c6', { hs: 6 }); // the blind eyes
mat('scr_wretchBeard', '#5a4232', { tex: 'fur', hs: 12 }); // the beard, burnt short
mat('scr_wretchPit', '#140c0c', { hs: 4 }); // the open mouth
mat('scr_wretchTooth', '#b0a080', { hs: 10 });
mat('scr_wretchApron', '#4f3627', { hs: 14 });
mat('scr_wretchIron', '#565c68', { shiny: true, hs: 10 }); // collar, chain, hammer
mat('scr_wretchHaft', '#7a5a3a', { tex: 'wood', hs: 12 });

// the Amber Sap-Weeper, the Yggdrasil Parasite (portraitsWorldBark.ts)
mat('scr_gSapWeeper', '#2c2117', { em: true, hs: 12 });
mat('scr_sapWeeperShell', '#5a4029', { tex: 'bark', hs: 12 });
mat('scr_sapWeeperChitin', '#3a2d24', { shiny: true, hs: 10 });
mat('scr_sapWeeperSap', '#e8902c', { em: true, hs: 6 });
mat('scr_sapWeeperAmber', '#b86a1c', { shiny: true, hs: 14 });
mat('scr_sapWeeperHole', '#120b07');
mat('scr_gYggParasite', '#1f2116', { em: true, hs: 12 });
mat('scr_yggParasiteSkin', '#b4a07e', { shiny: true, hs: 10 });
mat('scr_yggParasiteEgg', '#a8c048', { em: true, hs: 0 });
mat('scr_yggParasitePlate', '#56402c', { shiny: true, tex: 'bark', hs: 12 });
mat('scr_yggParasiteLeg', '#43321f', { shiny: true, hs: 10 });
mat('scr_yggParasiteBeak', '#b39a72', { shiny: true, hs: 8 });
mat('scr_yggParasiteHole', '#0e0c08');
mat('scr_yggParasiteRot', '#2c2619', { tex: 'bark', hs: 10 });
