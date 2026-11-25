import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { isLayer } from 'eslint-plugin-chevron';

import { createFinding, type ChevronFinding } from './finding.js';

const FIX_DIRECTORY = "Move pure functions to 'domain/', I/O to 'adapters/'";

/**
 * CHV010 as a file-system walk. Unlike the ESLint rule it sees modules without any TypeScript file,
 * non-TS files and empty foreign directories, and it reports each finding on the offending path.
 */
export function checkModuleLayout(projectDir: string, modulesDir: string): ChevronFinding[] {
  const modulesRoot = path.join(projectDir, modulesDir);
  const findings: ChevronFinding[] = [];
  const report = (absolutePath: string, message: string, fix: string): void => {
    findings.push(
      createFinding({
        ruleId: 'CHV010',
        file: path.relative(projectDir, absolutePath),
        line: 1,
        column: 1,
        message,
        fix,
        source: 'chevron-cli',
      }),
    );
  };

  for (const moduleName of safeReaddir(modulesRoot)) {
    const moduleRoot = path.join(modulesRoot, moduleName);
    if (!statSync(moduleRoot).isDirectory()) {
      continue;
    }
    const rootFile = new RegExp(`^(index|${moduleName}\\.module)(\\.test)?\\.ts$`);
    const entries = safeReaddir(moduleRoot);
    for (const required of ['index.ts', `${moduleName}.module.ts`]) {
      if (!entries.includes(required)) {
        report(
          moduleRoot,
          `Module '${moduleName}' has no '${required}'`,
          `Create '${required}' in the module root`,
        );
      }
    }
    for (const entry of entries) {
      const entryPath = path.join(moduleRoot, entry);
      if (!statSync(entryPath).isDirectory()) {
        if (!rootFile.test(entry)) {
          report(
            entryPath,
            `Unexpected file '${entry}' in root of module '${moduleName}'`,
            `Keep only 'index.ts' and '${moduleName}.module.ts' in the module root`,
          );
        }
        continue;
      }
      if (!isLayer(entry)) {
        report(
          entryPath,
          `Unexpected directory '${entry}' in module '${moduleName}'`,
          FIX_DIRECTORY,
        );
        continue;
      }
      for (const child of safeReaddir(entryPath)) {
        const childPath = path.join(entryPath, child);
        if (statSync(childPath).isDirectory()) {
          report(
            childPath,
            `Nested directory '${entry}/${child}' in module '${moduleName}'`,
            `Move the file directly into '${entry}/'; split the module if the layer grows too large`,
          );
        } else if (!child.endsWith('.ts')) {
          report(
            childPath,
            `Unexpected file '${entry}/${child}' in module '${moduleName}'`,
            `Only TypeScript files belong in '${entry}/'`,
          );
        }
      }
    }
  }
  return findings;
}

function safeReaddir(directory: string): string[] {
  try {
    return readdirSync(directory).sort();
  } catch {
    return [];
  }
}
