# Task: Attribute Milestone Ability Tree + Consolidated Character Menu

You are implementing two features in `C:\Antigravity\YODC`. Read `ARCHITECTURE.md` in full before
starting, and follow `.antigravity/rules.md` — every invariant and verification gate there applies.
Nothing below overrides those rules.

**Work Task A first. Complete it, run all gates, and report before starting Task B.** They are
independent; do not interleave them.

---

## Shared ground rules for both tasks

- **Do not modify protected files.** `src/engine/engine.ts`, `src/engine/actions/actionPipeline.ts`,
  and `src/engine/storage/migrator.ts` must not change. Neither task needs them. If you believe one
  does, stop and explain why instead of editing it.
- **Do not change the save format.** Both features persist through existing `WorldState` flags, which
  already serialize. Do not touch `CURRENT_SCHEMA_VERSION` and do not add a migration step.
- **No engine creep (§3).** The engine gets a generic, reusable manifest field. All names, numbers,
  flavor text, and bonuses live in `src/content/cotw/`. `warcraft` declares none of this and must
  build and behave exactly as it does today.
- **Both packs must keep working.** Run `npm run build:all`, not just `npm run build`.

---

# TASK A — Attribute Milestone Ability Tree

## Goal

When a player raises an attribute to a declared threshold (e.g. Dexterity reaches 15), they are
offered a one-time choice between two permanent bonuses. This is a generic engine capability;
`cotw` supplies the actual milestones and bonuses.

## Why this design

Everything needed already exists. `ChoiceDefinition` + `applyConsequences()` already implement
branching choices with permanent stat changes, and `StoryChoiceTrigger` is already the established
pattern for "a manifest-declared trigger that unlocks a choice when a *progress* condition is met."
You are adding a sibling of `StoryChoiceTrigger`, not inventing a new mechanism. Copy its shape.

## A1. Engine — generic manifest field

In `src/engine/types/manifest.ts`, directly below the existing `StoryChoiceTrigger` interface
(around line 335), add:

```ts
/** Attribute-threshold-gated choice unlocks (ARCHITECTURE.md §3). Sibling of `StoryChoiceTrigger`:
 *  same one-time `<id>_offered` world-flag idiom, keyed on an attribute value instead of kill count. */
export interface AttributeMilestoneTrigger {
  /** Stable id, used for its own `<id>_offered` internal flag. */
  id: string;
  attribute: 'strength' | 'dexterity' | 'constitution' | 'intelligence';
  /** Fires once the attribute is at or above this value. */
  threshold: number;
  /** Key into `manifest.choices`. */
  choiceId: string;
}
```

Add the field to `GameContentManifest`, next to `storyChoiceTriggers` (around line 467):

```ts
/** Attribute-threshold-gated choice unlocks (ARCHITECTURE.md §3, `AttributeMilestoneTrigger`). */
attributeMilestones?: AttributeMilestoneTrigger[];
```

## A2. Engine — the trigger check

In `src/engine/actions/movement.ts`, immediately **after** the existing `storyChoiceTriggers` loop
(which ends around line 275, just before the `bossFleeResolutions` loop), add a matching loop.

Mirror the existing loop exactly: read the value, skip if the condition is unmet, skip if the
`<id>_offered` flag is already set, resolve `choiceId` against `engine.manifest?.choices`, set the
flag **before** presenting, then present through `engine.onChoiceInteract` with the same
`ExecuteChoiceAction` callback, falling back to `engine.log(...)` when no handler is wired.

Checking on player movement (rather than inside `Player.allocateAttribute`) is deliberate, for three
reasons — put a brief comment saying so:
- It matches `StoryChoiceTrigger`: the condition is *progress*, not location.
- `allocateAttribute` is a pure mutator called from `src/ui/levelUpModal.ts`; it has no engine
  handle and must not gain one.
- It avoids opening a choice modal on top of the still-open level-up modal.

**Do not modify `Player.allocateAttribute`.** It stays a bare mutator.

## A3. Content — cotw milestones

In `src/content/cotw/choices.ts`, add `ChoiceDefinition` entries with **exactly two options each**.
Suggested set (adjust flavor to fit the Norse setting and existing voice):

| Milestone id | Attribute | Threshold | Choice theme |
|---|---|---|---|
| `milestone_dex_15` | dexterity | 15 | Precision (attack) vs. Evasion (defense) |
| `milestone_str_15` | strength | 15 | Raw power vs. carry capacity |
| `milestone_con_15` | constitution | 15 | Vitality vs. resilience |
| `milestone_int_15` | intelligence | 15 | Spell power vs. mana pool |

Use existing `ChoiceConsequence` variants only — `modifyPermanentStat` and world flags are already
supported. Do not add new consequence types. If a bonus you want isn't expressible with what
exists, pick a different bonus rather than widening the engine.

Wire the array in `src/content/cotw/index.ts` as `attributeMilestones`.

## A4. Tests

