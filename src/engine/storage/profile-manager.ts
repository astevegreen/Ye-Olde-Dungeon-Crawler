import { PRNG } from '../dungeon/prng';
import { offloadInactiveFloors } from './floorCachePolicy';
import type { BulkArchive } from './bulkArchive';
import { classifyLoadError, MISSING_SAVE, type LoadOutcome } from './loadResult';
import { DungeonGenerator } from '../dungeon/dungeon-generator';
import { TownMapGenerator } from '../town/townMap';
import { Player } from '../entities/player';
import { GameEngine } from '../engine';
import { ItemFactory } from '../items/factory';
import type { Merchant } from '../economy/merchant';
import type { GameMap } from '../grid/map';
import { serializeGame, deserializeGame } from './serializer';
import type { CharacterProfile, RosterManifest, SaveData, StorageAdapter } from './types';
import { CharacterRoller } from '../character/characterRoller';
import type { CharacterAttributes, Gender } from '../character/types';
import { defaultMigrator, CURRENT_SCHEMA_VERSION, type VersionedSaveEnvelope } from './migrator';
import { generateSaveFilename, createSavePackage } from './saveTransfer';
import type { GameContentManifest } from '../types/manifest';
import type { GameDifficulty } from '../types';
import { DIFFICULTY_MAX_FLOORS, DEFAULT_DIFFICULTY } from '../types';

/** Minimal download adapter interface — implemented by PlatformAdapter in src/ui/platform.ts */
export interface DownloadAdapter {
  triggerFileDownload(filename: string, content: string, mimeType: string): void;
}

export const ROSTER_MANIFEST_KEY = 'cotw_roster_manifest';
export const SAVE_KEY_PREFIX = 'cotw_save_';

export const DEFAULT_HEADLESS_MANIFEST: GameContentManifest = {
  id: 'headless_default',
  name: 'Headless Dungeon',
  monsters: [],
  items: [],
  spells: [],
  town: {
    name: 'Town',
    width: 50,
    height: 30,
    playerSpawn: { x: 5, y: 5 },
    stairsDown: { x: 25, y: 15 },
    buildings: [],
    npcs: [],
  },
  quest: {
    id: 'headless_quest',
    name: 'Dungeon Crawl',
    maxFloor: 5,
    bossFloor: 5,
    bossMonsterId: 'boss_hrungnir',
    relicItemId: 'sun_stone_freyr',
    victoryNpcId: 'npc-olaf',
    victoryFloor: 0,
    victoryDialogue: 'Victory!',
    victoryScoreBonus: 1000,
    bossFloorLayout: {
      width: 44,
      height: 34,
      playerSpawn: { x: 22, y: 28 },
      stairsUp: { x: 22, y: 29 },
      bossSpawn: { x: 22, y: 7 },
    },
    floorEncounters: {},
  },
  atlas: { themeId: 'classic' },
  starterKit: {
    weaponItemId: 'dagger',
    purseItemId: 'coin_purse',
    coins: [
      { denomination: 'copper', count: 50 },
      { denomination: 'silver', count: 10 },
      { denomination: 'gold', count: 2 },
    ],
    beltItemId: 'utility_belt',
    beltSlotItemIds: ['wand_lightning'],
    packItemIds: ['travel_bread', 'health_potion', 'mana_potion', 'scroll_phase_door'],
  },
};

export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

export function getDefaultStorage(): StorageAdapter {
  return new MemoryStorage();
}

export class ProfileManager {
  private storage: StorageAdapter;
  private defaultManifest?: GameContentManifest;
  public static defaultManifest?: GameContentManifest;

  constructor(storage?: StorageAdapter, defaultManifest?: GameContentManifest) {
    this.storage = storage ?? getDefaultStorage();
    this.defaultManifest = defaultManifest ?? ProfileManager.defaultManifest;
  }

  public get manifest(): GameContentManifest | undefined {
    return this.defaultManifest;
  }

  public get manifestId(): string {
    return this.defaultManifest?.id ?? 'cotw';
  }

