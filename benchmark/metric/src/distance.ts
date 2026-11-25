import type { DepthHistogram, FileGraph, StructureModel, TreeNode } from './model.ts';

/** Postorder arrays for the Zhang–Shasha algorithm. */
function postorder(root: TreeNode): { labels: string[]; lml: number[]; keyroots: number[] } {
  const labels: string[] = [];
  const lml: number[] = [];
  const walk = (node: TreeNode): number => {
    let leftmost = -1;
    for (const child of node.children) {
      const l = walk(child);
      if (leftmost === -1) {
        leftmost = l;
      }
    }
    labels.push(node.kind);
    const me = labels.length - 1;
    lml.push(leftmost === -1 ? me : leftmost);
    return lml[me] ?? me;
  };
  walk(root);
  const keyroots: number[] = [];
  const seen = new Set<number>();
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const l = lml[i] ?? i;
    if (!seen.has(l)) {
      seen.add(l);
      keyroots.push(i);
    }
  }
  keyroots.sort((a, b) => a - b);
  return { labels, lml, keyroots };
}

/** Ordered tree edit distance (Zhang–Shasha), unit costs for insert, delete and relabel. */
export function treeEditDistance(a: TreeNode, b: TreeNode): number {
  const A = postorder(a);
  const B = postorder(b);
  const n = A.labels.length;
  const m = B.labels.length;
  const td: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(0));
  for (const i of A.keyroots) {
    for (const j of B.keyroots) {
      const li = A.lml[i] ?? 0;
      const lj = B.lml[j] ?? 0;
      const rows = i - li + 2;
      const cols = j - lj + 2;
      const fd: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
      for (let x = 1; x < rows; x += 1) fd[x]![0] = x;
      for (let y = 1; y < cols; y += 1) fd[0]![y] = y;
      for (let x = 1; x < rows; x += 1) {
        for (let y = 1; y < cols; y += 1) {
          const ai = li + x - 1;
          const bj = lj + y - 1;
          const del = fd[x - 1]![y]! + 1;
          const ins = fd[x]![y - 1]! + 1;
          if ((A.lml[ai] ?? 0) === li && (B.lml[bj] ?? 0) === lj) {
            const rel = fd[x - 1]![y - 1]! + (A.labels[ai] === B.labels[bj] ? 0 : 1);
            fd[x]![y] = Math.min(del, ins, rel);
            td[ai]![bj] = fd[x]![y]!;
          } else {
            const px = (A.lml[ai] ?? 0) - li;
            const py = (B.lml[bj] ?? 0) - lj;
            fd[x]![y] = Math.min(del, ins, fd[px]![py]! + td[ai]![bj]!);
          }
        }
      }
    }
  }
  return td[n - 1]![m - 1]!;
}

function treeSize(node: TreeNode): number {
  return 1 + node.children.reduce((acc, c) => acc + treeSize(c), 0);
}

export function fileStructureDistance(a: TreeNode, b: TreeNode): number {
  return treeEditDistance(a, b) / (treeSize(a) + treeSize(b));
}

/** Total variation distance between two normalised depth histograms. */
export function depthDistance(a: DepthHistogram, b: DepthHistogram): number {
  const sa = a.reduce((x, y) => x + y, 0);
  const sb = b.reduce((x, y) => x + y, 0);
  if (sa === 0 && sb === 0) {
    return 0;
  }
  if (sa === 0 || sb === 0) {
    return 1;
  }
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    sum += Math.abs((a[i] ?? 0) / sa - (b[i] ?? 0) / sb);
  }
  return sum / 2;
}

/** Weisfeiler–Lehman subtree features of a directed, labelled graph (h iterations). */
export function wlFeatures(graph: FileGraph, h = 2): Map<string, number> {
  const n = graph.labels.length;
  const out: number[][] = Array.from({ length: n }, () => []);
  const inc: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of graph.edges) {
    out[a]?.push(b);
    inc[b]?.push(a);
  }
  const features = new Map<string, number>();
  let current: string[] = [...graph.labels];
  const count = (labels: string[]): void => {
    for (const l of labels) {
      features.set(l, (features.get(l) ?? 0) + 1);
    }
  };
  count(current);
  for (let iter = 1; iter <= h; iter += 1) {
    const prev = current;
    current = prev.map((label, v) => {
      const o = (out[v] ?? [])
        .map((w) => prev[w] ?? '')
        .sort()
        .join(',');
      const i = (inc[v] ?? [])
        .map((w) => prev[w] ?? '')
        .sort()
        .join(',');
      return `${iter}:${label}|>${o}|<${i}`;
    });
    count(current);
  }
  return features;
}

function dot(a: Map<string, number>, b: Map<string, number>): number {
  let sum = 0;
  for (const [k, v] of a) {
    sum += v * (b.get(k) ?? 0);
  }
  return sum;
}

export function dependencyDistance(a: FileGraph, b: FileGraph, h = 2): number {
  if (a.labels.length === 0 && b.labels.length === 0) {
    return 0;
  }
  if (a.labels.length === 0 || b.labels.length === 0) {
    return 1;
  }
  const fa = wlFeatures(a, h);
  const fb = wlFeatures(b, h);
  return 1 - dot(fa, fb) / Math.sqrt(dot(fa, fa) * dot(fb, fb));
}

export interface DistanceParts {
  files: number;
  depth: number;
  dependencies: number;
  total: number;
}

/** D = (D_F + D_A + D_G) / 3, equal weights fixed in the protocol. */
export function distance(a: StructureModel, b: StructureModel): DistanceParts {
  const files = fileStructureDistance(a.tree, b.tree);
  const depth = depthDistance(a.depths, b.depths);
  const dependencies = dependencyDistance(a.graph, b.graph);
  return { files, depth, dependencies, total: (files + depth + dependencies) / 3 };
}

/** Mean pairwise distance over all unordered pairs. */
export function meanPairwise(models: readonly StructureModel[]): number {
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < models.length; i += 1) {
    for (let j = i + 1; j < models.length; j += 1) {
      sum += distance(models[i]!, models[j]!).total;
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : sum / pairs;
}
