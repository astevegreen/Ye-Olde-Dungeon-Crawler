# Ye Olde Dungeon Crawler — Town Return Mechanics & Codebase Guide

This document provides a comprehensive technical and mechanical breakdown of all return-to-town systems in **Ye Olde Dungeon Crawler** (`c:\Antigravity\YODC`), detailing both the in-game mechanics and their underlying architectural touchpoints across the codebase.

---

## 1. Architectural Overview & Design Philosophy

In classic roguelikes, returning to town to sell loot, rest, identify items, and train is a core gameplay loop. In **Ye Olde Dungeon Crawler**, returning to town is governed by several distinct systems:
- **Zero-Attrition Early Game**: Floors 1–4 rely on conventional physical stairs up to town.
- **Thematic Mid-Dungeon Shortcuts**: Floors 5 through 24 introduce interactive fixtures located in dead-end alcoves on a 3-floor rotation cycle, presenting mini-challenges (tactical rituals, high-speed gauntlets, and physical weight puzzles).
- **Two-Way Planar Link**: Successfully completing any shortcut opens a temporary, two-way planar rift (`TownPortal`) between the town square and the departure tile in the depths.
- **Fail-Safe Invariant**: Failing or declining a town-return shortcut never destroys or locks standard dungeon descent stairs.

---

## 2. The Return Mechanics & Systems

### 1. Standard Up-Stairs (Floor 1 $\rightarrow$ Town)
* **Mechanic**: Stepping on the upward staircase (`<` or Enter) on Dungeon Floor 1 ascends directly into Floor 0 (Town).
* **Requirements**: Standing upon a `stairs_up` tile on Floor 1.
* **Cost**: Consumes standard action energy (`BASE_ACTION_COST`).
* **Behavior**: Transits to Floor 0 without opening a two-way recall portal.

### 2. Dungeon Shortcut Rotation (Floors 5–24)
* **Mechanic**: Every floor between Floor 5 and Floor 24 (excluding the final boss floor on Floor 25) spawns an interactive shortcut fixture in a dead-end alcove or corner room.
* **3-Floor Cycle Formula**:
  $$\text{cycle} = (\text{Floor} - 5) \bmod 3$$
  - `Cycle 0` (Floors 5, 8, 11, 14, 17, 20, 23): **Runic Leyline Conduit**
  - `Cycle 1` (Floors 6, 9, 12, 15, 18, 21, 24): **Valkyrie's Sprint**
  - `Cycle 2` (Floors 7, 10, 13, 16, 19, 22): **Dwarven Counterweight Winch**

### 3. Runic Leyline Conduit (`runic_conduit`)
* **Mechanic**: An ancient terrestrial energy circle requiring a 6-turn tactical extraction ritual.
* **Gameplay Flow**:
  1. **Activation**: Interacting with the conduit awakens all living monsters within a 15-tile radius, setting their AI state to `hunting`.
  2. **Charging Ritual**: Over 6 turns, pulsing cardinal energy nodes appear in the 5x5 zone around the conduit. The hero must step onto 3 active nodes.
  3. **Detonation & Teleport**: Upon reaching 3 charges, the conduit detonates in a radiant flash dealing 50 radiant damage to adjacent monsters, teleports the player to the Temple of Thor in town, records recall coordinates, and opens the return portal.
  4. **Failure Condition**: Exiting the 5x5 ritual boundary or allowing the 6-turn timer to elapse before accumulating 3 charges destabilizes the circle, inflicting magical backlash (-20 HP) and putting the conduit on a 20-turn cooldown.

### 4. Valkyrie's Sprint (`valkyrie_sprint`)
* **Mechanic**: Sounding the ivory Gjallarhorn launches an intense, 3-stage linear escape gauntlet:
  1. **Stage 1 — The Collapsing Chasm**: A 12x8 falling-hazard micro-map. The player must dodge telegraphed rockfall danger tiles within a 5-turn limit to reach the threshold.
  2. **Stage 2 — Shieldwall Barricade**: A reinforced iron portcullis (20 HP) blocks the exit. The player can bash it down, pick its lock, destroy it with spell/weapon attacks, or dispatch the heavy guard defender.
  3. **Stage 3 — The Bifrost Dash**: A corridor guarded by a Jotun Gatekeeper and lightning strikes. Crossing the final threshold bursts through to the town gate.
