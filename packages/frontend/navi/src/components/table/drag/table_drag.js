import { createContext } from "preact";
import { useContext, useMemo, useState } from "preact/hooks";

import { useStableCallback } from "../../use_stable_callback.js";

const TableDragContext = createContext();
export const TableDragProvider = TableDragContext.Provider;

export const useTableDragContextValue = ({ onColumnOrderChange, columns }) => {
  onColumnOrderChange = useStableCallback(onColumnOrderChange);

  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = (columnIndex) => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = (columnIndex, newColumnIndex) => {
    setGrabTarget(null);
    if (columnIndex === newColumnIndex) {
      return;
    }
    const columnIds = columns.map((col) => col.id);
    // Compute new column order with a single loop
    const columnIdsWithNewOrder = [];
    const draggedColumnId = columnIds[columnIndex];
    let insertedDraggedColumn = false;

    for (let i = 0; i < columnIds.length; i++) {
      // Skip the original position of the dragged column
      if (i === columnIndex) {
        continue;
      }
      // Check if we should insert the dragged column before this position
      if (
        !insertedDraggedColumn &&
        columnIdsWithNewOrder.length === newColumnIndex
      ) {
        columnIdsWithNewOrder.push(draggedColumnId);
        insertedDraggedColumn = true;
      }
      // Add the current column
      columnIdsWithNewOrder.push(columnIds[i]);
    }
    // If we haven't inserted the dragged column yet, it goes at the end
    if (!insertedDraggedColumn) {
      columnIdsWithNewOrder.push(draggedColumnId);
    }
    onColumnOrderChange(columnIdsWithNewOrder);
  };

  return useMemo(() => {
    return {
      grabTarget,
      grabColumn,
      releaseColumn,
      onColumnOrderChange,
    };
  }, [grabTarget]);
};

export const useTableDrag = () => {
  return useContext(TableDragContext);
};
