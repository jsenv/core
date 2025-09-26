export const Z_INDEX_EDITING = 1; /* To go above neighbours, but should not be too big to stay under the sticky cells */

/* needed because cell uses position:relative, sticky must win even if before in DOM order */
export const Z_INDEX_STICKY_ROW = Z_INDEX_EDITING + 1;
export const Z_INDEX_STICKY_COLUMN = Z_INDEX_STICKY_ROW + 1;
export const Z_INDEX_STICKY_CORNER = Z_INDEX_STICKY_COLUMN + 1;

export const Z_INDEX_STICKY_FRONTIER_BACKDROP = Z_INDEX_STICKY_CORNER + 1;
export const Z_INDEX_STICKY_FRONTIER_PREVIEW =
  Z_INDEX_STICKY_FRONTIER_BACKDROP + 1;
export const Z_INDEX_STICKY_FRONTIER_GHOST =
  Z_INDEX_STICKY_FRONTIER_PREVIEW + 1;

export const Z_INDEX_DRAGGING_CLONE = Z_INDEX_STICKY_CORNER + 1; // above sticky cells
export const Z_INDEX_RESIZER_BACKDROP = Z_INDEX_STICKY_CORNER + 1; // above sticky cells

export const Z_INDEX_DRAGGING_CELL_PLACEHOLDER = 1;
export const Z_INDEX_STICKY_FRONTIER_HANDLE = 2; // above the cell placeholder to keep the sticky frontier visible
export const Z_INDEX_RESIZER_HANDLE = Z_INDEX_STICKY_FRONTIER_HANDLE + 1;