* **Failure Condition**: Failing or timing out ejects the hero safely back to the Floor entrance with minor bruises; main floor progress and downward stairs remain intact.

### 5. Dwarven Counterweight Winch (`dwarven_winch`)
* **Mechanic**: An industrial mine lift counterweight puzzle based on real physical mass.
* **Gameplay Flow**:
  - The hero inspects an ancient cargo hopper attached to heavy iron lift cables.
  - The winch requires balancing the hopper's weight against the hero's total mass:
    $$\text{Target Weight} = (\text{Player Body Mass [70 kg]} + \text{Carried Inventory Weight}) \times 1.5 \pm 1500\text{g}$$
  - The dungeon spawns heavy cobblestone ballast items (2 kg, 3.5 kg, 4.5 kg, 6 kg) around the lift alcove.
  - The player opens the winch interface to deposit or withdraw ballast stones and miscellaneous gear into the hopper.
  - **Pulling the Lever**:
    - **Balanced**: Engaging the gears hoists the player straight up the mine shaft into town square, linking the two-way return portal.
    - **Unbalanced**: If underweight or overweight beyond the 1.5 kg tolerance, the cable slips, causing fall damage (-10% HP) and halting mid-shaft.

### 6. Two-Way Town Portal (`town_portal`) & Recall Coordinates
* **Mechanic**: Completing any shortcut escape automatically manifests a glowing `TOWN_PORTAL` rift tile in town (default: coordinates `(25, 17)`).
* **Descent Link**: Stepping into the town portal allows instant, free descent back to the exact departure tile on the dungeon floor where the escape occurred.
* **Lifecycle**: Stepping through the portal consumes the link and removes the tile until the next shortcut is activated.

### 7. Gateway to Valhalla (Endgame Victory Portal)
* **Mechanic**: Defeating the final campaign boss (e.g., *Hrungnir*) on `maxFloor` (Floor 25) transforms the boss death tile into the `GATEWAY_VALHALLA` portal (`▲`).
* **Resolution**: Stepping into the gateway triggers run victory, records game completion to the profile manager, and teleports the player to the Hall of Valhalla in town.

---

## 3. Codebase Architecture & Key File Touchpoints

The town return architecture cleanly spans engine subsystems, generation routines, action handlers, presentation modals, and storage serialization:

```
src/
├── engine/
│   ├── townReturn/                     # Core Town Return Subsystem
│   │   ├── types.ts                    # Interfaces: RunicConduitState, ValkyrieSprintState, etc.
│   │   ├── townReturnManager.ts        # Manager class owning conduits, winches, portal, gauntlet
│   │   ├── townPortal.ts               # Two-way recall portal lifecycle & town tile injection
│   │   ├── runicConduit.ts             # Leyline extraction ritual state machine & alert logic
│   │   ├── valkyrieSprint.ts           # 3-stage micro-map generation & escape gauntlet
│   │   └── dwarvenWinch.ts             # Counterweight hopper container & balance evaluation
│   ├── dungeon/
│   │   ├── townReturnDispatcher.ts     # 3-floor shortcut rotation & alcove selection algorithm
│   │   ├── dungeon-generator.ts        # Calls dispatcher to stamp shortcut tiles onto generated maps
│   │   └── spawner.ts                  # Spawns cobblestone ballast piles near winches
│   ├── actions/
│   │   ├── movement.ts                 # Intercepts movement onto shortcut tiles & opens modals
│   │   └── stairs.ts                   # ClimbStairsAction handling Floor 1 -> Town & gauntlet steps
│   ├── entities/
│   │   └── player.ts                   # Stores deepestRecallFloor & recallPosition coordinates
│   ├── storage/
│   │   ├── types.ts                    # SerializedTownReturnData schema definitions
│   │   └── serializer.ts               # Roundtrip serialization of conduits, hoppers, & portal state
│   └── engine.ts                       # Ticks townReturnManager.onPlayerTurn and executes floor switches
├── ui/
│   ├── townReturnModal.ts              # First-encounter tutorial dialog & confirm/cancel prompts
│   └── dwarvenWinchModal.ts            # Windows 95 style hopper item deposit & weight balance UI
└── main.ts                             # Composition root wiring engine callbacks to UI modal stack
```

