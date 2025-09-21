/* needed because cell uses position:relative, sticky must win even if before in DOM order */
export const Z_INDEX_STICKY_ROW = 1;
export const Z_INDEX_STICKY_COLUMN = 2;
export const Z_INDEX_STICKY_CORNER = 3;
export const Z_INDEX_DRAGGING_CLONE = Z_INDEX_STICKY_CORNER + 1; // ensure dragging clone is above sticky elements
export const Z_INDEX_RESIZER_BACKDROP = Z_INDEX_STICKY_CORNER + 1; // ensure resizer backdrop is above sticky elements
