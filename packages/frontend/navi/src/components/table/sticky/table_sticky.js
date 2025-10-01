import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { useStableCallback } from "../../use_stable_callback.js";

const TableStickyContext = createContext();
export const TableStickyProvider = TableStickyContext.Provider;

export const useTableStickyContextValue = ({
  stickyLeftFrontierColumnIndex,
  stickyTopFrontierRowIndex,
  onStickyLeftFrontierChange,
  onStickyTopFrontierChange,
}) => {
  onStickyLeftFrontierChange = useStableCallback(onStickyLeftFrontierChange);
  onStickyTopFrontierChange = useStableCallback(onStickyTopFrontierChange);

  return useMemo(() => {
    return {
      stickyLeftFrontierColumnIndex,
      stickyTopFrontierRowIndex,
      onStickyLeftFrontierChange,
      onStickyTopFrontierChange,
    };
  }, [stickyLeftFrontierColumnIndex, stickyTopFrontierRowIndex]);
};

export const useTableSticky = () => {
  return useContext(TableStickyContext);
};
