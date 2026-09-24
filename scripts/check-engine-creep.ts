import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { GameContentManifest } from '../src/engine';

/**
 * Engine-creep check (ARCHITECTURE.md §3 No Engine Creep, §7.2).
 *
 * The import checks prove the engine never *imports* a content pack; they can't see a
 * pack's identifiers pasted into engine code as string literals, which is how
 * campaign logic creeps into src/engine/ without breaking any import rule. This loads
 * every pack under src/content/, collects the identifiers the pack *declares*
 * (monsters, items, spells, pacts, companions, vaults, choices, NPCs, quest
 * references, and the story flags its choices and events set), and fails on any of
 * them appearing as a quoted literal in engine production source.
 *
 * Shared vocabulary a manifest merely restates from engine enums (equipment slots,
 * elements, status types) is not collected. Declared identifiers the engine
 * legitimately names are listed with a reason in scripts/engine-creep-allowlist.json;
 * a stale entry fails the check.
 */

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const ENGINE_DIR = path.join(ROOT, 'src', 'engine');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'engine-creep-allowlist.json');
const FLAG_KEY = /flag$/i;

interface AllowlistEntry {
  id: string;
  reason: string;
}

async function loadManifests(): Promise<GameContentManifest[]> {
  const manifests: GameContentManifest[] = [];
  for (const pack of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    const entry = path.join(CONTENT_DIR, pack.name, 'index.ts');
    if (!pack.isDirectory() || !fs.existsSync(entry)) continue;
    const mod: Record<string, unknown> = await import(pathToFileURL(entry).href);
    for (const value of Object.values(mod)) {
      const m = value as Partial<GameContentManifest> | null;
      const isManifest = !!m && typeof m === 'object' && typeof m.id === 'string' && Array.isArray(m.monsters);
      // A pack may export its manifest under more than one name.
      if (isManifest && !manifests.some((x) => x.id === m.id)) manifests.push(m as GameContentManifest);
    }
  }
  return manifests;
}

/** Collects every string under a key ending in "flag" (setFlag, startFlag, resolvedFlag, …). */
function collectFlags(value: unknown, into: Map<string, string>, pack: string, key = ''): void {
  if (typeof value === 'string') {
    if (FLAG_KEY.test(key)) into.set(value, pack);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) collectFlags(v, into, pack, Array.isArray(value) ? key : k);
}

