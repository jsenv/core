import { useRef, useState } from "preact/hooks";

// Maintains a user-defined column order independently of the external source
// that provides the column list. The source (e.g. a database schema) may not
// preserve order and may change column ids without reordering (e.g. a rename).
// This hook handles all three cases: columns being added (appended at the end),
// removed (dropped from the order), and renamed (position preserved).
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
        setOrderedColumnIds((prev) =>
          prev.map((id) => (id === removed[i] ? added[i] : id)),
        );
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
    return toOrderedColumns(orderedColumnIds, columns);
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