Add `src/engine/actions/__tests__/attributeMilestones.test.ts`:
1. Crossing the threshold offers the choice exactly once (second move does not re-offer).
2. Below the threshold, nothing fires.
3. A manifest declaring no `attributeMilestones` fires nothing (proves `warcraft` is unaffected).
4. A milestone whose `choiceId` is missing from `manifest.choices` is skipped without throwing.
5. The `<id>_offered` flag survives a save/load round trip, so the choice is not re-offered.

Add to the existing cotw content test suite: every `attributeMilestones[].choiceId` resolves to a
real `manifest.choices` entry, and each referenced choice has exactly two options.

## A5. Acceptance

- All five gates pass (below).
- `ARCHITECTURE.md` §3 gains a bullet describing `AttributeMilestoneTrigger`, written in the same
  voice as the neighbouring `StoryChoiceTrigger` bullet (§8.2 requires this in the same change).
- `git diff` touches no protected file and no schema constant.

---

# TASK B — Consolidated Character Menu

## Goal

Replace scattered single-purpose menus with one tabbed shell: **Inventory, Character, Spellbook,
Bestiary, Pacts, Story**. Existing keybinds keep working — each opens the shell focused on its tab.

## ⚠ The architectural trap — read this before writing any code

`src/ui/` may import **types only** from `src/rendering/` (§3, enforced by `check:engine-purity`).
The inventory UI lives at `src/rendering/inventory-overlay.ts` — a *runtime value*. So a tabbed
shell placed in `src/ui/` that imports the inventory overlay directly **will fail the purity gate.**

Use dependency inversion instead:

- `src/ui/characterMenu/menuTab.ts` defines a `MenuTab` interface:

  ```ts
  import type { GameState } from '../flanks/types';

  export interface MenuTab {
    id: string;
    label: string;
    /** ACTION_METADATA id whose keybind opens the shell focused on this tab. */
    hotkeyActionId?: string;
    mount(container: HTMLElement): void;
    /** Called every time this tab becomes the active one. Pull fresh state here. */
    onActivate(state: GameState): void;
    unmount(): void;
    /** Return true if the key was consumed; the shell handles only what you decline. */
    handleKeyDown(e: KeyboardEvent): boolean;
  }
  ```

  `onActivate` exists because some tabs wrap render-only modules that need state pushed at them
  (see the Story tab below). **A once-per-activation call is sufficient — do not build a
  per-turn render pump.** Opening a modal pauses the simulation (§6), so world state cannot
  change underneath an open tab. The exception is a tab that mutates state itself (Inventory
  equip/drop), which already owns its own re-render and must keep doing so.
- `src/ui/characterMenu/characterMenuModal.ts` is the shell. It `implements UIModal`, owns tab
  switching and chrome, and knows nothing about any concrete tab.
- `src/main.ts` — the composition root, the only module allowed to import every layer — constructs
  the concrete tab adapters (including the rendering-side inventory one) and registers them with
  the shell.

If you find yourself adding a `src/rendering/` runtime import to a `src/ui/` file, stop: the design
is wrong, not the rule.

## B0. Prerequisite — normalize two classes onto `UIModal`

Of the menus being consolidated, these two do not implement `UIModal` (`src/ui/modalStack.ts`):

- `src/rendering/inventory-overlay.ts`
- `src/ui/help/compendiumModal.ts`

Give each the `UIModal` shape (`id`, `isOpen` as a **property**, `handleKeyDown`, `close`, optional
`open`/`onPush`/`onPop`) and drop the bespoke adapter `src/main.ts` currently wraps them in.
`src/ui/spellbookModal.ts`, `src/ui/levelUpModal.ts`, `src/ui/pactModal.ts`, and
`src/ui/runeOfReturnTreeModal.ts` already conform — leave them alone.

**Do not touch** `inspect-overlay.ts`, `map-overlay.ts`, `intentOverlay.ts`, `mouseVectorOverlay.ts`,
or `radialMenu.ts`. ARCHITECTURE.md §6 documents these as deliberately intercepted inline by
`InputHandler`; they are not menus and are out of scope.

**This step must land and pass all gates on its own before you build the shell.** Behavior must be
identical to before — this is a pure interface normalization.

## B1. The shell

- Registers on `ModalStackManager` like every other modal (§6). Do not bypass it.
- `Tab` / `Shift+Tab` cycle tabs; `Escape` closes the whole shell; the active tab gets first refusal
  on every other key via its `handleKeyDown`, and the shell only handles what the tab declines.
- Opening is keybind-driven through the existing `SettingsManager`/`ACTION_METADATA` system. Reuse
  the current bindings so muscle memory survives: `KeyI` → Inventory, `KeyZ` → Spellbook,
  `KeyB` → Bestiary, `KeyP` → Pacts.
- Add one new remappable action id for the shell itself (suggest `character_menu`) in
  `ACTION_METADATA`, defaulting to **`KeyE`**. There is no character-sheet keybind today — the
  level-up modal only auto-opens on level up — so this is genuinely new surface, and the Character
  tab needs its own way in.
