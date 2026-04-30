import { createContext } from "preact";
import { useContext } from "preact/hooks";

const DebugFocusContext = createContext(false);
const DebugScrollContext = createContext(false);
const DebugPopoverContext = createContext(false);

const debugNoop = () => {};

export const useDebugFocus = () => {
  const debug = useContext(DebugFocusContext);
  return debug || debugNoop;
};
export const useDebugScroll = () => {
  const debug = useContext(DebugScrollContext);
  return debug || debugNoop;
};
export const useDebugPopover = () => {
  const debug = useContext(DebugPopoverContext);
  return debug || debugNoop;
};

/**
 * NaviDebug — enables debug logging for navi UI interactions within its subtree.
 *
 * Props:
 *   debugFocus   — log focus moves (autoFocus, restoring previous focus, etc.)
 *   debugScroll  — log virtual scroll window updates and scroll-to-item calls
 *   debugPopover — log popover open/close/positioning decisions
 *
 * Pass a boolean `true` to use `console.debug`, or pass a custom function.
 */
export const NaviDebug = ({
  debugFocus,
  debugScroll,
  debugPopover,
  children,
}) => {
  if (debugFocus === true) {
    debugFocus = console.debug;
  }
  if (debugScroll === true) {
    debugScroll = console.debug;
  }
  if (debugPopover === true) {
    debugPopover = console.debug;
  }

  return (
    <DebugFocusContext.Provider value={debugFocus}>
      <DebugScrollContext.Provider value={debugScroll}>
        <DebugPopoverContext.Provider value={debugPopover}>
          {children}
        </DebugPopoverContext.Provider>
      </DebugScrollContext.Provider>
    </DebugFocusContext.Provider>
  );
};
