# Architectural Specification & Engine Invariants

## 1. System Boundaries & Core Invariants
- **Headless Simulation Purity:** All game state, spatial resolution, combat logic, and action pipelines reside strictly inside `src/engine/`. No references to `window`, `document`, DOM nodes, or Canvas contexts may exist in engine code.
- **Public API Surface:** External layers (`src/ui/`, `src/rendering/`) interact with the engine exclusively through `src/engine/index.ts` and `src/engine/engine.ts`. No deep internal imports across architectural layers.
- **Deterministic Action Pipeline:** All turns, actor intents, and environmental reactions flow through `src/engine/actions/actionPipeline.ts` and dispatch to handlers registered in `src/engine/actions/actionRegistry.ts`.
- **Zero-Dependency Single-File Target:** The client builds to a standalone, offline-capable `dist/index.html` via Vite with all assets, styles, and scripts inlined.
- **Bounded Simulation:** Spatial queries, field of view, and environmental reactions evaluate within strictly bounded local radii ($O(K)$ active cells) to preserve deterministic headless execution speed.

---

## 2. Directory Layout & Module Topology
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
│       └── migrator.ts         # Forward-only schema migrations and save hydration
├── rendering/                   # Visual presentation layer (Canvas, sprites, atlas)
│   └── atlas/index.ts          # Texture atlas management and tile blitting
└── ui/                         # User input lifecycle, modal dialogs, and HUD
├── input/
│   └── chordBuffer.ts      # Diagonal arrow-key chording with debounce buffer
└── settings/
└── settingsManager.ts  # Local preferences, movement modes, and hotkey bindings
---

## 3. Storage & Schema Evolution (`src/engine/storage/migrator.ts`)
- **Forward-Only Migrations:** Saves carry an integer schema version (`version: number`). Every breaking schema change increments this version and registers a step in `migrator.ts`.
- **Reference Reconstruction:** Deserialized actors, inventories, and active floor grids must reconstruct reference integrity upon hydration.
- **Graceful Failure:** Corrupted save payloads fail cleanly to an initialization baseline without throwing unhandled exceptions or poisoning browser storage.

---

## 4. Input & Ergonomics Pipeline (`src/ui/input/chordBuffer.ts`)
- **Arrow-Key Chording:** Orthogonal keypresses within a 40ms sliding window combine into diagonal movement vectors before dispatching to the engine.
- **Focus Isolation:** Keydown listeners bound to modal interactions (dialog, inventory, spell selection) must call `event.preventDefault()` to prevent keystrokes from leaking into browser shortcuts or viewport navigation.

---

## 5. Development Invariants & "One Task, One Thread" Protocol
- **No Engine Creep:** Do not alter `src/engine/actions/actionPipeline.ts`, `engine.ts`, or `migrator.ts` unless implementing a confirmed bug fix. New game mechanics, monsters, items, and quests must be implemented via content manifests in `src/content/`.
- **Test Invariant:** Any PR or feature branch must pass the full test suite (`npm test`) and compile cleanly (`npm run build`) before merging.