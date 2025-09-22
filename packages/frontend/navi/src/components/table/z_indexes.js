/* needed because cell uses position:relative, sticky must win even if before in DOM order */
export const Z_INDEX_STICKY_ROW = 1;
export const Z_INDEX_STICKY_COLUMN = 2;
export const Z_INDEX_STICKY_CORNER = 3;
export const Z_INDEX_STICKY_FRONTIER = 4; // above sticky cells (even corners)
export const Z_INDEX_STICKY_FRONTIER_BACKDROP = 4; // above sticky cells (even corners)
export const Z_INDEX_DRAGGING_CLONE = Z_INDEX_STICKY_FRONTIER + 1; // above sticky cells and sticky frontier
export const Z_INDEX_RESIZER_BACKDROP = Z_INDEX_STICKY_FRONTIER + 1; // above sticky cells and sticky frontier