- **Key availability is already verified; do not re-derive it.** `KeyC` is taken (`close_door`),
  `KeyQ` is a hardcoded save-and-quit in `src/rendering/input-handler.ts:779`, and `Backquote`/`F2`
  are the diagnostics toggle at `input-handler.ts:345` — none of these three appear in
  `ACTION_METADATA`, so grepping that file alone would wrongly show them free. The verified-free
  set is **`KeyE`, `KeyF`, `KeyO`**. Pick from it; say which you used.

## B2. The tabs

Wrap existing implementations; do not rewrite their internals.

| Tab | Source |
|---|---|
| Inventory | `src/rendering/inventory-overlay.ts` |
| Character | `src/ui/levelUpModal.ts` content — stat allocation must stay reachable even with 0 unspent points |
| Spellbook | `src/ui/spellbookModal.ts` |
| Bestiary | `src/ui/help/compendiumModal.ts` |
| Pacts | `src/ui/pactModal.ts` |
| Story | `src/ui/flanks/journalModule.ts` + `src/ui/flanks/worldLedgerModule.ts` — see the special handling below |

If Task A is already merged, surface unresolved attribute milestones on the Character tab.

### The Story tab needs an adapter — read carefully

`JournalModule` and `WorldLedgerModule` implement `FlankModule`, which is a **different shape** from
`MenuTab` and has **no keyboard handling at all**:

```ts
FlankModule = { id, title, mount(container), render(state), destroy? }
```

Write a `FlankModuleTab` adapter in `src/ui/characterMenu/` that maps between them:

| `MenuTab` | maps to `FlankModule` |
|---|---|
| `label` | `title` |
| `mount(container)` | `mount(container)` |
| `onActivate(state)` | `render(state)` ← **this is the one that is easy to miss** |
| `unmount()` | `destroy()` |
| `handleKeyDown(e)` | return `false` — these modules are read-only, so the shell keeps `Escape`/tab-cycling |

If you skip the `onActivate → render(state)` mapping, the Story tab will mount its DOM skeleton and
then display permanently empty/stale panels, because `mount()` only writes the static shell —
all real content is written by `render(state)`.

### Mirroring: construct separate module instances

`JournalModule` and `WorldLedgerModule` are **already mounted as persistent flank columns** in
`src/main.ts` (registered around lines 99–100, mounted at ~1354, re-rendered by `renderFlanks()` at
~405). The decision for this task is to **mirror**: the flank columns stay exactly as they are, and
the Story tab shows the same information as a second copy.

Therefore `src/main.ts` must construct **new, separate instances** for the Story tab:

```ts
// Story tab gets its own instances; the flank columns keep theirs.
const storyTab = new FlankModuleTab([new JournalModule(), new WorldLedgerModule()]);
```

**Do not pass the flank-registered instances into the tab.** Both modules hold a single private
`this.container` that `mount()` overwrites ([journalModule.ts:9-10](src/ui/flanks/journalModule.ts),
[worldLedgerModule.ts:43-44](src/ui/flanks/worldLedgerModule.ts)). Re-mounting a live flank instance
into the tab would repoint it at the modal's DOM, and the flank column would silently stop updating.

Do not change `flankLayout`, the flank CSS, or `renderFlanks()`. The flank columns must look and
behave exactly as they do today — verify this by eye before reporting done.

## B3. Tests

- Extend `src/ui/__tests__/modalStack.test.ts` (or add a sibling) covering: the shell pushes/pops
  correctly, `Escape` closes it, tab cycling wraps at both ends, and an unhandled key does not leak
  through to the simulation.
- A test asserting each legacy keybind opens the shell on the expected tab.
- A test that activating the Story tab calls `render(state)` on its wrapped flank modules, so the
  missing-`onActivate` failure mode above cannot regress silently.
- A test that the Story tab's module instances are distinct objects from the flank-mounted ones.
- Existing modal tests must keep passing unchanged. If one needs editing, say why in your report —
  that is a signal the normalization changed behavior it should not have.

## B4. Acceptance

- All five gates pass.
- `check:engine-purity` reports zero violations — specifically, no new `src/ui/` → `src/rendering/`
  runtime imports.
- `ARCHITECTURE.md` §6 is updated: the modal inventory list and the note about modal classes
  predating `UIModal` are now partly inaccurate and must describe the new state (§8.2).

---

## Verification gates — run all five, paste real output

```
npm run lint
npm test
npm run sim
npm run validate:schema
npm run build:all
```

Saying they "should pass" does not count. If a gate fails, fix the cause — do not weaken a test,
add to the `check:engine-encapsulation` allowlist, or special-case a checker to make it green.

## Report format

For each task, report: files changed, which invariants were relevant and how you satisfied them,
the real gate output, and anything you had to decide that this prompt did not specify.

If any instruction here contradicts `ARCHITECTURE.md`, **stop and flag it** — do not pick a side.
