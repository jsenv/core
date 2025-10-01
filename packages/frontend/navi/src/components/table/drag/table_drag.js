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
    for (let i = 0; i < columnIds.length; i++) {
      if (i === newColumnIndex) {
        // Insert the dragged column at its new position
        columnIdsWithNewOrder.push(draggedColumnId);
        continue;
      }
      // Add all other columns (skip the original position)
      columnIdsWithNewOrder.push(columnIds[i]);
    }
    debugger;
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
