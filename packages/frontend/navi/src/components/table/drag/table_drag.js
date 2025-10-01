import { createContext } from "preact";
import { useContext, useMemo, useState } from "preact/hooks";

import { useStableCallback } from "../../use_stable_callback.js";

const TableDragContext = createContext();
export const TableDragProvider = TableDragContext.Provider;

export const useTableDragContextValue = ({ onColumnOrderChange }) => {
  onColumnOrderChange = useStableCallback(onColumnOrderChange);

  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = (columnIndex) => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = () => {
    setGrabTarget(null);
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
