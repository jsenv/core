import { createEventGroupLogger } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

const DebugFocusContext = createContext(false);
const DebugScrollContext = createContext(false);
const DebugPopupContext = createContext(false);
const DebugUIActionContext = createContext(false);
const DebugActionContext = createContext(false);

const debugNoop = () => {};
const sharedEventGroupLogger = createEventGroupLogger();

export const useDebugFocus = () => {
  const debug = useContext(DebugFocusContext);
  return debug || debugNoop;
};
export const useDebugScroll = () => {
  const debug = useContext(DebugScrollContext);
  return debug || debugNoop;
};
export const useDebugPopup = () => {
  const debug = useContext(DebugPopupContext);
  return debug || debugNoop;
};
export const useDebugUIAction = () => {
  const debug = useContext(DebugUIActionContext);
  return debug || debugNoop;
};
export const useDebugAction = () => {
  const debug = useContext(DebugActionContext);
  return debug || debugNoop;
};

/**
 * NaviDebug — enables debug logging for navi UI interactions within its subtree.
 *
 * Props:
 *   debugFocus   — log focus moves (autoFocus, restoring previous focus, etc.)
 *   debugScroll  — log virtual scroll window updates and scroll-to-item calls
 *   debugPopup — log popover open/close/positioning decisions
 *
 * Pass a boolean `true` to use `console.debug`, or pass a custom function.
 */
export const NaviDebug = ({
  debugUIAction,
  debugAction,
  debugFocus,
  debugScroll,
  debugPopup,
  children,
}) => {
  if (debugUIAction === true) {
    debugUIAction = sharedEventGroupLogger;
  }
  if (debugAction === true) {
    debugAction = sharedEventGroupLogger;
  }
  if (debugFocus === true) {
    debugFocus = sharedEventGroupLogger;
  }
  if (debugScroll === true) {
    debugScroll = sharedEventGroupLogger;
  }
  if (debugPopup === true) {
    debugPopup = sharedEventGroupLogger;
  }

  return (
    <DebugFocusContext.Provider value={debugFocus}>
      <DebugScrollContext.Provider value={debugScroll}>
        <DebugPopupContext.Provider value={debugPopup}>
          <DebugActionContext.Provider value={debugAction}>
            <DebugUIActionContext.Provider value={debugUIAction}>
              {children}
            </DebugUIActionContext.Provider>
          </DebugActionContext.Provider>
        </DebugPopupContext.Provider>
      </DebugScrollContext.Provider>
    </DebugFocusContext.Provider>
  );
};
