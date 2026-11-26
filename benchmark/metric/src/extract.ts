import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import type {
  DepthHistogram,
  FileGraph,
  FileLabel,
  Stats,
  StructureModel,
  TreeNode,
} from './model.ts';

const IMPLICIT_ANY_CODES = new Set([7005, 7006, 7008, 7010, 7011, 7018, 7019, 7031, 7034]);

/** Production source files: every .ts/.tsx/.mts/.cts under src/, without tests and declarations. */
export function sourceFiles(srcDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || name === '__tests__' || name === '__mocks__') {
          continue;
        }
        walk(full);
      } else if (isProductionFile(name)) {
        out.push(full);
      }
    }
  };
  walk(srcDir);
  return out;
}

function isProductionFile(name: string): boolean {
  if (!/\.(ts|tsx|mts|cts)$/.test(name) || /\.d\.(ts|mts|cts)$/.test(name)) {
    return false;
  }
  return !/\.(test|spec)\.[cm]?tsx?$/.test(name);
}

/** Directory tree with only dir/file kinds; children ordered canonically, independent of names. */
export function buildTree(srcDir: string, files: readonly string[]): TreeNode {
  type Raw = { dirs: Map<string, Raw>; files: number };
  const root: Raw = { dirs: new Map(), files: 0 };
  for (const file of files) {
    const parts = relative(srcDir, file).split(sep);
    let node = root;
    for (const part of parts.slice(0, -1)) {
      let next = node.dirs.get(part);
      if (!next) {
        next = { dirs: new Map(), files: 0 };
        node.dirs.set(part, next);
      }
      node = next;
    }
    node.files += 1;
  }
  const convert = (raw: Raw): TreeNode => {
    const children: TreeNode[] = [...raw.dirs.values()].map(convert);
    for (let i = 0; i < raw.files; i += 1) {
      children.push({ kind: 'file', children: [] });
    }
    children.sort(compareTrees);
    return { kind: 'dir', children };
  };
  return convert(root);
}

function signature(node: TreeNode): string {
  return `${node.kind === 'dir' ? 'd' : 'f'}(${node.children.map(signature).join(',')})`;
}

function size(node: TreeNode): number {
  return 1 + node.children.reduce((acc, c) => acc + size(c), 0);
}

function compareTrees(a: TreeNode, b: TreeNode): number {
  const bySize = size(b) - size(a);
  if (bySize !== 0) {
    return bySize;
  }
  const sa = signature(a);
  const sb = signature(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function maxDepth(node: TreeNode): number {
  const dirs = node.children.filter((c) => c.kind === 'dir');
  return dirs.length === 0 ? 0 : 1 + Math.max(...dirs.map(maxDepth));
}

function isProjectDeclaration(decl: ts.Declaration, projectFiles: ReadonlySet<string>): boolean {
  return projectFiles.has(resolve(decl.getSourceFile().fileName));
}

/**
 * Abstraction depth of a type declared in the project: an interface or class counts 1 plus the
 * deepest project supertype it extends or implements. Types outside the project count 0.
 */
function typeDepth(
  decl: ts.Declaration,
  checker: ts.TypeChecker,
  projectFiles: ReadonlySet<string>,
  seen: Set<ts.Declaration>,
): number {
  if (!isProjectDeclaration(decl, projectFiles) || seen.has(decl)) {
    return 0;
  }
  seen.add(decl);
  if (ts.isInterfaceDeclaration(decl) || ts.isClassDeclaration(decl)) {
    return 1 + supertypeDepth(decl, checker, projectFiles, seen);
  }
  if (ts.isTypeAliasDeclaration(decl)) {
    return 1;
  }
  return 0;
}

function supertypeDepth(
  decl: ts.InterfaceDeclaration | ts.ClassDeclaration,
  checker: ts.TypeChecker,
  projectFiles: ReadonlySet<string>,
  seen: Set<ts.Declaration>,
): number {
  let best = 0;
  for (const clause of decl.heritageClauses ?? []) {
    for (const expr of clause.types) {
      for (const target of declarationsOf(expr.expression, checker)) {
        best = Math.max(best, typeDepth(target, checker, projectFiles, new Set(seen)));
      }
    }
  }
  return best;
}

function declarationsOf(node: ts.Node, checker: ts.TypeChecker): ts.Declaration[] {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    symbol = checker.getAliasedSymbol(symbol);
  }
  return symbol?.declarations ?? [];
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some((m) => m.kind === kind) ??
    false
  );
}

function functionLike(node: ts.Node): ts.SignatureDeclaration | undefined {
  if (ts.isFunctionDeclaration(node) && node.body) {
    return node;
  }
  if (ts.isVariableStatement(node)) {
    for (const d of node.declarationList.declarations) {
      if (
        d.initializer &&
        (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
      ) {
        return d.initializer;
      }
    }
  }
  return undefined;
}

function fileLabel(sf: ts.SourceFile, isEntry: boolean): FileLabel {
  if (isEntry) {
    return 'entry';
  }
  let classes = false;
  let functions = false;
  let interfaces = false;
  for (const stmt of sf.statements) {
    if (ts.isClassDeclaration(stmt)) {
      classes = true;
    } else if (functionLike(stmt)) {
      functions = true;
    } else if (ts.isInterfaceDeclaration(stmt)) {
      interfaces = true;
    }
  }
  if (classes && functions) {
    return 'mixed';
  }
  if (classes) {
    return 'class';
  }
  if (functions) {
    return 'functions';
  }
  return interfaces ? 'interface' : 'types';
}

function countImportCycles(n: number, edges: ReadonlyArray<[number, number]>): number {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    adj[a]?.push(b);
  }
  let index = 0;
  const idx = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const onStack = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  let cycles = 0;
  const strong = (v: number): void => {
    idx[v] = index;
    low[v] = index;
    index += 1;
    stack.push(v);
    onStack[v] = true;
    for (const w of adj[v] ?? []) {
      if (idx[w] === -1) {
        strong(w);
        low[v] = Math.min(low[v] ?? 0, low[w] ?? 0);
      } else if (onStack[w]) {
        low[v] = Math.min(low[v] ?? 0, idx[w] ?? 0);
      }
    }
    if (low[v] === idx[v]) {
      let members = 0;
      let w: number | undefined;
      do {
        w = stack.pop();
        if (w !== undefined) {
          onStack[w] = false;
          members += 1;
        }
      } while (w !== undefined && w !== v);
      const selfLoop = edges.some(([a, b]) => a === v && b === v);
      if (members > 1 || selfLoop) {
        cycles += 1;
      }
    }
  };
  for (let v = 0; v < n; v += 1) {
    if (idx[v] === -1) {
      strong(v);
    }
  }
  return cycles;
}

