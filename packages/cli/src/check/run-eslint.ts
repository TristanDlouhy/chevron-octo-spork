import { readFileSync } from 'node:fs';

import { ESLint } from 'eslint';
import { chevron, toChevronFindings } from 'eslint-plugin-chevron';

import { checkInlineConfig } from './inline-config.js';
import type { ChevronFinding } from './finding.js';

/**
 * typescript-eslint's `RuleModule` type does not match ESLint 10's `Plugin` type (ESLint 10 removed
 * deprecated context methods that typescript-eslint 8 still declares). At runtime the plugin is a
 * valid ESLint plugin; this guard bridges the types without a type assertion (CHV003).
 */
function isEslintPlugin(value: unknown): value is ESLint.Plugin {
  return typeof value === 'object' && value !== null && 'rules' in value;
}

/**
 * Runs the per-file rules through ESLint's Node API with a configuration that Chevron owns
 * (ADR 0002). The project's own eslint.config.js, nested configs and inline directives have no
 * effect, and there are no `--rule` style overrides. The CHV090 scan still reports every directive.
 */
export async function runEslint(
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
