import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { chevronMessage, createRule } from './create-rule.js';
import { isLayer, LAYERS, resolveModulePath, type ModulePath } from './module-path.js';

const FIX_DIRECTORY = "Move pure functions to 'domain/', I/O to 'adapters/'";

function rootFilePattern(moduleName: string): RegExp {
  return new RegExp(`^(index|${moduleName}\\.module)(\\.test)?\\.ts$`);
}

type Finding = { readonly finding: string; readonly fix: string };

/** Checks the position of the linted file itself. */
function checkOwnPath(modulePath: ModulePath): Finding | undefined {
  const [first, second, third] = modulePath.segments;
  if (first === undefined) {
    return undefined;
  }
  if (second === undefined) {
    return rootFilePattern(modulePath.moduleName).test(first)
      ? undefined
      : {
          finding: `Unexpected file '${first}' in root of module '${modulePath.moduleName}'`,
          fix: `Keep only 'index.ts' and '${modulePath.moduleName}.module.ts' in the module root`,
        };
  }
  if (!isLayer(first)) {
    return {
      finding: `Unexpected directory '${first}' in module '${modulePath.moduleName}'`,
      fix: FIX_DIRECTORY,
    };
  }
  if (third !== undefined) {
    return {
      finding: `Nested directory '${first}/${second}' in module '${modulePath.moduleName}'`,
      fix: `Move the file directly into '${first}/'; split the module if the layer grows too large`,
    };
  }
  return undefined;
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((entry: string) => entry.endsWith('.ts'))
    .sort();
}

function containsTypeScript(directory: string): boolean {
  return listTypeScriptFiles(directory).length > 0;
}

/**
 * Module-wide findings that no single TypeScript file "owns": missing root files, non-TS files,
 * directories without TS files. ESLint has no per-directory hook, so the spike reports them on the
 * alphabetically first TS file of the module. If a module has no TS file at all, nothing is reported.
 */
function checkModuleRoot(modulePath: ModulePath): Finding[] {
  const findings: Finding[] = [];
  const name = modulePath.moduleName;
  for (const required of ['index.ts', `${name}.module.ts`]) {
    if (!listTypeScriptFiles(modulePath.moduleRoot).includes(required)) {
      findings.push({
        finding: `Module '${name}' has no '${required}'`,
        fix: `Create '${required}' in the module root`,
      });
    }
  }
  for (const entry of readdirSync(modulePath.moduleRoot)) {
    const entryPath = path.join(modulePath.moduleRoot, entry);
    const isDirectory = statSync(entryPath).isDirectory();
    // Empty layer directories are allowed ("leere Schichtordner dürfen fehlen"); git drops them anyway.
    if (isDirectory && !isLayer(entry) && !containsTypeScript(entryPath)) {
      findings.push({
        finding: `Unexpected directory '${entry}' in module '${name}'`,
        fix: FIX_DIRECTORY,
      });
    }
    if (!isDirectory && !entry.endsWith('.ts')) {
      findings.push({
        finding: `Unexpected file '${entry}' in root of module '${name}'`,
        fix: `Keep only 'index.ts' and '${name}.module.ts' in the module root`,
      });
    }
  }
  for (const layer of LAYERS) {
    const layerPath = path.join(modulePath.moduleRoot, layer);
    let entries: string[] = [];
    try {
      entries = readdirSync(layerPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(layerPath, entry);
      if (statSync(entryPath).isFile() && !entry.endsWith('.ts')) {
        findings.push({
          finding: `Unexpected file '${layer}/${entry}' in module '${name}'`,
          fix: `Only TypeScript files belong in '${layer}/'`,
        });
      }
    }
  }
  return findings;
}

/**
 * CHV010: fixed directory and file layout per module.
 *
 * Spike note: reads the file system. Results depend on files that ESLint does not lint, so
 * `--cache` can serve stale results, and editors only refresh after the first file is re-linted.
 */
export const moduleLayout = createRule({
  name: 'chv010',
  meta: {
    type: 'problem',
    docs: { description: 'Fixed directory and file layout per module (CHV010).' },
    schema: [],
    messages: { violation: chevronMessage('CHV010', 'module-layout') },
  },
  defaultOptions: [],
  create(context) {
    const modulePath = resolveModulePath(context.filename);
    if (modulePath === undefined) {
      return {};
    }
    return {
      Program(program): void {
        const own = checkOwnPath(modulePath);
        if (own !== undefined) {
          context.report({
            node: program,
            loc: { line: 1, column: 0 },
            messageId: 'violation',
            data: own,
          });
        }
        const firstFile = listTypeScriptFiles(modulePath.moduleRoot)[0];
        if (
          firstFile === undefined ||
          path.join(modulePath.moduleRoot, firstFile) !== path.resolve(context.filename)
        ) {
          return;
        }
        for (const finding of checkModuleRoot(modulePath)) {
          context.report({
            node: program,
            loc: { line: 1, column: 0 },
            messageId: 'violation',
            data: finding,
          });
        }
      },
    };
  },
});