  public get rosterKey(): string {
    return `${this.manifestId}_profile_roster_v2`;
  }

  public get saveKeyPrefix(): string {
    return `${this.manifestId}_save_`;
  }

  public getManifest(): RosterManifest {
    let raw = this.storage.getItem(this.rosterKey);
    if (!raw && this.manifest?.supportsLegacyKeys === true) {
      raw = this.storage.getItem(ROSTER_MANIFEST_KEY);
    }
    if (!raw) {
      return { profiles: [] };
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.profiles)) {
        return parsed as RosterManifest;
      }
      return { profiles: [] };
    } catch {
      return { profiles: [] };
    }
  }

  private saveManifest(manifest: RosterManifest): void {
    try {
      this.storage.setItem(this.rosterKey, JSON.stringify(manifest));
    } catch (e: any) {
      if (
        e?.name === 'QuotaExceededError' ||
        e?.code === 22 ||
        e?.code === 1014 ||
        e?.number === -2147024882
      ) {
        throw new Error(
          'Local storage quota exceeded. Please delete or export older character saves to free space.'
        );
      }
      throw e;
    }
  }

  public listProfiles(): CharacterProfile[] {
    return this.getManifest().profiles;
  }

  public getProfile(profileId: string): CharacterProfile | null {
    return this.listProfiles().find((p) => p.id === profileId) ?? null;
  }

  /**
   * Rolls a new adventurer, generates initial town or dungeon floor, seeds gear and coins, and saves.
   */
  public createCharacter(
    name: string,
    options?: {
      gender?: Gender;
      difficulty?: GameDifficulty;
      maxFloor?: number;
      attributes?: CharacterAttributes;
      strength?: number;
      hp?: number;
      seed?: number;
      startInTown?: boolean;
      manifest?: GameContentManifest;
    }
  ): { profile: CharacterProfile; engine: GameEngine } {
    const trimmedName = name.trim() || 'Adventurer';
    // purity-allow: profile identity is storage metadata, not simulation state — seeding it would collide across characters sharing a seed (ARCHITECTURE.md §7.2)
    const profileId = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const gender = options?.gender ?? 'male';
    const difficulty = options?.difficulty ?? DEFAULT_DIFFICULTY;
    const maxFloor = options?.maxFloor ?? DIFFICULTY_MAX_FLOORS[difficulty];
    const manifest = options?.manifest ?? this.defaultManifest ?? DEFAULT_HEADLESS_MANIFEST;

    const attributes: CharacterAttributes = options?.attributes ?? {
      strength: options?.strength ?? 15,
      intelligence: 15,
      constitution: 15,
      dexterity: 15,
    };
    const derived = CharacterRoller.calculateDerivedStats(attributes);
    const maxHp = options?.hp ?? (options?.attributes ? derived.maxHp : 35);
    const maxMana = options?.attributes ? derived.maxMana : 30;
    const startInTown = options?.startInTown ?? true;

    let map: GameMap;
    let playerSpawn: { x: number; y: number };
    let startingFloor = 0;
    const initialMerchants = new Map<string, Merchant>();

    if (startInTown) {
      startingFloor = 0;
      const townGen = new TownMapGenerator(50, 30, manifest.town);
      const town = townGen.generate();
      map = town.map;
      playerSpawn = town.playerSpawn;
      for (const [k, m] of town.merchants) {
        initialMerchants.set(k, m);
      }
    } else {
      startingFloor = 1;
      const generator = new DungeonGenerator({
        width: 48,
        height: 32,
        maxRooms: 10,
        minRoomSize: 5,
        maxRoomSize: 10,
        seed: options?.seed,
        spawnMonsters: true,
      });
      const dungeon = generator.generate();
      map = dungeon.map;
      playerSpawn = dungeon.playerSpawn;

      // Seed Ground Loot in starting dungeon room
      const startRoom = dungeon.rooms[0];
      if (startRoom) {
        map.addItemAt(
          Math.min(startRoom.x2 - 1, playerSpawn.x + 1),
          playerSpawn.y,
          ItemFactory.createBroadsword(`${profileId}-ground-sword`)
        );
        map.addItemAt(
          playerSpawn.x,
          Math.min(startRoom.y2 - 1, playerSpawn.y + 1),
          ItemFactory.createWoodenShield(`${profileId}-ground-shield`)
        );
        map.addItemAt(
          Math.max(startRoom.x1 + 1, playerSpawn.x - 1),
          playerSpawn.y,
          ItemFactory.createLeatherArmor(`${profileId}-ground-armor`)
        );
      }
    }

    // 2. Initialize Player with rolled attributes
    const player = new Player({
      id: profileId,
      name: trimmedName,
      gender,
      difficulty,
      maxFloor,
      position: playerSpawn,
      strength: attributes.strength,
      intelligence: attributes.intelligence,
      constitution: attributes.constitution,
      dexterity: attributes.dexterity,
      stats: { hp: maxHp, maxHp, attack: derived.baseAttack, defense: derived.baseDefense },
      speed: derived.speed,
      mana: maxMana,
      maxMana,
      spellsKnown: manifest.starterKit?.spellsKnown ?? (manifest.spells?.length ? manifest.spells.map(s => s.id) : undefined),
    });

    // 3. Equip starting kit.
    // The run's seeded stream is created here, before the engine, so starting gear rolls
    // come from the same PRNG the engine then continues (ARCHITECTURE.md §7.2).
    const runPrng = new PRNG(options?.seed ?? (Date.now() >>> 0));
    CharacterRoller.equipStartingKit(player, profileId, manifest.starterKit, manifest.items, () => runPrng.next());

    // 4. Initialize Engine
    const engine = new GameEngine({
      prng: runPrng,
      map,
      player,
      fovRadius: 8,
      floor: startingFloor,
      manifest,
    });
    for (const [k, m] of initialMerchants) {
      engine.merchants.set(k, m);
    }

    if (startInTown) {
      engine.log(`Welcome to ${manifest.town?.name ?? 'the town'}, ${trimmedName}! Visit the shops to gear up before braving the cellar.`);
    } else {
      engine.log(`Welcome, ${trimmedName}! Press [I] for Inventory, [G] to pick up items.`);
    }

    // 5. Register profile and save game state
    const profile: CharacterProfile = {
      id: profileId,
      name: trimmedName,
      gender: player.gender,
      difficulty,
      maxFloor,
      attributes: player.attributes,
      questStatus: 'active',
      level: 1,
      floor: startingFloor,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
      mana: player.mana,
      maxMana: player.maxMana,
      xp: player.xp,
      xpToNextLevel: player.xpToNextLevel,
      manifestId: manifest.id,
    };

    this.saveCharacter(engine, profile);
    return { profile, engine };
  }

  /**
   * Serializes current engine state and updates character profile in manifest.
   */
  private bulkArchive: BulkArchive | null = null;

  /**
   * Attaches the asynchronous bulk tier, enabling `saveCharacterBounded`
   * (ARCHITECTURE.md §5).
   */
  public setBulkArchive(archive: BulkArchive | null): void {
    this.bulkArchive = archive;
  }

  /**
   * Saves with a bounded payload: inactive floors are written to the async tier *first*,
   * then the synchronous payload is written carrying only the active floor and the
   * archived floor numbers.
   *
   * This is async by necessity. Trimming floors out of a synchronous write before their
   * archive write has completed would lose them if the archive failed, so the offload is
   * awaited and the trim only covers floors that actually landed. Without an archive
   * attached it behaves exactly like `saveCharacter`.
   */
  public async saveCharacterBounded(engine: GameEngine, profile: CharacterProfile): Promise<void> {
    if (!this.bulkArchive) {
      this.saveCharacter(engine, profile);
      return;
    }

    const saveData = serializeGame(engine, profile);
    try {
      await offloadInactiveFloors(saveData, profile.id, this.bulkArchive);
    } catch {
      // Archive unavailable: fall back to the full inline payload rather than losing floors.
      saveData.archivedFloors = [];
    }
    this.writeSave(saveData, engine, profile);
  }

  public saveCharacter(engine: GameEngine, profile: CharacterProfile): void {
    this.writeSave(serializeGame(engine, profile), engine, profile);
  }

  /** Writes an already-serialized payload and updates the roster. */
  private writeSave(saveData: SaveData, engine: GameEngine, profile: CharacterProfile): void {
    const envelope: VersionedSaveEnvelope<SaveData> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      contentManifestId: engine.manifest?.id ?? this.manifestId,
      timestamp: Date.now(),
      data: saveData,
    };
    const saveKey = `${this.saveKeyPrefix}${profile.id}`;

    // Store isolated save payload with quota safety
    try {
      this.storage.setItem(saveKey, JSON.stringify(envelope));
    } catch (e: any) {
      if (
        e?.name === 'QuotaExceededError' ||
        e?.code === 22 ||
        e?.code === 1014 ||
        e?.number === -2147024882
      ) {
        throw new Error(
          'Local storage quota exceeded. Please delete or export older character saves to free space.'
        );
      }
      throw e;
    }

    // Update roster manifest
    const manifest = this.getManifest();
    const existingIdx = manifest.profiles.findIndex((p) => p.id === profile.id);
    const updatedProfile: CharacterProfile = {
      ...profile,
      gender: engine.player.gender,
      attributes: engine.player.attributes,
      questStatus: profile.questStatus ?? 'active',
      level: engine.player.level,
      xp: engine.player.xp,
      xpToNextLevel: engine.player.xpToNextLevel,
      hp: engine.player.hp,
      maxHp: engine.player.maxHp,
      strength: engine.player.strength,
      mana: engine.player.mana,
      maxMana: engine.player.maxMana,
      lastSaved: Date.now(),
    };

    if (existingIdx !== -1) {
      manifest.profiles[existingIdx] = updatedProfile;
    } else {
      manifest.profiles.unshift(updatedProfile);
    }
    manifest.activeProfileId = profile.id;
    this.saveManifest(manifest);
  }

  /**
   * Loads and deserializes a character save by profile ID.
   */
  /**
   * Loads a character, reporting *why* a load failed (ARCHITECTURE.md §5). Presentation
   * notifies the player for every reason except `missing`.
   */
  public loadCharacterResult(
    profileId: string,
    manifest?: GameContentManifest
  ): LoadOutcome<{ engine: GameEngine; profile: CharacterProfile }> {
    const saveKey = `${this.saveKeyPrefix}${profileId}`;
    let raw = this.storage.getItem(saveKey);
    if (!raw && this.manifest?.supportsLegacyKeys === true) {
      raw = this.storage.getItem(`${SAVE_KEY_PREFIX}${profileId}`);
    }
    if (!raw) {
      return MISSING_SAVE;
    }

    try {
      const { envelope } = defaultMigrator.migrate(raw);
      const effectiveManifest = manifest ?? this.defaultManifest ?? DEFAULT_HEADLESS_MANIFEST;
      const result = deserializeGame(envelope.data, effectiveManifest);

      // Update active profile in roster
      const roster = this.getManifest();
      roster.activeProfileId = profileId;
      this.saveManifest(roster);

      return { ok: true, value: result };
    } catch (err) {
      const failure = classifyLoadError(err);
      console.error(`Failed to load save for ${profileId} (${failure.reason}):`, err);
      return failure;
    }
  }

  /** Back-compatible shape: the loaded game, or `null` for any failure. */
  public loadCharacter(
    profileId: string,
    manifest?: GameContentManifest
  ): { engine: GameEngine; profile: CharacterProfile } | null {
    const outcome = this.loadCharacterResult(profileId, manifest);
    return outcome.ok ? outcome.value : null;
  }

  /**
   * Deletes a character and removes isolated save payload without affecting other profiles.
   */
  public deleteCharacter(profileId: string): boolean {
    const saveKey = `${this.saveKeyPrefix}${profileId}`;
    this.storage.removeItem(saveKey);
    if (this.manifest?.supportsLegacyKeys === true) {
      this.storage.removeItem(`${SAVE_KEY_PREFIX}${profileId}`);
    }

    const manifest = this.getManifest();
    const prevCount = manifest.profiles.length;
    manifest.profiles = manifest.profiles.filter((p) => p.id !== profileId);

    if (manifest.activeProfileId === profileId) {
      manifest.activeProfileId = manifest.profiles[0]?.id;
    }

    this.saveManifest(manifest);
    return manifest.profiles.length < prevCount;
  }

  /**
   * Exports character save state as a portable JSON string.
   */
  public exportHero(profileId: string): string {
    const saveKey = `${this.saveKeyPrefix}${profileId}`;
    let raw = this.storage.getItem(saveKey);
    if (!raw && this.manifest?.supportsLegacyKeys === true) {
      raw = this.storage.getItem(`${SAVE_KEY_PREFIX}${profileId}`);
    }
    if (!raw) {
      throw new Error(`Save state for character ID ${profileId} not found.`);
    }
    return raw;
  }

  /**
   * Validates and imports an external save payload into the local roster.
   */
  public importHero(jsonString: string): CharacterProfile {
    let envelope: VersionedSaveEnvelope<SaveData>;
    try {
      const migrationResult = defaultMigrator.migrate(jsonString);
      envelope = migrationResult.envelope as VersionedSaveEnvelope<SaveData>;
    } catch {
      throw new Error('Invalid JSON save file format.');
    }

    const parsed = envelope.data;
    if (!parsed.profile || !parsed.player || !parsed.map) {
      throw new Error('Incomplete save data: missing profile, player, or map.');
    }

    // Ensure imported profile has a valid unique ID if collision occurs
    let profileId = parsed.profile.id;
    const existing = this.getProfile(profileId);
    if (existing) {
      // purity-allow: see the profile-id note above — identity, not simulation state
      profileId = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      parsed.profile.id = profileId;
      parsed.player.id = profileId;
    }

    parsed.profile.lastSaved = Date.now();
    envelope.timestamp = Date.now();
    const saveKey = `${this.saveKeyPrefix}${profileId}`;
    this.storage.setItem(saveKey, JSON.stringify(envelope));

    const manifest = this.getManifest();
    manifest.profiles.unshift(parsed.profile);
    manifest.activeProfileId = profileId;
    this.saveManifest(manifest);

    return parsed.profile;
  }

  /**
   * Exports character save state as a portable VersionedSaveEnvelope.
   */
  public exportHeroEnvelope(profileId: string): VersionedSaveEnvelope<SaveData> {
    const raw = this.exportHero(profileId);
    const { envelope } = defaultMigrator.migrate(raw);
    return envelope as VersionedSaveEnvelope<SaveData>;
  }

  /**
   * Prompts browser download of discrete `.cotw` formatted save file.
   * Format: `${characterName}_Floor${currentFloor}_${manifestId}_${timestamp}.cotw`
   *
   * @param adapter - Mandatory {@link DownloadAdapter} for platform file download.
   */
  public triggerCotwDownload(profileId: string, adapter: DownloadAdapter): string {
    const profile = this.getProfile(profileId);
    const envelope = this.exportHeroEnvelope(profileId);
    const packageJson = createSavePackage(envelope);
    const heroName = profile?.name || envelope.data.profile.name || 'hero';
    const floor = envelope.data.currentFloor ?? profile?.floor ?? 0;
    const manifestId = envelope.contentManifestId || this.manifestId;
    const fileName = generateSaveFilename(heroName, floor, manifestId, envelope.timestamp);

    adapter.triggerFileDownload(fileName, packageJson, 'application/json');

    return fileName;
  }

  /**
   * Prompts browser download of `<hero_name>.sav` (or `.cotw`).
   */
  public triggerHeroDownload(profileId: string, adapter: DownloadAdapter): void {
    this.triggerCotwDownload(profileId, adapter);
  }
}
