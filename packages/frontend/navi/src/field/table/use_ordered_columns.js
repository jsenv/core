import { useRef, useState } from "preact/hooks";

/**
 * Maintains a user-defined column order that overrides the order provided by
 * an external source. Useful when the source does not support ordering — the
 * user can arrange columns as they want and this hook ensures that arrangement
 * is preserved even though the source always returns columns in its own order.
 *
 * The hook also reacts to structural changes in the column list:
 * - **Added** columns are inserted at the position implied by the external order:
 *   the new column is placed right after its closest left neighbor (in external
 *   order) that already exists in the user-defined order. This mirrors where the
 *   source put the column, so the result feels natural (e.g. if the source inserts
 *   a column between B and C, it will appear between B and C in the user order too).
 * - **Removed** columns are dropped from the order.
 * - **Renamed** columns keep their current position (e.g. "name" → "username"
 *   stays in the same slot without any visible jump).
 *
 * @param {Array} columns - Column objects from the external source.
 * @param {Array} [initialOrder] - Optional initial order as an array of column ids.
 *   Defaults to the order in which `columns` is first received.
 * @param {object} [options]
 * @param {string} [options.columnIdKey="id"] - Property name used as the column id.
 * @returns {[Array, Function]} Tuple of ordered column objects and a setter that
 *   accepts an array of column ids to update the order.
 */
export const useOrderedColumns = (
  columns,
  initialOrder,
  { columnIdKey = "id" } = {},
) => {
  const initialColumnIds =
    initialOrder ?? columns.map((col) => col[columnIdKey]);
  const [orderedColumnIds, setOrderedColumnIds] = useState(initialColumnIds);

  const orderingRef = useRef(null);
  if (!orderingRef.current) {
    orderingRef.current = createColumnOrdering(
      columnIdKey,
      setOrderedColumnIds,
    );
  }
  const ordering = orderingRef.current;
  const orderedColumns = ordering.sync(columns, orderedColumnIds);

  return [orderedColumns, setOrderedColumnIds];
};

// Tracks a stable internal id for each column that persists across external id changes (e.g. renames).
// Stable ids are integers assigned once and kept in sync with the current external ids.
export const createColumnOrdering = (columnIdKey, setOrderedColumnIds) => {
  const stableIdByExternalIdMap = new Map();
  const externalIdByStableIdMap = new Map();
  let nextStableId = 0;
  let prevExternalIdSet;
  const columnByExternalIdMap = new Map();

  // Reconcile maps as external ids change (add/remove/rename columns).
  // Returns the ordered column objects for the current render.
  const sync = (columns, orderedColumnIds) => {
    const externalIds = [];
    const externalIdSet = new Set();
    columnByExternalIdMap.clear();
    for (const col of columns) {
      const externalId = col[columnIdKey];
      externalIds.push(externalId);
      externalIdSet.add(externalId);
      columnByExternalIdMap.set(externalId, col);
    }
    let currentOrderedColumnIds = orderedColumnIds;
    if (prevExternalIdSet === undefined) {
      for (const externalId of externalIds) {
        const stableId = nextStableId++;
        stableIdByExternalIdMap.set(externalId, stableId);
        externalIdByStableIdMap.set(stableId, externalId);
      }
    } else {
      const removed = [];
      const added = [];
      for (const id of prevExternalIdSet) {
        if (!externalIdSet.has(id)) {
          removed.push(id);
        }
      }
      for (const id of externalIdSet) {
        if (!prevExternalIdSet.has(id)) {
          added.push(id);
        }
      }
      // Pair removed → added as renames so the same stable id is preserved
      const renameCount =
        removed.length < added.length ? removed.length : added.length;
      const purelyRemoved = removed.slice(renameCount);
      const purelyAdded = added.slice(renameCount);
      for (let i = 0; i < renameCount; i++) {
        const stableId = stableIdByExternalIdMap.get(removed[i]);
        stableIdByExternalIdMap.delete(removed[i]);
        stableIdByExternalIdMap.set(added[i], stableId);
        externalIdByStableIdMap.set(stableId, added[i]);
        // Apply rename to the stored order immediately so toOrderedColumns
        // below sees the updated id and keeps the column in its current position
        currentOrderedColumnIds = currentOrderedColumnIds.map((id) =>
          id === removed[i] ? added[i] : id,
        );
      }
      for (const id of purelyRemoved) {
        const stableId = stableIdByExternalIdMap.get(id);
        stableIdByExternalIdMap.delete(id);
        externalIdByStableIdMap.delete(stableId);
        currentOrderedColumnIds = currentOrderedColumnIds.filter(
          (orderedId) => orderedId !== id,
        );
      }
      for (const id of purelyAdded) {
        const stableId = nextStableId++;
        stableIdByExternalIdMap.set(id, stableId);
        externalIdByStableIdMap.set(stableId, id);
        // Insert at the position implied by the external order: find the closest
        // left neighbor (in external order) that already exists in our stored order
        const idxInExternal = externalIds.indexOf(id);
        let insertAfterIdx = -1;
        for (let j = idxInExternal - 1; j >= 0; j--) {
          const neighborIdx = currentOrderedColumnIds.indexOf(externalIds[j]);
          if (neighborIdx !== -1) {
            insertAfterIdx = neighborIdx;
            break;
          }
        }
        if (insertAfterIdx === -1) {
          currentOrderedColumnIds = [id, ...currentOrderedColumnIds];
        } else {
          currentOrderedColumnIds = [
            ...currentOrderedColumnIds.slice(0, insertAfterIdx + 1),
            id,
            ...currentOrderedColumnIds.slice(insertAfterIdx + 1),
          ];
        }
      }
      if (currentOrderedColumnIds !== orderedColumnIds) {
        setOrderedColumnIds(currentOrderedColumnIds);
      }
    }
    prevExternalIdSet = externalIdSet;
    return toOrderedColumns(currentOrderedColumnIds);
  };

  // Map stored column ids to column objects, dropping any ids no longer present.
  const toOrderedColumns = (orderedColumnIds) => {
    const ordered = [];
    for (const id of orderedColumnIds) {
      const col = columnByExternalIdMap.get(id);
      if (col !== undefined) {
        ordered.push(col);
      }
    }
    return ordered;
  };

  return { sync };
};
