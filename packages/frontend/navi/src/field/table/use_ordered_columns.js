import { useRef, useState } from "preact/hooks";

// Column ordering is kept in frontend state because the backend (e.g. PostgreSQL)
// does not maintain a user-defined column order — columns are stored in schema
// definition order and cannot be freely reordered. Rather than forcing the backend
// to persist a separate ordering table, we keep the preferred display order locally
// so the user's arrangement survives re-renders without a round-trip.
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

// Tracks a stable id for each column that persists across renames.
// Stable ids are integers assigned once and kept in sync with the current backend ids.
const createColumnOrdering = (columnIdKey, setOrderedColumnIds) => {
  const stableIdByBackendId = new Map();
  const backendIdByStableId = new Map();
  let nextStableId = 0;
  let prevBackendIds = null;

  // Reconcile maps as backend ids change (add/remove/rename columns).
  // Returns the ordered column objects for the current render.
  const sync = (columns, orderedColumnIds) => {
    const backendIds = columns.map((col) => col[columnIdKey]);
    if (prevBackendIds === null) {
      for (const backendId of backendIds) {
        const stableId = nextStableId++;
        stableIdByBackendId.set(backendId, stableId);
        backendIdByStableId.set(stableId, backendId);
      }
    } else {
      const removed = prevBackendIds.filter((id) => !backendIds.includes(id));
      const added = backendIds.filter((id) => !prevBackendIds.includes(id));
      // Pair removed → added as renames so the same stable id is preserved
      const renameCount =
        removed.length < added.length ? removed.length : added.length;
      for (let i = 0; i < renameCount; i++) {
        const stableId = stableIdByBackendId.get(removed[i]);
        stableIdByBackendId.delete(removed[i]);
        stableIdByBackendId.set(added[i], stableId);
        backendIdByStableId.set(stableId, added[i]);
        setOrderedColumnIds((prev) =>
          prev.map((id) => (id === removed[i] ? added[i] : id)),
        );
      }
      for (const id of removed.slice(renameCount)) {
        const stableId = stableIdByBackendId.get(id);
        stableIdByBackendId.delete(id);
        backendIdByStableId.delete(stableId);
      }
      for (const id of added.slice(renameCount)) {
        const stableId = nextStableId++;
        stableIdByBackendId.set(id, stableId);
        backendIdByStableId.set(stableId, id);
      }
    }
    prevBackendIds = backendIds;
    return toOrderedColumns(orderedColumnIds, columns);
  };

  // Given stored backend ids, compute the final ordered column list:
  // drop removed columns, append new ones, then map to column objects.
  const toOrderedColumns = (orderedColumnIds, columns) => {
    const currentStableIds = new Set(stableIdByBackendId.values());
    // Convert stored backend ids → stable ids (unknown ids are dropped)
    const orderedStableIds = orderedColumnIds
      .map((id) => stableIdByBackendId.get(id))
      .filter((id) => id !== undefined);
    // Append stable ids for columns not yet in the stored order
    for (const stableId of currentStableIds) {
      if (!orderedStableIds.includes(stableId)) orderedStableIds.push(stableId);
    }
    const idToColumnMap = new Map(
      columns.map((col) => [col[columnIdKey], col]),
    );
    return orderedStableIds.map((stableId) =>
      idToColumnMap.get(backendIdByStableId.get(stableId)),
    );
  };

  return { sync };
};
