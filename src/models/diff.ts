export type DiffClassification =
  | 'ADDING'
  | 'DELETING'
  | 'REWRITING'
  | 'MIXED'
  | 'UNCHANGED'
  | 'UNKNOWN';

export type DiffBasis = 'TEXT' | 'PARAGRAPH_HASHES' | 'COUNTS_ONLY';

export interface TextBlock {
  paragraphIndex: number;
  words: number;
  excerpt: string;
}

export interface SnapshotDiff {
  id: string;
  documentId: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  fromIndex: number;
  toIndex: number;
  elapsedMs: number;
  wordsAdded: number;
  wordsDeleted: number;
  wordsReplaced: number;
  paragraphsAdded: number;
  paragraphsDeleted: number;
  paragraphsModified: number;
  wordCountDelta: number;
  classification: DiffClassification;
  addedBlocks: TextBlock[];
  deletedBlocks: TextBlock[];
  basis: DiffBasis;
}