function declaredIdentifiers(manifests: GameContentManifest[]): Map<string, string> {
  const ids = new Map<string, string>();
  for (const m of manifests) {
    const add = (id: unknown) => {
      if (typeof id === 'string' && id.length > 0) ids.set(id, m.id);
    };
    const addAll = (list: unknown) => {
      const entries = Array.isArray(list) ? list : Object.values(list ?? {});
      for (const e of entries) add((e as { id?: unknown })?.id);
    };
    addAll(m.monsters);
    addAll(m.items);
    addAll(m.spells);
    addAll(m.pacts);
    addAll(m.companions);
    addAll(m.vaults);
    addAll(m.timedEvents);
    addAll(m.storyChoiceTriggers);
    addAll(m.attributeMilestones);
    addAll(m.renownMilestones);
    const BUILTIN_STATUS_TYPES = new Set(['poison', 'paralysis', 'slow', 'haste', 'blindness', 'stunned', 'sensory_masked']);
    for (const eff of m.statusEffects ?? []) {
      if (eff?.id && !BUILTIN_STATUS_TYPES.has(eff.id)) add(eff.id);
    }
    for (const choiceId of Object.keys(m.choices ?? {})) add(choiceId);
    for (const npc of m.town?.npcs ?? []) {
      add(npc.id);
      add(npc.name);
    }
    add(m.quest?.id);
    add(m.quest?.bossMonsterId);
    add(m.quest?.relicItemId);
    add(m.quest?.victoryNpcId);
    for (const v of m.scriptedVaultPlacements ?? []) add(v.vaultId);
    collectFlags({ choices: m.choices, timedEvents: m.timedEvents, storyChoiceTriggers: m.storyChoiceTriggers, bossFleeResolutions: m.bossFleeResolutions, quest: m.quest }, ids, m.id);
  }
  return ids;
}

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return /^__(tests|fixtures)__$/.test(e.name) ? [] : sourceFiles(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

const manifests = await loadManifests();
const ids = declaredIdentifiers(manifests);
const packNamespaces = manifests.map((m) => `${m.id}:`);
const allowlist: AllowlistEntry[] = fs.existsSync(ALLOWLIST_PATH)
  ? (JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf-8')).entries ?? [])
  : [];
const allowed = new Set(allowlist.map((a) => a.id));
const usedAllowlist = new Set<string>();
const engineViolations: { file: string; line: number; id: string; pack: string; text: string }[] = [];
const presentationViolations: { file: string; line: number; id: string; pack: string; text: string }[] = [];

const engineFiles = sourceFiles(ENGINE_DIR);
for (const file of engineFiles) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  fs.readFileSync(file, 'utf-8')
    .split('\n')
    .forEach((text, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(text)) return; // prose may name a pack identifier
      for (const match of text.matchAll(/(['"`])((?:(?!\1)[^\\$])+)\1/g)) {
        const id = match[2];
        const pack = ids.get(id);
        if (!pack) continue;
        if (allowed.has(id)) {
          usedAllowlist.add(id);
          continue;
        }
        engineViolations.push({ file: rel, line: i + 1, id, pack, text: text.trim() });
      }
    });
}

const PRESENTATION_DIRS = [
  path.join(ROOT, 'src', 'ui'),
  path.join(ROOT, 'src', 'rendering'),
  path.join(ROOT, 'src', 'main'),
];
const presentationFiles = PRESENTATION_DIRS.flatMap(sourceFiles);
for (const file of presentationFiles) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  fs.readFileSync(file, 'utf-8')
    .split('\n')
    .forEach((text, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(text)) return; // prose may name a pack identifier
      for (const match of text.matchAll(/(['"`])((?:(?!\1)[^\\$])+)\1/g)) {
        const id = match[2];
        let pack = ids.get(id);
        if (!pack) {
          const ns = packNamespaces.find((prefix) => id.startsWith(prefix));
          if (ns) pack = ns.slice(0, -1);
        }
        if (!pack) continue;
        if (allowed.has(id)) {
          usedAllowlist.add(id);
          continue;
        }
        presentationViolations.push({ file: rel, line: i + 1, id, pack, text: text.trim() });
      }
    });
}

const stale = allowlist.filter((a) => !usedAllowlist.has(a.id) || !ids.has(a.id));

console.log(`\n======================================================`);
console.log(`ENGINE CREEP & PACK-NEUTRAL PRESENTATION AUDIT`);
console.log(`Content packs loaded: ${manifests.map((m) => m.id).join(', ')}`);
console.log(`Pack-declared identifiers: ${ids.size}`);
console.log(`Engine source files inspected: ${engineFiles.length}`);
console.log(`Presentation source files inspected: ${presentationFiles.length}`);
console.log(`Allowlisted references: ${usedAllowlist.size}`);
console.log(`======================================================\n`);

const hasViolations = engineViolations.length > 0 || presentationViolations.length > 0;
if (hasViolations || stale.length > 0) {
  if (engineViolations.length > 0) {
    console.error(`❌ Found ${engineViolations.length} content-pack identifier(s) in engine source (No Engine Creep, ARCHITECTURE.md §3):\n`);
    for (const v of engineViolations) {
      console.error(`  ${v.file}:${v.line}  '${v.id}' (declared by ${v.pack})`);
      console.error(`    ${v.text}\n`);
    }
    console.error('  Move the logic into the pack behind a generic engine capability, or allowlist it with a reason.\n');
  }
  if (presentationViolations.length > 0) {
    console.error(`❌ Found ${presentationViolations.length} content-pack identifier(s) in presentation source (Pack-Neutral Presentation, ARCHITECTURE.md §3):\n`);
    for (const v of presentationViolations) {
      console.error(`  ${v.file}:${v.line}  '${v.id}' (declared by ${v.pack})`);
      console.error(`    ${v.text}\n`);
    }
    console.error('  Move pack wording/styling into manifest fields, or allowlist it with a reason.\n');
  }
  if (stale.length > 0) {
    console.error(`❌ ${stale.length} stale allowlist entr${stale.length === 1 ? 'y' : 'ies'} (no longer matched; remove them):\n`);
    for (const a of stale) console.error(`  ${a.id}`);
    console.error('');
  }
  process.exit(1);
}

console.log(`✓ No Engine Creep: 0 content-pack identifiers in engine source.`);
console.log(`✓ Pack-Neutral Presentation: 0 content-pack identifiers or namespaced literals in presentation source.`);
process.exit(0);
