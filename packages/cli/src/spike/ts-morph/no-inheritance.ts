import type { SourceFile } from 'ts-morph';

import { createFinding, type ChevronFinding } from '../finding.js';
import { locate } from './location.js';

/** CHV021 on ts-morph: no class `extends`, no `abstract`, no interface `extends`. */
export function checkNoInheritance(projectDir: string, sourceFile: SourceFile): ChevronFinding[] {
  const findings: ChevronFinding[] = [];
  for (const classDeclaration of sourceFile.getClasses()) {
    const name = classDeclaration.getName() ?? '<anonymous>';
    const anchor = classDeclaration.getNameNode() ?? classDeclaration;
    if (classDeclaration.isAbstract()) {
      findings.push(
        createFinding({
          ruleId: 'CHV021',
          ...locate(projectDir, anchor),
          message: `Class '${name}' is abstract`,
          fix: "Remove 'abstract'; move shared logic into pure functions in 'domain/' or an injected service",
          source: 'ts-morph',
        }),
      );
    }
    const superClass = classDeclaration.getExtends();
    if (superClass !== undefined) {
      findings.push(
        createFinding({
          ruleId: 'CHV021',
          ...locate(projectDir, superClass),
          message: `Class '${name}' extends '${superClass.getExpression().getText()}'`,
          fix: "Remove 'extends'; implement exactly one interface and inject collaborators via the constructor",
          source: 'ts-morph',
        }),
      );
    }
  }
  for (const interfaceDeclaration of sourceFile.getInterfaces()) {
    for (const heritage of interfaceDeclaration.getExtends()) {
      findings.push(
        createFinding({
          ruleId: 'CHV021',
          ...locate(projectDir, heritage),
          message: `Interface '${interfaceDeclaration.getName()}' extends '${heritage.getExpression().getText()}'`,
          fix: 'Declare all members directly in the contract; contracts do not inherit',
          source: 'ts-morph',
        }),
      );
    }
  }
  return findings;
}
