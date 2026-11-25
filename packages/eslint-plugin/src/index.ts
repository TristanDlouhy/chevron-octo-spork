import type { TSESLint } from '@typescript-eslint/utils';

import { createRecommendedConfig } from './configs/recommended.js';
import { chevronRules } from './rules/index.js';

export {
  findRuleByDelegate,
  ruleCatalog,
  ruleDocsUrl,
  RULES_DOCS_URL,
  type ChevronRuleId,
  type RuleCatalogEntry,
  type RuleCheck,
  type RuleStatus,
} from './rule-catalog.js';
export {
  classifyContractFile,
  isLayer,
  LAYERS,
  partnerFileName,
  resolveModulePath,
  type ContractFile,
  type ModulePath,
} from './rules/module-path.js';
export { toChevronFindings, type ChevronFinding } from './formatters/chevron-json.js';
export { createRecommendedConfig, type RecommendedConfigOptions } from './configs/recommended.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-chevron',
    version: '0.0.0',
  },
  // Registered, not yet enabled in `recommended` (status 'planned' in rule-catalog.ts).
  rules: chevronRules,
} satisfies TSESLint.FlatConfig.Plugin;

export const chevron = {
  plugin,
  configs: {
    recommended: createRecommendedConfig,
  },
};
