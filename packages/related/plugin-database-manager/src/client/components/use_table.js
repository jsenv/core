// see https://github.com/TanStack/table/blob/main/packages/react-table/src/index.tsx

import { createTable } from "@tanstack/table-core";
import { useState } from "preact/hooks";

export const useTable = (options) => {
  // Compose in the generic options to the user options
  const resolvedOptions = {
    state: {}, // Dummy state
    onStateChange: () => {}, // noop
    renderFallbackValue: null,
    ...options,
  };
  // Create a new table and store it in state
  const [tableRef] = useState(() => ({
    current: createTable(resolvedOptions),
  }));

  // By default, manage table state here using the table's initial state
  const [state, setState] = useState(() => tableRef.current.initialState);

  // Compose the default state above with any user state. This will allow the user
  // to only control a subset of the state if desired.
  tableRef.current.setOptions((prev) => ({
    ...prev,
    ...options,
    state: {
      ...state,
      ...options.state,
    },
    // Similarly, we'll maintain both our internal state and any user-provided
    // state.
    onStateChange: (updater) => {
      setState(updater);
      options.onStateChange?.(updater);
    },
  }));

  return tableRef.current;
};
