/** Name-free structural model of one solution. Nothing in here carries an identifier or file name. */
export interface TreeNode {
  kind: 'dir' | 'file';
  children: TreeNode[];
}

export type FileLabel = 'entry' | 'class' | 'mixed' | 'functions' | 'interface' | 'types';

export interface FileGraph {
  labels: FileLabel[];
  /** Directed import edges as index pairs into labels. */
  edges: Array<[number, number]>;
}

/** Counts of implementations per abstraction depth: index 0, 1, 2, 3 (= 3 or more). */
export type DepthHistogram = [number, number, number, number];

export interface Stats {
  files: number;
  maxDirDepth: number;
  interfaces: number;
  classes: number;
  explicitAny: number;
  implicitAny: number;
  importCycles: number;
  tryCatch: number;
  maxFanOut: number;
  externalPackages: string[];
}

export interface StructureModel {
  tree: TreeNode;
  depths: DepthHistogram;
  graph: FileGraph;
  stats: Stats;
}