function packageName(specifier: string): string {
  if (specifier.startsWith('node:')) {
    return specifier;
  }
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

function bump(depths: DepthHistogram, depth: number): void {
  const i = Math.min(depth, 3) as 0 | 1 | 2 | 3;
  depths[i] += 1;
}

const BENCHMARK_DIR = resolve(import.meta.dirname, '../..');

/** Extract the name-free structural model of the solution in `solutionDir` (production code in src/). */
export function extract(solutionDir: string): StructureModel {
  const srcDir = resolve(solutionDir, 'src');
  const files = sourceFiles(srcDir).map((f) => resolve(f));
  const projectFiles = new Set(files);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    allowJs: false,
    // Node types and the hardware simulator resolve from the solution first, then from the benchmark.
    types: ['node'],
    typeRoots: [
      join(solutionDir, 'node_modules/@types'),
      join(BENCHMARK_DIR, 'node_modules/@types'),
    ],
    baseUrl: solutionDir,
    paths: {
      'hardware-sim': [join(BENCHMARK_DIR, 'task/scaffold/vendor/hardware-sim/index.d.ts')],
    },
  };
  const program = ts.createProgram(files, options);
  const checker = program.getTypeChecker();

  const tree = buildTree(srcDir, files);
  const indexOf = new Map(files.map((f, i) => [f, i]));
  const labels: FileLabel[] = [];
  const edges: Array<[number, number]> = [];
  const depths: DepthHistogram = [0, 0, 0, 0];
  const external = new Set<string>();
  let interfaces = 0;
  let classes = 0;
  let explicitAny = 0;
  let tryCatch = 0;

  const entry = resolve(srcDir, 'main.ts');
  files.forEach((file, i) => {
    const sf = program.getSourceFile(file);
    if (!sf) {
      labels.push('types');
      return;
    }
    labels.push(fileLabel(sf, file === entry));

    const targets = new Set<number>();
    const addImport = (specifier: string): void => {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
        external.add(packageName(specifier));
        return;
      }
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      const target = resolved ? indexOf.get(resolve(resolved.resolvedFileName)) : undefined;
      if (target !== undefined) {
        targets.add(target);
      }
    };

    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          addImport(node.moduleSpecifier.text);
        }
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        addImport(node.arguments[0].text);
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        addImport(node.argument.literal.text);
      }
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        explicitAny += 1;
      }
      if (ts.isTryStatement(node) && node.catchClause) {
        tryCatch += 1;
      }
      if (ts.isInterfaceDeclaration(node)) {
        interfaces += 1;
      }
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        classes += 1;
        const hasMethod = node.members.some((m) => ts.isMethodDeclaration(m) && m.body);
        if (
          ts.isClassDeclaration(node) &&
          hasMethod &&
          !hasModifier(node, ts.SyntaxKind.AbstractKeyword)
        ) {
          const depth = supertypeDepth(node, checker, projectFiles, new Set());
          bump(depths, depth);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    // Factory functions: exported functions whose declared return type is a project type.
    for (const stmt of sf.statements) {
      const fn = functionLike(stmt);
      if (
        !fn ||
        !hasModifier(stmt, ts.SyntaxKind.ExportKeyword) ||
        !fn.type ||
        !ts.isTypeReferenceNode(fn.type)
      ) {
        continue;
      }
      const decls = declarationsOf(fn.type.typeName, checker).filter((d) =>
        isProjectDeclaration(d, projectFiles),
      );
      if (decls.length > 0) {
        const depth = Math.max(...decls.map((d) => typeDepth(d, checker, projectFiles, new Set())));
        bump(depths, depth);
      }
    }

    for (const t of targets) {
      edges.push([i, t]);
    }
  });

  const implicitAny = program
    .getSemanticDiagnostics()
    .filter(
      (d) => IMPLICIT_ANY_CODES.has(d.code) && d.file && projectFiles.has(resolve(d.file.fileName)),
    ).length;

  const fanOut = new Array<number>(files.length).fill(0);
  for (const [a] of edges) {
    fanOut[a] = (fanOut[a] ?? 0) + 1;
  }

  const graph: FileGraph = { labels, edges };
  const stats: Stats = {
    files: files.length,
    maxDirDepth: maxDepth(tree),
    interfaces,
    classes,
    explicitAny,
    implicitAny,
    importCycles: countImportCycles(files.length, edges),
    tryCatch,
    maxFanOut: fanOut.length === 0 ? 0 : Math.max(...fanOut),
    externalPackages: [...external].sort(),
  };
  return { tree, depths, graph, stats };
}
