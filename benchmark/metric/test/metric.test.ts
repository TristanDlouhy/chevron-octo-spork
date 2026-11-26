import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { dependencyDistance, distance, treeEditDistance } from '../src/distance.ts';
import { extract } from '../src/extract.ts';
import type { TreeNode } from '../src/model.ts';

const root = mkdtempSync(join(tmpdir(), 'metric-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function project(name: string, files: Record<string, string>): string {
  const dir = join(root, name);
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, 'src', path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

interface Names {
  svc: string;
  impl: string;
  file: string;
  dir: string;
  types: string;
  fn: string;
}

function layered(n: Names, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'main.ts': `import { ${n.impl} } from './${n.dir}/${n.file}.impl.ts';\nexport function startStation() { return new ${n.impl}().${n.fn}(1); }\n`,
    [`${n.dir}/${n.file}.ts`]: `import type { ${n.types} } from '../domain/${n.types.toLowerCase()}.ts';\nexport interface ${n.svc} { ${n.fn}(x: number): ${n.types}; }\n`,
    [`${n.dir}/${n.file}.impl.ts`]: `import type { ${n.svc} } from './${n.file}.ts';\nimport type { ${n.types} } from '../domain/${n.types.toLowerCase()}.ts';\nexport class ${n.impl} implements ${n.svc} {\n  ${n.fn}(x: number): ${n.types} { return { value: x }; }\n}\n`,
    [`domain/${n.types.toLowerCase()}.ts`]: `export type ${n.types} = { value: number };\n`,
    ...extra,
  };
}

const base = project(
  'base',
  layered({
    svc: 'EnergyService',
    impl: 'EnergyServiceImpl',
    file: 'energy',
    dir: 'services',
    types: 'Level',
    fn: 'charge',
  }),
);
const renamed = project(
  'renamed',
  layered({ svc: 'Qwerty', impl: 'Asdfgh', file: 'zz-top', dir: 'lib', types: 'Foo', fn: 'run' }),
);

describe('metric invariances', () => {
  test('identity: D(x, x) = 0', () => {
    const m = extract(base);
    expect(distance(m, m).total).toBe(0);
  });

  test('renaming all identifiers, files and folders keeps D = 0', () => {
    expect(distance(extract(base), extract(renamed)).total).toBe(0);
  });

  test('reformatting keeps D = 0', () => {
    const files = layered({
      svc: 'EnergyService',
      impl: 'EnergyServiceImpl',
      file: 'energy',
      dir: 'services',
      types: 'Level',
      fn: 'charge',
    });
    const reformatted = Object.fromEntries(
      Object.entries(files).map(([k, v]) => [
        k,
        v.replaceAll(' ', '  ').replaceAll(';\n', '\n\n\n'),
      ]),
    );
    expect(distance(extract(base), extract(project('reformatted', reformatted))).total).toBe(0);
  });

  test('an extra abstraction layer raises D_A', () => {
    const deeper = project('deeper', {
      ...layered({
        svc: 'EnergyService',
        impl: 'EnergyServiceImpl',
        file: 'energy',
        dir: 'services',
        types: 'Level',
        fn: 'charge',
      }),
      'services/energy.impl.ts':
        "import type { EnergyService } from './energy.ts';\nimport type { Level } from '../domain/level.ts';\n" +
        'abstract class BaseEnergy implements EnergyService { abstract charge(x: number): Level; }\n' +
        'export class EnergyServiceImpl extends BaseEnergy {\n  charge(x: number): Level { return { value: x }; }\n}\n',
    });
    const parts = distance(extract(base), extract(deeper));
    expect(parts.depth).toBe(1);
    expect(extract(deeper).depths).toEqual([0, 0, 1, 0]);
  });

  test('flattening all folders raises D_F', () => {
    const flat = project('flat', {
      'main.ts':
        "import { EnergyServiceImpl } from './energy.impl.ts';\nexport function startStation() { return new EnergyServiceImpl().charge(1); }\n",
      'energy.ts':
        "import type { Level } from './level.ts';\nexport interface EnergyService { charge(x: number): Level; }\n",
      'energy.impl.ts':
        "import type { EnergyService } from './energy.ts';\nimport type { Level } from './level.ts';\nexport class EnergyServiceImpl implements EnergyService {\n  charge(x: number): Level { return { value: x }; }\n}\n",
      'level.ts': 'export type Level = { value: number };\n',
    });
    const parts = distance(extract(base), extract(flat));
    expect(parts.files).toBeGreaterThan(0);
    expect(parts.depth).toBe(0);
    expect(parts.dependencies).toBe(0);
  });

  test('tests and declaration files are ignored', () => {
    const withTests = project('with-tests', {
      ...layered({
        svc: 'EnergyService',
        impl: 'EnergyServiceImpl',
        file: 'energy',
        dir: 'services',
        types: 'Level',
        fn: 'charge',
      }),
      'services/energy.test.ts':
        "import { EnergyServiceImpl } from './energy.impl.ts';\nnew EnergyServiceImpl();\n",
      'types.d.ts': 'declare const x: number;\n',
    });
    expect(distance(extract(base), extract(withTests)).total).toBe(0);
  });
});

describe('building blocks', () => {
  const leaf = (kind: 'dir' | 'file'): TreeNode => ({ kind, children: [] });

  test('tree edit distance counts one insertion', () => {
    const a: TreeNode = { kind: 'dir', children: [leaf('file')] };
    const b: TreeNode = { kind: 'dir', children: [leaf('file'), leaf('file')] };
    expect(treeEditDistance(a, b)).toBe(1);
    expect(treeEditDistance(b, a)).toBe(1);
  });

  test('tree edit distance relabels a node', () => {
    const a: TreeNode = { kind: 'dir', children: [leaf('file')] };
    const b: TreeNode = { kind: 'dir', children: [leaf('dir')] };
    expect(treeEditDistance(a, b)).toBe(1);
  });

  test('WL distance ignores node order', () => {
    const g1 = {
      labels: ['entry', 'class', 'interface'] as const,
      edges: [
        [0, 1],
        [1, 2],
      ] as Array<[number, number]>,
    };
    const g2 = {
      labels: ['interface', 'entry', 'class'] as const,
      edges: [
        [1, 2],
        [2, 0],
      ] as Array<[number, number]>,
    };
    expect(
      dependencyDistance(
        { labels: [...g1.labels], edges: g1.edges },
        { labels: [...g2.labels], edges: g2.edges },
      ),
    ).toBeCloseTo(0);
  });

  test('WL distance sees a different wiring', () => {
    const chain = {
      labels: ['entry', 'class', 'interface'] as Array<'entry' | 'class' | 'interface'>,
      edges: [
        [0, 1],
        [1, 2],
      ] as Array<[number, number]>,
    };
    const star = {
      labels: ['entry', 'class', 'interface'] as Array<'entry' | 'class' | 'interface'>,
      edges: [
        [0, 1],
        [0, 2],
      ] as Array<[number, number]>,
    };
    expect(dependencyDistance(chain, star)).toBeGreaterThan(0);
  });
});
