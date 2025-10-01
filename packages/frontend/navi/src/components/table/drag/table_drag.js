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
    const columnIdsWithNewOrder = [];
    const columnIdAtCurrentPosition = columnIds[columnIndex];
    const columnIdAtNewPosition = columnIds[newColumnIndex];
    for (let i = 0; i < columnIds.length; i++) {
      if (i === newColumnIndex) {
        // At the new position, put the dragged column
        columnIdsWithNewOrder.push(columnIdAtCurrentPosition);
        continue;
      }
      if (i === columnIndex) {
        // At the old position, put what was at the new position
        columnIdsWithNewOrder.push(columnIdAtNewPosition);
        continue;
      }
      // Everything else stays the same
      columnIdsWithNewOrder.push(columnIds[i]);
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
