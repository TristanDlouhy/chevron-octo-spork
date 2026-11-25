import path from 'node:path';

/** Layer directories allowed directly below a module root (RULES.md, CHV010). */
export const LAYERS = ['domain', 'ports', 'services', 'use-cases', 'adapters'] as const;

export type Layer = (typeof LAYERS)[number];

export type ModulePath = {
  /** Module directory name, e.g. 'gate-registry'. */
  readonly moduleName: string;
  /** Absolute path of the module root directory. */
  readonly moduleRoot: string;
  /** Path segments below the module root, e.g. ['services', 'gate-lookup.service.ts']. */
  readonly segments: readonly string[];
};

/**
 * Locates a file inside `.../src/modules/<module>/...`. Returns undefined for files outside a
 * module. Spike: the modules directory is fixed to 'src/modules'; RULES.md makes it configurable.
 */
export function resolveModulePath(fileName: string): ModulePath | undefined {
  const parts = path.resolve(fileName).split(path.sep);
  for (let index = parts.length - 3; index >= 0; index -= 1) {
    const moduleName = parts[index + 2];
    if (parts[index] === 'src' && parts[index + 1] === 'modules' && moduleName !== undefined) {
      const segments = parts.slice(index + 3);
      if (segments.length === 0) {
        return undefined;
      }
      return {
        moduleName,
        moduleRoot: parts.slice(0, index + 3).join(path.sep),
        segments,
      };
    }
  }
  return undefined;
}

export function isLayer(name: string): name is Layer {
  return LAYERS.some((layer: Layer) => layer === name);
}

export type ContractKind = 'service' | 'use-case';

export type ContractFile = {
  readonly kind: ContractKind;
  /** File name without suffix, e.g. 'gate-lookup'. */
  readonly baseName: string;
  readonly role: 'contract' | 'impl';
};

const CONTRACT_FILE_PATTERN = /^([a-z0-9-]+)\.(service|use-case)(\.impl)?\.ts$/;

/** Classifies `<x>.service.ts`, `<x>.service.impl.ts`, `<x>.use-case.ts`, `<x>.use-case.impl.ts`. */
export function classifyContractFile(fileName: string): ContractFile | undefined {
  const match = CONTRACT_FILE_PATTERN.exec(path.basename(fileName));
  const baseName = match?.[1];
  const kind = match?.[2];
  if (baseName === undefined || (kind !== 'service' && kind !== 'use-case')) {
    return undefined;
  }
  return { kind, baseName, role: match?.[3] === undefined ? 'contract' : 'impl' };
}

export function partnerFileName(file: ContractFile): string {
  const suffix = file.role === 'contract' ? '.impl.ts' : '.ts';
  return `${file.baseName}.${file.kind}${suffix}`;
}
