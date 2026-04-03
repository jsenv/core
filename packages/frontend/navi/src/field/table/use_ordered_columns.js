import { useRef, useState } from "preact/hooks";

/**
 * Maintains a user-defined column order that overrides the order provided by
 * an external source. Useful when the source (e.g. a database schema) does not
 * support ordering — the user can drag columns into any arrangement and this
 * hook preserves it across re-renders regardless of the order the source returns.
 *
 * The hook also handles changes to column ids from the external source:
 * - **Added** columns are appended at the end of the current order.
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
const createColumnOrdering = (columnIdKey, setOrderedColumnIds) => {
  const stableIdByExternalId = new Map();
  const externalIdByStableId = new Map();
  let nextStableId = 0;
  let prevExternalIds = null;

  // Reconcile maps as external ids change (add/remove/rename columns).
  // Returns the ordered column objects for the current render.
  const sync = (columns, orderedColumnIds) => {
    const externalIds = columns.map((col) => col[columnIdKey]);
    let currentOrderedColumnIds = orderedColumnIds;
    if (prevExternalIds === null) {
      for (const externalId of externalIds) {
        const stableId = nextStableId++;
        stableIdByExternalId.set(externalId, stableId);
        externalIdByStableId.set(stableId, externalId);
      }
    } else {
      const removed = prevExternalIds.filter((id) => !externalIds.includes(id));
      const added = externalIds.filter((id) => !prevExternalIds.includes(id));
      // Pair removed → added as renames so the same stable id is preserved
      const renameCount =
        removed.length < added.length ? removed.length : added.length;
      for (let i = 0; i < renameCount; i++) {
        const stableId = stableIdByExternalId.get(removed[i]);
        stableIdByExternalId.delete(removed[i]);
        stableIdByExternalId.set(added[i], stableId);
        externalIdByStableId.set(stableId, added[i]);
        // Apply rename to the stored order immediately so toOrderedColumns
        // below sees the updated id and keeps the column in its current position
        currentOrderedColumnIds = currentOrderedColumnIds.map((id) =>
          id === removed[i] ? added[i] : id,
        );
      }
      if (currentOrderedColumnIds !== orderedColumnIds) {
        // Persist the renamed ids so future renders start with the correct order
        setOrderedColumnIds(currentOrderedColumnIds);
      }
      for (const id of removed.slice(renameCount)) {
        const stableId = stableIdByExternalId.get(id);
        stableIdByExternalId.delete(id);
        externalIdByStableId.delete(stableId);
      }
      for (const id of added.slice(renameCount)) {
        const stableId = nextStableId++;
        stableIdByExternalId.set(id, stableId);
        externalIdByStableId.set(stableId, id);
      }
    }
    prevExternalIds = externalIds;
    return toOrderedColumns(currentOrderedColumnIds, columns);
  };

  // Given stored external ids, compute the final ordered column list:
  // drop removed columns, append new ones, then map to column objects.
  const toOrderedColumns = (orderedColumnIds, columns) => {
    const currentStableIds = new Set(stableIdByExternalId.values());
    // Convert stored external ids → stable ids (unknown ids are dropped)
    const orderedStableIds = orderedColumnIds
      .map((id) => stableIdByExternalId.get(id))
      .filter((id) => id !== undefined);
    // Append stable ids for columns not yet in the stored order
    for (const stableId of currentStableIds) {
      if (!orderedStableIds.includes(stableId)) orderedStableIds.push(stableId);
    }
    const idToColumnMap = new Map(
      columns.map((col) => [col[columnIdKey], col]),
    );
    return orderedStableIds.map((stableId) =>
      idToColumnMap.get(externalIdByStableId.get(stableId)),
    );
  };

  return { sync };
};
