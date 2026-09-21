import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

/**
 * Engine encapsulation check (companion to check-engine-purity.ts).
 *
 * check-engine-purity verifies *import* boundaries. This verifies that code
 * outside src/engine/ which legitimately holds engine objects does not mutate
 * their internals directly, bypassing engine methods and the action pipeline.
 * It uses the TypeScript type checker, so a write is matched by the property's
 * declaring class, not by the variable name used to reach it.
 *
 * Rules (non-test files only):
 *  1. PROPERTY_WRITE   - assignment / compound assignment / ++ / -- / delete on a
 *                        class member declared under src/engine/.           [presentation + content]
 *  2. INDEXED_WRITE    - element write into such a member (player.quickSpells[i] = x). [presentation + content]
 *  3. ANY_CAST_WRITE   - property write through `(engineObject as any).prop`.    [presentation + content]
 *  4. OBJECT_ASSIGN    - Object.assign(engineObject, ...).                      [presentation + content]
 *  5. SUBSYSTEM_MUTATION - mutator-named method call on an internal engine subsystem
 *                        (GameMap, Container, InventoryManager, ...). Player/Entity/GameEngine
 *                        methods are the public API and are not flagged.        [presentation only]
 *  6. COLLECTION_MUTATION - Array/Map/Set mutator call on an engine class member
 *                        (player.spellsKnown.push(x)).                          [presentation only]
 *
 * Content (src/content/) is exempt from rules 5-6: content hooks receive the engine
 * through an injected context and are expected to act through subsystem methods.
 *
 * Presentation scope covers src/ui/, src/rendering/, src/main.ts, and any file under
 * src/main/ (ARCHITECTURE.md §7.2) — a composition root split into src/main/ helpers
 * does not become invisible to this check.
 *
 * Known limitation: writes through a local alias of a member's *value*
 * (`const qs = player.quickSpells; qs[0] = x`) are not traced.
 */

const ROOT = process.cwd();
const ENGINE_DIR = path.resolve(ROOT, 'src', 'engine') + path.sep;
const ALLOWLIST_PATH = path.resolve(ROOT, 'scripts', 'engine-encapsulation-allowlist.json');

const INTERNAL_SUBSYSTEM_CLASSES = new Set([
  'GameMap',
  'Container',
  'InventoryManager',
  'Paperdoll',
  'StatusManager',
  'EnergyScheduler',
  'SurfaceGrid',
  'SubstanceGrid',
  'PlaneManager',
  'FovManager',
  'FloorManager',
  'PactManager',
  'CompendiumManager',
  'GameStateManager',
  'ActionPipeline',
]);
const SUBSYSTEM_MUTATOR_NAME =
  /^(add|remove|set|clear|delete|equip|unequip|store|move|apply|place|take|drop|swap|split|merge|push|pop|splice|reset|register|unregister|fill|tick|record|reveal|consume|spend|deposit|withdraw|transfer|sort|compact)/i;
const COLLECTION_MUTATORS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
  'set', 'delete', 'clear', 'add',
]);

type Scope = 'presentation' | 'content';

interface Violation {
  file: string;
  line: number;
  rule: string;
  member: string;
  text: string;
}

interface AllowlistEntry {
  file: string;
  member: string;
  reason: string;
}

const toRel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

function scopeOf(fileName: string): Scope | null {
  const rel = toRel(fileName);
  if (/\/__(tests|fixtures)__\//.test(rel)) return null;
  if (rel.startsWith('src/ui/') || rel.startsWith('src/rendering/') || rel.startsWith('src/main/') || rel === 'src/main.ts') return 'presentation';
  if (rel.startsWith('src/content/')) return 'content';
  return null;
}

function isEngineSource(fileName: string): boolean {
  const resolved = path.resolve(fileName);
  return resolved.startsWith(ENGINE_DIR) && !/[\\/]__(tests|fixtures)__[\\/]/.test(resolved);
}

const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
  console.error('❌ tsconfig.json not found');
  process.exit(1);
}
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const checker = program.getTypeChecker();

function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  return e;
}

function unwrapCasts(expr: ts.Expression): ts.Expression {
  let e = unwrap(expr);
  while (ts.isAsExpression(e) || ts.isTypeAssertionExpression(e) || ts.isSatisfiesExpression(e)) {
    e = unwrap(e.expression);
  }
  return e;
}

function isClassLike(node: ts.Node): node is ts.ClassDeclaration | ts.ClassExpression {
  return ts.isClassDeclaration(node) || ts.isClassExpression(node);
}

