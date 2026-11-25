import { existsSync } from 'node:fs';
import path from 'node:path';

import { classifyContractFile, partnerFileName, resolveModulePath } from 'eslint-plugin-chevron';
import type { ExpressionWithTypeArguments, Node, SourceFile } from 'ts-morph';

import { createFinding, type ChevronFinding } from '../finding.js';
import { locate } from './location.js';

/**
 * CHV020 on ts-morph. Resolves `implements` through the type checker, so aliased or re-exported
 * imports are recognised; the ESLint spike rule only compares import paths.
 */
export function checkOneContractOneImpl(
  projectDir: string,
  sourceFile: SourceFile,
): ChevronFinding[] {
  const filePath = sourceFile.getFilePath();
  const contractFile = classifyContractFile(filePath);
  if (contractFile === undefined || resolveModulePath(filePath) === undefined) {
    return [];
  }
  const findings: ChevronFinding[] = [];
  const fileName = path.basename(filePath);
  const partner = partnerFileName(contractFile);
  const partnerPath = path.join(path.dirname(filePath), partner);
  const report = (node: Node, message: string, fix: string): void => {
    findings.push(
      createFinding({
        ruleId: 'CHV020',
        ...locate(projectDir, node),
        message,
        fix,
        source: 'ts-morph',
      }),
    );
  };

  if (!existsSync(partnerPath)) {
    report(
      sourceFile,
      contractFile.role === 'contract'
        ? `'${fileName}' has no implementation file`
        : `'${fileName}' has no contract file`,
      `Create '${partner}' next to it`,
    );
  }
  if (contractFile.role === 'contract') {
    return findings;
  }
  const classes = sourceFile.getClasses();
  if (classes.length !== 1) {
    report(
      classes[1]?.getNameNode() ?? classes[1] ?? sourceFile,
      `'${fileName}' declares ${String(classes.length)} classes`,
      'Keep exactly one class that implements the interface from the contract file',
    );
  }
  for (const classDeclaration of classes) {
    const implemented = classDeclaration.getImplements();
    const fromPartner = implemented.filter((clause: ExpressionWithTypeArguments) =>
      clause
        .getType()
        .getSymbol()
        ?.getDeclarations()
        .some((declaration: Node) => declaration.getSourceFile().getFilePath() === partnerPath),
    );
    if (implemented.length !== 1 || fromPartner.length !== 1) {
      const names = implemented
        .map((clause: ExpressionWithTypeArguments) => clause.getText())
        .join(', ');
      report(
        classDeclaration.getNameNode() ?? classDeclaration,
        `Class '${classDeclaration.getName() ?? '<anonymous>'}' implements [${names}]`,
        `Implement exactly the one interface exported by '${partner}'`,
      );
    }
  }
  return findings;
}
