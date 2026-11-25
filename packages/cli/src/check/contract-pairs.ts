import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { classifyContractFile, partnerFileName } from 'eslint-plugin-chevron';

import { createFinding, type ChevronFinding } from './finding.js';

/**
 * CHV020, pair part: every `<x>.service.ts` / `<x>.use-case.ts` has its `.impl.ts` partner in the
 * same directory and vice versa. Runs on the file system, so it also sees files in nested or
 * unknown directories (which CHV010 reports separately).
 */
export function checkContractPairs(projectDir: string, modulesDir: string): ChevronFinding[] {
  const findings: ChevronFinding[] = [];
  for (const filePath of walk(path.join(projectDir, modulesDir))) {
    const contractFile = classifyContractFile(filePath);
    if (contractFile === undefined) {
      continue;
    }
    const partner = partnerFileName(contractFile);
    if (safeIsFile(path.join(path.dirname(filePath), partner))) {
      continue;
    }
    const fileName = path.basename(filePath);
    findings.push(
      createFinding({
        ruleId: 'CHV020',
        file: path.relative(projectDir, filePath),
        line: 1,
        column: 1,
        message:
          contractFile.role === 'contract'
            ? `'${fileName}' has no implementation file`
            : `'${fileName}' has no contract file`,
        fix: `Create '${partner}' next to it`,
        source: 'chevron-cli',
      }),
    );
  }
  return findings;
}

function walk(directory: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(directory).sort();
  } catch {
    return [];
  }
  return entries.flatMap((entry: string) => {
    const entryPath = path.join(directory, entry);
    return statSync(entryPath).isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function safeIsFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}
