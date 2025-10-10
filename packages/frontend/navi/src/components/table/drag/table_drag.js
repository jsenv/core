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
    const columnIds = columns.map((col) => col.id);
    const columnIdsWithNewOrder = insertItem(
      columnIds,
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

const insertItem = (array, indexA, indexB) => {
  const newArray = [];
  const movedItem = array[indexA];
  for (let i = 0; i < array.length; i++) {
    if (i === indexB) {
      // Insert the moved column at target position
      newArray.push(movedItem);
    }
    if (i !== indexA) {
      // Add all columns except the one being moved
      newArray.push(array[i]);
    }
  }
  return newArray;
};

export const swapItem = (array, indexA, indexB) => {
  const newArray = [];
  const itemAtPositionA = array[indexA];
  const itemAtPositionB = array[indexB];
  for (let i = 0; i < array.length; i++) {
    if (i === indexB) {
      // At the new position, put the dragged column
      newArray.push(itemAtPositionA);
      continue;
    }
    if (i === indexA) {
      // At the old position, put what was at the new position
      newArray.push(itemAtPositionB);
      continue;
    }
    // Everything else stays the same
    newArray.push(array[i]);
  }
  return newArray;
};
