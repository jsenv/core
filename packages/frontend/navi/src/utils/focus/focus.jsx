import { createContext } from "preact";
import { useContext } from "preact/hooks";

const DebugFocusContext = createContext(false);
const DebugScrollContext = createContext(false);

const debugNoop = () => {};

export const useDebugFocus = () => {
  const debug = useContext(DebugFocusContext);
  return debug || debugNoop;
};
export const useDebugScroll = () => {
  const debugScroll = useContext(DebugScrollContext);
  return debugScroll || debugNoop;
};

export const Focus = ({ debug, debugScroll, children }) => {
  if (debug === true) {
    debug = console.debug;
  }
  if (debugScroll === true) {
    debugScroll = console.debug;
  }

  return (
    <DebugScrollContext.Provider value={debugScroll}>
      <DebugFocusContext.Provider value={debug}>
        {children}
      </DebugFocusContext.Provider>
    </DebugScrollContext.Provider>
  );
};