/** Returns `ClassName.member` if the symbol is a class member declared in engine source. */
function engineClassMember(symbol: ts.Symbol | undefined, requireMethod = false): { className: string; member: string } | null {
  if (!symbol) return null;
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  for (const decl of resolved.declarations ?? []) {
    if (!isEngineSource(decl.getSourceFile().fileName)) continue;
    let owner: ts.Node | undefined;
    if (ts.isMethodDeclaration(decl)) {
      owner = decl.parent;
    } else if (!requireMethod && (ts.isPropertyDeclaration(decl) || ts.isGetAccessorDeclaration(decl) || ts.isSetAccessorDeclaration(decl))) {
      owner = decl.parent;
    } else if (!requireMethod && ts.isParameter(decl) && ts.isConstructorDeclaration(decl.parent)) {
      const isParamProperty = (ts.getModifiers(decl) ?? []).some((m) =>
        [ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(m.kind)
      );
      if (isParamProperty) owner = decl.parent.parent;
    }
    if (owner && isClassLike(owner)) {
      return { className: owner.name?.text ?? '<anonymous>', member: resolved.name };
    }
  }
  return null;
}

/** Returns the engine class name if the expression's static type is an engine class instance. */
function engineClassOfType(expr: ts.Expression): string | null {
  const type = checker.getTypeAtLocation(expr);
  const sym = type.getSymbol() ?? type.aliasSymbol;
  for (const decl of sym?.declarations ?? []) {
    if (isClassLike(decl) && isEngineSource(decl.getSourceFile().fileName)) {
      return decl.name?.text ?? '<anonymous>';
    }
  }
  return null;
}

const violations: Violation[] = [];

function report(sf: ts.SourceFile, node: ts.Node, rule: string, member: string): void {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  violations.push({
    file: toRel(sf.fileName),
    line: line + 1,
    rule,
    member,
    text: node.getText(sf).replace(/\s+/g, ' ').slice(0, 140),
  });
}

function checkWriteTarget(sf: ts.SourceFile, target: ts.Expression, statement: ts.Node): void {
  const t = unwrap(target);
  if (ts.isPropertyAccessExpression(t)) {
    const hit = engineClassMember(checker.getSymbolAtLocation(t.name));
    if (hit) {
      report(sf, statement, 'PROPERTY_WRITE', `${hit.className}.${hit.member}`);
      return;
    }
    const receiver = unwrap(t.expression);
    const uncast = unwrapCasts(receiver);
    if (uncast !== receiver) {
      const cls = engineClassOfType(uncast);
      if (cls) report(sf, statement, 'ANY_CAST_WRITE', `${cls}.${t.name.text}`);
    }
    return;
  }
  if (ts.isElementAccessExpression(t)) {
    const receiver = unwrap(t.expression);
    if (ts.isPropertyAccessExpression(receiver)) {
      const hit = engineClassMember(checker.getSymbolAtLocation(receiver.name));
      if (hit) report(sf, statement, 'INDEXED_WRITE', `${hit.className}.${hit.member}`);
    }
  }
}

function visit(sf: ts.SourceFile, scope: Scope, node: ts.Node): void {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    checkWriteTarget(sf, node.left, node);
  } else if (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    checkWriteTarget(sf, node.operand, node);
  } else if (ts.isDeleteExpression(node)) {
    checkWriteTarget(sf, node.expression, node);
  } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(unwrap(node.expression))) {
    const callee = unwrap(node.expression) as ts.PropertyAccessExpression;
    const methodName = callee.name.text;

    if (ts.isIdentifier(callee.expression) && callee.expression.text === 'Object' && methodName === 'assign' && node.arguments[0]) {
      const cls = engineClassOfType(unwrapCasts(node.arguments[0]));
      if (cls) report(sf, node, 'OBJECT_ASSIGN', `${cls}.*`);
    } else if (scope === 'presentation') {
      const method = engineClassMember(checker.getSymbolAtLocation(callee.name), true);
      if (method && INTERNAL_SUBSYSTEM_CLASSES.has(method.className) && SUBSYSTEM_MUTATOR_NAME.test(methodName)) {
        report(sf, node, 'SUBSYSTEM_MUTATION', `${method.className}.${method.member}`);
      } else if (COLLECTION_MUTATORS.has(methodName)) {
        const receiver = unwrap(callee.expression);
        if (ts.isPropertyAccessExpression(receiver)) {
          const hit = engineClassMember(checker.getSymbolAtLocation(receiver.name));
          if (hit) report(sf, node, 'COLLECTION_MUTATION', `${hit.className}.${hit.member}`);
        }
      }
    }
  }
  ts.forEachChild(node, (child) => visit(sf, scope, child));
}

let presentationFiles = 0;
let contentFiles = 0;
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  const scope = scopeOf(sf.fileName);
  if (!scope) continue;
  if (scope === 'presentation') presentationFiles++;
  else contentFiles++;
  visit(sf, scope, sf);
}

const allowlist: AllowlistEntry[] = fs.existsSync(ALLOWLIST_PATH)
  ? (JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf-8')).entries ?? [])
  : [];
const usedAllowlist = new Set<number>();
const unallowed = violations.filter((v) => {
  const idx = allowlist.findIndex((a) => a.file === v.file && a.member === v.member);
  if (idx >= 0) {
    usedAllowlist.add(idx);
    return false;
  }
  return true;
});
const staleAllowlist = allowlist.filter((_, i) => !usedAllowlist.has(i));

console.log(`\n======================================================`);
console.log(`ENGINE ENCAPSULATION VERIFICATION AUDIT`);
console.log(`Presentation files inspected (ui/rendering/main.ts/main/**): ${presentationFiles}`);
console.log(`Content files inspected: ${contentFiles}`);
console.log(`Allowlisted sanctioned writes: ${usedAllowlist.size}`);
console.log(`======================================================\n`);

if (unallowed.length > 0 || staleAllowlist.length > 0) {
  if (unallowed.length > 0) {
    console.error(`❌ Found ${unallowed.length} direct mutation(s) of engine internals outside src/engine/:\n`);
    for (const v of unallowed) {
      console.error(`  [${v.rule}] ${v.file}:${v.line}  (${v.member})`);
      console.error(`    ${v.text}\n`);
    }
  }
  if (staleAllowlist.length > 0) {
    console.error(`❌ ${staleAllowlist.length} stale allowlist entr${staleAllowlist.length === 1 ? 'y' : 'ies'} (no longer matched; remove them):\n`);
    for (const a of staleAllowlist) console.error(`  ${a.file}  (${a.member})`);
    console.error('');
  }
  process.exit(1);
}

console.log(`✓ Engine Encapsulation: 0 unsanctioned mutations of engine internals outside src/engine/.`);
process.exit(0);
