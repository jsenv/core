import { useMemo, useState } from "preact/hooks";

// Column ordering is kept in frontend state because the backend (e.g. PostgreSQL)
// does not maintain a user-defined column order — columns are stored in schema
// definition order and cannot be freely reordered. Rather than forcing the backend
// to persist a separate ordering table, we keep the preferred display order locally
// so the user's arrangement survives re-renders without a round-trip.
export const useOrderedColumns = (
  columns,
  { columnIdKey = "id", initialOrder } = {},
) => {
  const [columnIds, idToColumnMap] = useMemo(() => {
    const columnIds = [];
    const idToColumnMap = new Map();
    for (const column of columns) {
      const columnId = column[columnIdKey];
      columnIds.push(columnId);
      idToColumnMap.set(columnId, column);
    }
    return [columnIds, idToColumnMap];
  }, [columns]);

  const [orderedAllColumnIds, setOrderedAllColumnIds] = useState(
    initialOrder ?? columnIds,
  );

  // Only keep ids that still exist in the current columns (handles deletions/additions)
  const orderedColumnIds = [];
  for (const columnId of orderedAllColumnIds) {
    if (columnIds.includes(columnId)) {
      orderedColumnIds.push(columnId);
    }
  }
  // Append any new columns not yet in the ordered list
  for (const columnId of columnIds) {
    if (!orderedColumnIds.includes(columnId)) {
      orderedColumnIds.push(columnId);
    }
  }

  const orderedColumns = orderedColumnIds.map((columnId) =>
    idToColumnMap.get(columnId),
  );

  return [orderedColumns, setOrderedAllColumnIds];
};
