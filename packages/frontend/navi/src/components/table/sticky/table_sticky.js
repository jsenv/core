import { createContext } from "preact";
import { useMemo } from "preact/hooks";

import { useStableCallback } from "../../use_stable_callback.js";

export const TableStickyContext = createContext();

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
