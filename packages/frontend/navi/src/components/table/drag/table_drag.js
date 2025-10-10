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
    const columnIdsWithNewOrder = moveItem(
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

const moveItem = (array, indexA, indexB) => {
  const newArray = [];
  const movedItem = array[indexA];
  const movingRight = indexA < indexB;

  for (let i = 0; i < array.length; i++) {
    if (movingRight) {
      // Moving right: add target first, then moved item after
      if (i !== indexA) {
        newArray.push(array[i]);
      }
      if (i === indexB) {
        newArray.push(movedItem);
      }
    } else {
      // Moving left: add moved item first, then target after
      if (i === indexB) {
        newArray.push(movedItem);
      }
      if (i !== indexA) {
        newArray.push(array[i]);
      }
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
