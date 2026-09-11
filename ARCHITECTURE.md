# Architectural Specification & Engine Invariants

> **AI Context Instruction:** This document defines the hard architectural invariants for the repository. When executing implementation tasks, prioritize these rules over general software patterns. Do not violate system boundaries or introduce platform leaks.

---

## 1. Game Concept & Core Simulation Loops
- **Vision & Genre:** A turn-based, grid-based dungeon crawler and roguelike inspired by *Castle of the Winds*, featuring modular systems to support variable narrative campaigns and thematic content packs (e.g., WarCraft, Garth Nix's *The Old Kingdom*).
- **Core Gameplay Loop:** Headless turn execution -> actor intent / environment tick -> spatial calculation -> tactical bump combat / spellcasting / inventory management -> level transition / floor progression.
- **Target Aesthetic:** Clean, retro tile-blitted presentation rendered via Canvas texture atlases, coupled with responsive modal dialogs and diagonal arrow-key chording.

---

## 2. System Boundaries & Tech Stack Invariants
- **Language & Build Target:** TypeScript with Vite, compiling to an offline-capable, zero-dependency single-file bundle (`dist/index.html`) with all assets, styles, and scripts inlined.
- **Headless Simulation Purity:** All game state, spatial resolution, combat logic, and action pipelines reside strictly inside `src/engine/`. No references to `window`, `document`, DOM nodes, or Canvas contexts may exist in engine code.
- **Public API Surface:** External layers (`src/ui/`, `src/rendering/`) interact with the engine exclusively through `src/engine/index.ts` and `src/engine/engine.ts`. No deep internal imports across architectural layers.
- **Deterministic Action Pipeline:** All turns, actor intents, and environmental reactions flow through `src/engine/actions/actionPipeline.ts` and dispatch to handlers registered in `src/engine/actions/actionRegistry.ts`.
- **Bounded Simulation:** Spatial queries, field of view, and environmental reactions evaluate within strictly bounded local radii ($O(K)$ active cells) to preserve deterministic headless execution speed.

---

## 3. Directory Layout & Module Topology

```
src/
├── content/                     # Data manifests, item definitions, and encounter tables
│   ├── cotw/index.ts           # Primary Castle of the Winds content pack
│   └── warcraft/index.ts       # Secondary/thematic alternate content pack
├── engine/                      # Headless, platform-agnostic simulation engine
│   ├── index.ts                # Public engine barrel export
│   ├── engine.ts               # Simulation loop coordinator and state holder
│   ├── actions/                # Action definitions, registry, and execution pipeline
│   │   ├── action.ts           # Base action interfaces and capability contracts
│   │   ├── actionPipeline.ts   # Sequential action execution, validation, and hook dispatch
│   │   ├── actionRegistry.ts   # Dynamic registry mapping action IDs to handler functions
│   │   ├── choiceAction.ts     # Branching dialog, interactive choices, and narrative forks
│   │   ├── identificationActions.ts # Item identification and appraisal logic
│   │   ├── inventory-actions.ts # Pickup, drop, equip, unequip, and container interaction
│   │   ├── planeActions.ts     # Multi-plane transitions and spatial threshold actions
│   │   ├── spell-actions.ts    # Spell casting, targeting vectors, and mana consumption
│   │   └── vaultActions.ts     # Modular room stamping and conditional prefab mechanics
│   ├── debug/                  # Simulation telemetry and diagnostic tooling
│   │   └── flightRecorder.ts   # In-memory deterministic action log and replay recorder
│   └── storage/                # State serialization, schema migrations, and save hygiene
│       ├── compaction.ts       # Payload compression and sparse state serialization
│       └── migrator.ts         # Forward-only schema migrations (Schema v3 baseline)
├── rendering/                   # Visual presentation layer (Canvas, sprites, atlas)
│   └── atlas/index.ts          # Texture atlas management and tile blitting
└── ui/                         # User input lifecycle, modal dialogs, and HUD
    ├── input/
    │   └── chordBuffer.ts      # Diagonal arrow-key chording with debounce buffer
    └── settings/
        └── settingsManager.ts  # Local preferences, movement modes, and hotkey bindings
```

---

## 4. Storage & Schema Evolution (`src/engine/storage/migrator.ts`)
- **Forward-Only Migrations:** Saves carry an integer schema version (`version: number`). Every breaking schema change increments this version and registers a step in `migrator.ts`.
- **Reference Reconstruction:** Deserialized actors, inventories, and active floor grids must reconstruct reference integrity upon hydration.
- **Save Hygiene & Portability:** Browser `localStorage` sandbox with state compaction (`compaction.ts`) and native `Blob`/`File` API save export/import.
- **Graceful Failure:** Corrupted save payloads fail cleanly to an initialization baseline without throwing unhandled exceptions or poisoning browser storage.

---

## 5. Input & Presentation Lifecycle
- **Atlas Blitting:** HTML5 Canvas manages texture atlases and coordinate-to-screen transforms (`src/rendering/atlas/index.ts`).
- **Arrow-Key Chording:** Orthogonal keypresses within a sliding window combine into diagonal movement vectors before dispatching to the engine (`src/ui/input/chordBuffer.ts`).
- **Focus Isolation:** Keydown listeners bound to modal interactions (dialog, inventory, spell selection) must call `event.preventDefault()` to prevent keystrokes from leaking into browser shortcuts or viewport navigation.

---

## 6. Development Invariants & Quality Gates
- **No Engine Creep:** Do not alter `src/engine/actions/actionPipeline.ts`, `engine.ts`, or `migrator.ts` unless implementing a confirmed bug fix. New game mechanics, monsters, items, and quests must be implemented via content manifests in `src/content/`.
- **Strict Headless Isolation:** Never import or reference DOM, Canvas, or browser APIs inside `src/engine/`.
- **Seeded Simulation:** Never use unseeded `Math.random()` inside simulation code; all procedural generation and combat rolls must route through the engine's seeded PRNG.
- **Quality Gates:** Any pull request or feature addition must pass unit verification (`npm test`) and produce a valid offline bundle (`npm run build`) before merging.