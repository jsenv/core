/*
 * Everything dev-only in this module hangs off one `import.meta.dev` test at
 * the binding level (`import.meta.dev ? naviDebug.x : noop`), not inside the
 * function bodies. Rollup follows a binding to the function it names, but
 * not an early `return noop` inside a body: the first shape lets it drop every
 * `debugX("…")` call site of the production build, the second keeps them all.
 */

import { createEventGroupLogger } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

const debugNoop = () => {};
const useDebugNoop = () => debugNoop;
const NaviDebugNoop = ({ children }) => children;

const createNaviDebug = () => {
  const DebugCommandContext = createContext(false);
  const DebugInteractionContext = createContext(false);
  const DebugFocusContext = createContext(false);
  const DebugScrollContext = createContext(false);
  const DebugPopupContext = createContext(false);
  const DebugActionContext = createContext(false);
  const DebugUIStateContext = createContext(false);

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
  const debugPopupDefault = eventGroupLogger.createCategory(
    "[popup]",
    "#27ae60",
  );
  const debugUIStateDefault = eventGroupLogger.createCategory(
    "[uistate]",
    "#7f8c8d",
  );
  const debugFocusDefault = eventGroupLogger.createCategory(
    "[focus]",
    "#2980b9",
  );
  const debugScrollDefault = eventGroupLogger.createCategory(
    "[scroll]",
    "#2980b9",
  );

  const useDebugCommand = () => {
    const debug = useContext(DebugCommandContext);
    return debug || debugNoop;
  };
  const useDebugInteraction = () => {
    const debug = useContext(DebugInteractionContext);
    return debug || debugNoop;
  };
  const useDebugFocus = () => {
    const debug = useContext(DebugFocusContext);
    return debug || debugNoop;
  };
  const useDebugScroll = () => {
    const debug = useContext(DebugScrollContext);
    return debug || debugNoop;
  };
  const useDebugPopup = () => {
    const debug = useContext(DebugPopupContext);
    return debug || debugNoop;
  };
  const useDebugAction = () => {
    const debug = useContext(DebugActionContext);
    return debug || debugNoop;
  };
  const useDebugUIState = () => {
    const debug = useContext(DebugUIStateContext);
    return debug || debugNoop;
  };

  const NaviDebug = ({
    debugAll,
    debugCommand = debugAll,
    debugInteraction = debugAll,
    debugFocus = debugAll,
    debugScroll = debugAll,
    debugPopup = debugAll,
    debugAction = debugAll,
    debugUIState = debugAll,
    children,
  }) => {
    if (debugCommand === true) {
      debugCommand = debugCommandDefault;
    }
    if (debugInteraction === true) {
      debugInteraction = debugInteractionDefault;
    }
    if (debugFocus === true || (debugInteraction && debugFocus === undefined)) {
      debugFocus = debugFocusDefault;
    }
    if (
      debugScroll === true ||
      (debugInteraction && debugScroll === undefined)
    ) {
      debugScroll = debugScrollDefault;
    }
    if (debugPopup === true || (debugInteraction && debugPopup === undefined)) {
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
          <DebugFocusContext.Provider value={debugFocus}>
            <DebugScrollContext.Provider value={debugScroll}>
              <DebugPopupContext.Provider value={debugPopup}>
                <DebugActionContext.Provider value={debugAction}>
                  <DebugUIStateContext.Provider value={debugUIState}>
                    {children}
                  </DebugUIStateContext.Provider>
                </DebugActionContext.Provider>
              </DebugPopupContext.Provider>
            </DebugScrollContext.Provider>
          </DebugFocusContext.Provider>
        </DebugInteractionContext.Provider>
      </DebugCommandContext.Provider>
    );
  };

  return {
    useDebugCommand,
    useDebugInteraction,
    useDebugFocus,
    useDebugScroll,
    useDebugPopup,
    useDebugAction,
    useDebugUIState,
    NaviDebug,
  };
};

const naviDebug = import.meta.dev ? createNaviDebug() : null;

// The hooks below expose one concern's logger to components inside <NaviDebug>.
// Each returns the logger function enabled for that concern, or a no-op when the
// concern is off — so call sites can `const debug = useDebugX()` unconditionally.
// The logger is called as `debug(message, …)` or, to group a side effect under
// the native event that caused it, `debug(event, message, …)`.
// In production every hook is the no-op returner and the bundler drops the
// call sites along with their messages.

