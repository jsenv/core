import { createContext } from "preact";
import { useMemo, useState } from "preact/hooks";

import { useStableCallback } from "../../use_stable_callback.js";

export const TableDragContext = createContext();

export const useTableDragContextValue = ({
  columns,
  setColumnOrder,
  canChangeColumnOrder,
}) => {
  setColumnOrder = useStableCallback(setColumnOrder);

  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = (columnIndex) => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = (columnIndex, newColumnIndex) => {
    setGrabTarget(null);
    if (columnIndex === newColumnIndex) {
      return;
    }
    const columnIdsWithNewOrder = insertColumn(
      columns,
      columnIndex,
      newColumnIndex,
    );
    setColumnOrder(columnIdsWithNewOrder);
  };

  return useMemo(() => {
    return {
      grabTarget,
      grabColumn,
      releaseColumn,
      setColumnOrder,
      canChangeColumnOrder,
    };
  }, [grabTarget, canChangeColumnOrder]);
};

export const insertColumn = (columns, columnIndexA, columnIndexB) => {
  const columnIds = columns.map((col) => col.id);
  const columnIdsWithNewOrder = [];
  const columnIdAtPositionA = columnIds[columnIndexA];

  for (let i = 0; i < columnIds.length; i++) {
    if (i === columnIndexA) {
      // Skip the original position - we're moving this column
      continue;
    }
    if (i === columnIndexB) {
      // At the target position, insert the dragged column
      columnIdsWithNewOrder.push(columnIdAtPositionA);
      // Then add the original column that was at this position
      columnIdsWithNewOrder.push(columnIds[i]);
      continue;
    }
    // Everything else stays in the same order
    columnIdsWithNewOrder.push(columnIds[i]);
  }
  return columnIdsWithNewOrder;
};

export const swapColumns = (columns, columnIndexA, columnIndexB) => {
  const columnIds = columns.map((col) => col.id);
  const columnIdsWithNewOrder = [];
  const columnIdAtPositionA = columnIds[columnIndexA];
  const columnIdAtPositionB = columnIds[columnIndexB];
  for (let i = 0; i < columnIds.length; i++) {
    if (i === columnIndexB) {
      // At the new position, put the dragged column
      columnIdsWithNewOrder.push(columnIdAtPositionA);
      continue;
    }
    if (i === columnIndexA) {
      // At the old position, put what was at the new position
      columnIdsWithNewOrder.push(columnIdAtPositionB);
      continue;
    }
    // Everything else stays the same
    columnIdsWithNewOrder.push(columnIds[i]);
  }
  return columnIdsWithNewOrder;
};
