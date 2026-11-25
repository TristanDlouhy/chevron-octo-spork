import { readFileSync } from 'node:fs';

import { ESLint } from 'eslint';
import { chevron, toChevronFindings } from 'eslint-plugin-chevron';

import { checkInlineConfig } from './inline-config.js';
import type { ChevronFinding } from './finding.js';

/**
 * Hybrid engine: per-file rules run through ESLint's Node API with a configuration that Chevron
 * owns. The project's own eslint.config.js is ignored (`overrideConfigFile: true`), inline
 * directives are switched off, and `--rule` style overrides do not exist. Project-wide checks
 * (CHV010, CHV091) and the directive scan (CHV090) stay in the CLI.
 */
/**
 * typescript-eslint's `RuleModule` type does not match ESLint 10's `Plugin` type (ESLint 10 removed
 * deprecated context methods that typescript-eslint 8 still declares). At runtime the plugin is a
 * valid ESLint plugin; this guard bridges the types without a type assertion (CHV003).
 */
function isEslintPlugin(value: unknown): value is ESLint.Plugin {
  return typeof value === 'object' && value !== null && 'rules' in value;
}

export async function runEslintEngine(
  projectDir: string,
  patterns: readonly string[],
): Promise<ChevronFinding[]> {
  const plugin: unknown = chevron.plugin;
  if (!isEslintPlugin(plugin)) {
    throw new TypeError('eslint-plugin-chevron does not export a plugin object');
  }
  const eslint = new ESLint({
    cwd: projectDir,
    overrideConfigFile: true,
    allowInlineConfig: false,
    overrideConfig: [
      ...chevron.configs.recommended({ tsconfigRootDir: projectDir, files: [...patterns] }),
      {
        files: [...patterns],
        plugins: { chevron: plugin },
        rules: { 'chevron/chv020': 'error', 'chevron/chv021': 'error' },
      },
    ],
  });
  const results = await eslint.lintFiles([...patterns]);
  const directives = results.flatMap((result: ESLint.LintResult) =>
    checkInlineConfig(projectDir, result.filePath, readFileSync(result.filePath, 'utf8')),
  );
  return [...toChevronFindings(results, projectDir), ...directives];
}
