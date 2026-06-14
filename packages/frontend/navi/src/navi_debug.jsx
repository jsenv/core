import { createEventGroupLogger } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

const DebugCommandContext = createContext(false);
const DebugInteractionContext = createContext(false);
const DebugPopupContext = createContext(false);
const DebugActionContext = createContext(false);

const debugNoop = () => {};
const sharedEventGroupLogger = createEventGroupLogger();

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
const debugCommandDefault = (e, ...args) =>
  sharedEventGroupLogger("[command]", e, ...args);
const debugInteractionDefault = (e, ...args) =>
  sharedEventGroupLogger("[interaction]", e, ...args);
const debugActionDefault = (e, ...args) =>
  sharedEventGroupLogger("[action]", e, ...args);
const debugPopupDefault = (e, ...args) =>
  sharedEventGroupLogger("[popup]", e, ...args);

export const NaviDebug = ({
  debugCommand,
  debugInteraction,
  debugPopup,
  debugAction,
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

  return (
    <DebugCommandContext.Provider value={debugCommand}>
      <DebugInteractionContext.Provider value={debugInteraction}>
        <DebugPopupContext.Provider value={debugPopup}>
          <DebugActionContext.Provider value={debugAction}>
            {children}
          </DebugActionContext.Provider>
        </DebugPopupContext.Provider>
      </DebugInteractionContext.Provider>
    </DebugCommandContext.Provider>
  );
};
