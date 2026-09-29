# Magic Systems

> Topic doc under [content-extensibility.md](content-extensibility.md) ([ARCHITECTURE.md](../../ARCHITECTURE.md) §3). Explanatory only; every binding rule lives in `ARCHITECTURE.md`. Flag a conflict rather than resolving it here (§8.2).

`GameContentManifest.magic` (`MagicSystemConfig`, `src/engine/magic/magicConfig.ts`) turns on four optional systems. The engine owns each mechanism and only neutral defaults; every table, label and message comes from the pack. A pack that omits a section doesn't get that system, which is how `warcraft` keeps plain mana and a flat spell list.

| Section | Mechanism | Without it |
|---|---|---|
| `overflow` | `magic/manaOverflow.ts`: a cast short of mana goes off; the shortfall is debt (`Player.voidDebt`), and each such cast rolls a weighted surge from the tier the total debt has reached. Rest pays debt down, except a `lingeringDebt` floor outside town. | Hard mana wall (`CastSpellAction`, the `cast_spell` validator and the UI all check `canOvercast`). |
| `grimoire` | `magic/grimoireMatrix.ts`: a 3x3 grid per page (three pages). A player cast resolves through its slot: center-slot trade, opposed-element and ray-beside-burst synergies, the slot's ground element, and inscribed glyphs (`SpellModifier` data). `initialOpenSlots` seals the rest until an altar opens them. Page switches are `AttuneGrimoirePageAction` (a channel while hostiles are in view). | Spells cast unmodified; no grid UI. |
| `killRites` | `magic/killRites.ts`: `MonsterDefinition.killRite` names conditions on the death (killing-blow element, victim status, overkill, the player's debt or HP). All are things the player controls. Meeting them teaches `teachesSpellId` once, else drops the element's essence item. `DeathResolver.resolveDeath` takes a `KillContext` from spells, melee and ranged attacks. | Rites never fire; the bestiary shows none. |
| `altars` / `hybrids` | `magic/altars.ts`: a tile whose `interactionHandlerId` names an altar emits `altar_reached` when stepped on; the UI opens `AltarModal`, and the rite runs as `PerformAltarRiteAction` (replayable). Rites: `inscribe` (glyph on a slot), `forge` (spell + other element -> `hybrids` recipe), `ground` (open a sealed slot), `gamble`. Each offering (a known spell or an essence) is burned; each altar position is single-use (`altar_spent:<floor>:<x>:<y>` flag). | No altars. |

The `learn_spell` effect primitive (`spellPipeline.ts`) teaches its caster a spell; cotw's rune tablets are scrolls that cast it.

`cotw` declares all four in `src/content/cotw/magic.ts`, the rite table (with its spell-pacing notes) in `killRites.ts`, catch-up tablets in `spellTablets.ts` and forged spells in `hybridSpells.ts`. `src/content/cotw/__tests__/killRites.test.ts` simulates a descent to check every teaching rite can be met with the spells obtainable by its monster's first floor.
