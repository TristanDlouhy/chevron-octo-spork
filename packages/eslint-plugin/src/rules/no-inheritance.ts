import type { TSESTree } from '@typescript-eslint/utils';

import { chevronMessage, createRule } from './create-rule.js';

const FIX_CLASS =
  "Remove 'extends'; implement exactly one interface and inject collaborators via the constructor";

/** CHV021: no class inheritance, no abstract classes, no interface hierarchies. */
export const noInheritance = createRule({
  name: 'chv021',
  meta: {
    type: 'problem',
    docs: { description: "No 'extends' on classes or contracts, no 'abstract' (CHV021)." },
    schema: [],
    messages: { violation: chevronMessage('CHV021', 'no-inheritance') },
  },
  defaultOptions: [],
  create(context) {
    function className(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): string {
      return node.id?.name ?? '<anonymous>';
    }

    function checkClass(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): void {
      if (node.abstract) {
        context.report({
          node: node.id ?? node,
          messageId: 'violation',
          data: {
            finding: `Class '${className(node)}' is abstract`,
            fix: "Remove 'abstract'; move shared logic into pure functions in 'domain/' or an injected service",
          },
        });
      }
      if (node.superClass !== null) {
        const superName =
          node.superClass.type === 'Identifier'
            ? node.superClass.name
            : context.sourceCode.getText(node.superClass);
        context.report({
          node: node.superClass,
          messageId: 'violation',
          data: { finding: `Class '${className(node)}' extends '${superName}'`, fix: FIX_CLASS },
        });
      }
    }

    return {
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
      TSInterfaceDeclaration(node: TSESTree.TSInterfaceDeclaration): void {
        for (const heritage of node.extends) {
          context.report({
            node: heritage,
            messageId: 'violation',
            data: {
              finding: `Interface '${node.id.name}' extends '${context.sourceCode.getText(heritage.expression)}'`,
              fix: 'Declare all members directly in the contract; contracts do not inherit',
            },
          });
        }
      },
    };
  },
});
