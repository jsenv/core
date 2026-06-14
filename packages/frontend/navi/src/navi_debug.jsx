import { createEventGroupLogger } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

const DebugCommandContext = createContext(false);
const DebugInteractionContext = createContext(false);
const DebugPopupContext = createContext(false);
const DebugActionContext = createContext(false);
const DebugUIStateContext = createContext(false);

const debugNoop = () => {};
const eventGroupLogger = createEventGroupLogger();
const debugCommandDefault = eventGroupLogger.createCategory(
  "[command]",
  "#8e44ad",
);
const debugInteractionDefault = eventGroupLogger.createCategory(
  "[interaction]",
  "#2980b9",
);
const debugActionDefault = eventGroupLogger.createCategory(
  "[action]",
  "#e67e22",
);
const debugPopupDefault = eventGroupLogger.createCategory("[popup]", "#27ae60");
const debugUIStateDefault = eventGroupLogger.createCategory(
  "[uistate]",
  "#7f8c8d",
);

export const useDebugCommand = () => {
  const debug = useContext(DebugCommandContext);
  return debug || debugNoop;
};
export const useDebugInteraction = () => {
  const debug = useContext(DebugInteractionContext);
  return debug || debugNoop;
};
export const useDebugFocus = () => {
  const debug = useContext(DebugInteractionContext);
  return debug || debugNoop;
};
export const useDebugScroll = () => {
  const debug = useContext(DebugInteractionContext);
  return debug || debugNoop;
};
export const useDebugPopup = () => {
  const debug = useContext(DebugPopupContext);
  return debug || debugNoop;
};
export const useDebugAction = () => {
  const debug = useContext(DebugActionContext);
  return debug || debugNoop;
};
export const useDebugUIState = () => {
  const debug = useContext(DebugUIStateContext);
  return debug || debugNoop;
};

/**
 * NaviDebug — enables debug logging for navi UI interactions within its subtree.
 *
 * Props:
 *   debugInteraction — log focus moves and virtual scroll updates (enables debugFocus + debugScroll)
 *   debugPopup       — log popover open/close/positioning decisions
 *   debugAction      — log action lifecycle events
 *
 * Pass a boolean `true` to use `console.debug`, or pass a custom function.
 */

export const NaviDebug = ({
  debugCommand,
  debugInteraction,
  debugPopup,
  debugAction,
  debugUIState,
  children,
}) => {
  if (debugCommand === true) {
    debugCommand = debugCommandDefault;
  }
  if (debugInteraction === true) {
    debugInteraction = debugInteractionDefault;
  }
  if (debugPopup === true) {
    debugPopup = debugPopupDefault;
  }
  if (debugAction === true) {
    debugAction = debugActionDefault;
  }
  if (debugUIState === true) {
    debugUIState = debugUIStateDefault;
  }

  return (
    <DebugCommandContext.Provider value={debugCommand}>
      <DebugInteractionContext.Provider value={debugInteraction}>
        <DebugPopupContext.Provider value={debugPopup}>
          <DebugActionContext.Provider value={debugAction}>
            <DebugUIStateContext.Provider value={debugUIState}>
              {children}
            </DebugUIStateContext.Provider>
          </DebugActionContext.Provider>
        </DebugPopupContext.Provider>
      </DebugInteractionContext.Provider>
    </DebugCommandContext.Provider>
  );
};
