import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

const TableStickyContext = createContext();
export const TableStickyProvider = TableStickyContext.Provider;

export const useTableStickyContextValue = ({
  stickyLeftFrontierColumnIndex,
  stickyTopFrontierRowIndex,
  onStickyLeftFrontierChange,
  onStickyTopFrontierChange,
}) => {
  const onStickyFrontierLeftChangeRef = useRef();
  onStickyFrontierLeftChangeRef.current = onStickyLeftFrontierChange;
  const onStickyFrontierTopChangeRef = useRef();
  onStickyFrontierTopChangeRef.current = onStickyTopFrontierChange;

  return useMemo(() => {
    return {
      stickyLeftFrontierColumnIndex,
      stickyTopFrontierRowIndex,
      onStickyLeftFrontierChange: (...args) =>
        onStickyFrontierLeftChangeRef.current?.(...args),
      onStickyTopFrontierChange,
    };
  }, [stickyLeftFrontierColumnIndex, stickyTopFrontierRowIndex]);
};

export const useTableSticky = () => {
  return useContext(TableStickyContext);
};
