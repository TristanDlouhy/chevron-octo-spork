import path from 'node:path';

import type { TSESTree } from '@typescript-eslint/utils';

import { chevronMessage, createRule } from './create-rule.js';
import { classifyContractFile, partnerFileName, resolveModulePath } from './module-path.js';

/**
 * CHV020, content part: an `.impl.ts` file holds exactly one class that implements exactly the
 * interface of its contract file. The pair check (does the partner file exist?) lives in
 * `chevron check`, because ESLint rules must not read the file system (ADR 0002).
 */
export const oneContractOneImpl = createRule({
  name: 'chv020',
  meta: {
    type: 'problem',
    docs: {
      description: 'Exactly one interface and one implementation per service/use case (CHV020).',
    },
    schema: [],
    messages: { violation: chevronMessage('CHV020', 'one-contract-one-impl') },
  },
  defaultOptions: [],
  create(context) {
    const contractFile = classifyContractFile(context.filename);
    if (resolveModulePath(context.filename) === undefined || contractFile?.role !== 'impl') {
      return {};
    }
    const fileName = path.basename(context.filename);
    const partner = partnerFileName(contractFile);
    const partnerImportPath = `./${partner.replace(/\.ts$/, '.js')}`;
    const classes: TSESTree.ClassDeclaration[] = [];
    const importedFrom = new Map<string, string>();

    return {
      ImportSpecifier(node: TSESTree.ImportSpecifier): void {
        if (node.parent.type === 'ImportDeclaration') {
          importedFrom.set(node.local.name, node.parent.source.value);
        }
      },
      ClassDeclaration(node: TSESTree.ClassDeclaration): void {
        classes.push(node);
      },
      'Program:exit'(program: TSESTree.Program): void {
        if (classes.length !== 1) {
          context.report({
            node: classes[1] ?? program,
            messageId: 'violation',
            data: {
              finding: `'${fileName}' declares ${String(classes.length)} classes`,
              fix: 'Keep exactly one class that implements the interface from the contract file',
            },
          });
        }
        for (const classNode of classes) {
          const implemented = classNode.implements.map(
            (clause: TSESTree.TSClassImplements): string =>
              context.sourceCode.getText(clause.expression),
          );
          const fromPartner = implemented.filter(
            (name: string) => importedFrom.get(name) === partnerImportPath,
          );
          if (implemented.length !== 1 || fromPartner.length !== 1) {
            context.report({
              node: classNode.id ?? classNode,
              messageId: 'violation',
              data: {
                finding: `Class '${classNode.id?.name ?? '<anonymous>'}' implements [${implemented.join(', ')}]`,
                fix: `Implement exactly the one interface exported by '${partner}'`,
              },
            });
          }
        }
      },
    };
  },
});
