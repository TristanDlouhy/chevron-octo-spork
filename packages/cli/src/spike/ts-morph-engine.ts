import path from 'node:path';

import { Project, type SourceFile } from 'ts-morph';

import type { ChevronFinding } from './finding.js';
import { checkInlineConfig } from './inline-config.js';
import { checkNoAny } from './ts-morph/no-any.js';
import { checkNoInheritance } from './ts-morph/no-inheritance.js';
import { checkOneContractOneImpl } from './ts-morph/one-contract-one-impl.js';

/** Own engine: one ts-morph Project over the project's tsconfig, all per-file rules on its AST. */
export function runTsMorphEngine(projectDir: string): ChevronFinding[] {
  const project = new Project({ tsConfigFilePath: path.join(projectDir, 'tsconfig.json') });
  return project
    .getSourceFiles()
    .filter(
      (sourceFile: SourceFile) =>
        !sourceFile.isDeclarationFile() && !sourceFile.isFromExternalLibrary(),
    )
    .flatMap((sourceFile: SourceFile) => [
      ...checkNoAny(projectDir, sourceFile),
      ...checkNoInheritance(projectDir, sourceFile),
      ...checkOneContractOneImpl(projectDir, sourceFile),
      ...checkInlineConfig(projectDir, sourceFile.getFilePath(), sourceFile.getFullText()),
    ]);
}
