import { createContext } from "preact";
import { useContext } from "preact/hooks";

const DebugFocusContext = createContext(false);

const debugNoop = () => {};

export const useDebugFocus = () => {
  const debug = useContext(DebugFocusContext);
  return debug || debugNoop;
};

export const Focus = ({ debug, children }) => {
  if (debug === true) {
    debug = console.debug;
  }

  return (
    <DebugFocusContext.Provider value={debug}>
      {children}
    </DebugFocusContext.Provider>
  );
};