/** Logger for navi command dispatch (`--navi-*`), or a no-op when disabled. */
export const useDebugCommand = import.meta.dev
  ? naviDebug.useDebugCommand
  : useDebugNoop;
/** Logger for gated interactions (click/scroll/select/…), or a no-op. */
export const useDebugInteraction = import.meta.dev
  ? naviDebug.useDebugInteraction
  : useDebugNoop;
/** Logger for focus moves and focus-visible decisions, or a no-op. */
export const useDebugFocus = import.meta.dev
  ? naviDebug.useDebugFocus
  : useDebugNoop;
/**
 * Logger for virtual scroll / wheel motion (drag, momentum, glide) and for what
 * a virtualized list does about it — the render window moving, and the rows the
 * run asks for or decides not to ask for. Or a no-op.
 */
export const useDebugScroll = import.meta.dev
  ? naviDebug.useDebugScroll
  : useDebugNoop;
/** Logger for popover/dialog open/close/positioning, or a no-op. */
export const useDebugPopup = import.meta.dev
  ? naviDebug.useDebugPopup
  : useDebugNoop;
/** Logger for the action lifecycle (request → run → end), or a no-op. */
export const useDebugAction = import.meta.dev
  ? naviDebug.useDebugAction
  : useDebugNoop;
/** Logger for UI-state transitions, validation and synthetic events, or a no-op. */
export const useDebugUIState = import.meta.dev
  ? naviDebug.useDebugUIState
  : useDebugNoop;

/**
 * Turns on navi's color-coded console logging for everything rendered inside it.
 * Navi has many moving parts (interactions, focus, scroll, popups, commands,
 * actions, ui-state); each concern logs to its own console group so you can
 * watch what navi is doing and why. Components read a concern via its hook
 * (`useDebugScroll`, `useDebugInteraction`, …).
 *
 * Every prop accepts one of:
 * - `true` — log with the built-in color-coded logger (grouped by initiator event)
 * - a function — log with your own callback instead
 * - `false` / omitted — disabled (the concern's hook returns a no-op)
 *
 * `debugAll` is the default for every other prop, so `<NaviDebug debugAll>`
 * turns everything on. Passing `debugInteraction` also enables `debugFocus`,
 * `debugScroll` and `debugPopup` unless those are set explicitly, since they
 * describe the same interaction.
 *
 * Dev-only: the production build of navi renders the children and logs nothing.
 *
 * @param {object} props
 * @param {boolean|Function} [props.debugAll] - Default for every concern below.
 * @param {boolean|Function} [props.debugCommand] - navi command dispatch (`--navi-*`).
 * @param {boolean|Function} [props.debugInteraction] - Gated interactions; also implies focus/scroll/popup.
 * @param {boolean|Function} [props.debugFocus] - Focus moves and focus-visible decisions.
 * @param {boolean|Function} [props.debugScroll] - Virtual scroll / wheel motion,
 *   the render window of a virtualized list, and every pass of its run — what it
 *   asked for, or why it asked for nothing (see docs/list_refresh.md).
 * @param {boolean|Function} [props.debugPopup] - Popover/dialog open/close/positioning.
 * @param {boolean|Function} [props.debugAction] - Action lifecycle.
 * @param {boolean|Function} [props.debugUIState] - UI-state transitions and validation.
 * @param {import("preact").ComponentChildren} props.children
 *
 * @example
 * // Log everything under this subtree
 * <NaviDebug debugAll>
 *   <Picker>…</Picker>
 * </NaviDebug>
 *
 * @example
 * // Only wheel/scroll motion, via a custom sink
 * <NaviDebug debugScroll={(...args) => myLogger.log(...args)}>
 *   <Wheel>…</Wheel>
 * </NaviDebug>
 */
export const NaviDebug = import.meta.dev ? naviDebug.NaviDebug : NaviDebugNoop;

// For a caller whose message costs something to build (a line of numbers
// formatted on every placement): nothing to build for a logger that logs nothing.
// Always true in production, so the bundler drops the building too.
export const isDebugNoop = import.meta.dev
  ? (debug) => debug === debugNoop
  : () => true;