---

## 4. Subsystem Interaction Matrix

| Subsystem | Source File | Interactions & Responsibilities |
|---|---|---|
| **Town Return Manager** | [`townReturnManager.ts`](file:///c:/Antigravity/YODC/src/engine/townReturn/townReturnManager.ts) | Central container for all active conduits, winches, gauntlets, and portal states. Advances per-turn counters during `GameEngine.onPlayerTurn`. |
| **Shortcut Dispatcher** | [`townReturnDispatcher.ts`](file:///c:/Antigravity/YODC/src/engine/dungeon/townReturnDispatcher.ts) | Implements `(floor - 5) % 3` cycle. Scans room layouts for dead-end alcoves (3 surrounding walls) to place fixtures away from stairs and player spawn. |
| **Movement Pipeline** | [`movement.ts`](file:///c:/Antigravity/YODC/src/engine/actions/movement.ts) | Intercepts handler IDs: `runic_conduit`, `conduit_node`, `valkyrie_sprint`, `dwarven_winch`, `town_portal`, and `gateway_valhalla`. Invokes `engine.onTownReturnInteract`. |
| **Stairs Pipeline** | [`stairs.ts`](file:///c:/Antigravity/YODC/src/engine/actions/stairs.ts) | Handles `stairs_up` ascending to Floor 0, and advances threshold transitions in active Valkyrie gauntlets. |
| **Town Return Modal** | [`townReturnModal.ts`](file:///c:/Antigravity/YODC/src/ui/townReturnModal.ts) | Inspects player `tutorialFlags` (`conduitSeen`, `sprintSeen`, `winchSeen`, `townPortalSeen`) to display explanations on first contact, with standard confirmation prompts thereafter. |
| **Winch Modal** | [`dwarvenWinchModal.ts`](file:///c:/Antigravity/YODC/src/ui/dwarvenWinchModal.ts) | Interactive drag/drop or click-to-transfer inventory interface displaying real-time weight meters (Underweight / Balanced / Overweight). |
| **Engine Core** | [`engine.ts`](file:///c:/Antigravity/YODC/src/engine/engine.ts) | `changeFloor(targetFloor, customSpawn)` handles saving current floor state to `storedFloors`, loading town map (Floor 0), and spawning `TOWN_PORTAL` if active. |
| **Persistence & Serialization** | [`serializer.ts`](file:///c:/Antigravity/YODC/src/engine/storage/serializer.ts) | Serializes conduit cooldowns, winch hopper inventories, active gauntlet stages, and portal destination floors into save files (Schema v9). |

---

## 5. Quick Reference Summary Table

| Shortcut Mechanic | Floor Rotation | Key Challenge / Invariant | On Success | On Failure |
|---|---|---|---|---|
| **Stairs Up** | Floor 1 | None (Direct stairs) | Ascends to Floor 0 | Normal action energy cost |
| **Runic Conduit** | Floors 5, 8, 11, 14, 17, 20, 23 | Collect 3 nodes within 6 turns; alerts monsters in 15 tiles | Teleports to Temple, 50 AoE damage to monsters, opens Town Portal | -20 HP magical backlash, 20-turn cooldown |
| **Valkyrie's Sprint** | Floors 6, 9, 12, 15, 18, 21, 24 | 3 micro-stages: Falling Rocks $\rightarrow$ Portcullis $\rightarrow$ Gatekeeper | Teleports to Town Gate, opens Town Portal | Ejected back to floor entrance unharmed |
| **Dwarven Winch** | Floors 7, 10, 13, 16, 19, 22 | Match hopper weight to $(W_{\text{body}} + W_{\text{gear}}) \times 1.5 \pm 1.5\text{kg}$ | Hoists directly to Town Square, opens Town Portal | Cable slip, -10% HP fall damage |
| **Town Portal** | Town Square (Floor 0) | Consumable return trip | Descends directly to recall departure tile | Portal closes upon entry |
| **Gateway to Valhalla** | Floor 25 (Post-Boss) | Defeat final campaign boss | Grand Victory + Hall of Valhalla teleport | N/A (unlocked after boss death) |
