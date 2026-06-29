import { useEffect, useRef } from "preact/hooks";

import { updateActions } from "../../action/actions.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { setOnAllRouteReady, setRouteIntegration } from "../route.js";
import {
  documentIsBusySignal,
  routingWhile,
  windowIsLoadingSignal,
  workingWhile,
} from "./document_loading_signal.js";
import { documentStateSignal } from "./document_state_signal.js";
import { documentUrlSignal } from "./document_url_signal.js";
import { setupBrowserIntegrationViaHistory } from "./via_history.js";

let updateRoutes;

const applyActions = (params) => {
  const updateActionsResult = updateActions(params);
  const { allResult, runningActionSet } = updateActionsResult;
  const pendingTaskNameArray = [];
  for (const runningAction of runningActionSet) {
    pendingTaskNameArray.push(runningAction.name);
  }
  workingWhile(() => allResult, pendingTaskNameArray);
  return updateActionsResult;
};
const applyRouting = (
  url,
  {
    globalAbortSignal,
    abortSignal,
    // state
    navigationType,
    isVisited,
    reason,
  },
) => {
  if (!updateRoutes) {
    // .init() not called yet
    // likely because code does not uses routing at all
    return {};
  }
  const {
    loadSet,
    reloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    activeRouteSet,
  } = updateRoutes(url, {
    navigationType,
    isVisited,
    // state,
  });
  if (
    (!loadSet || loadSet.size === 0) &&
    (!reloadSet || reloadSet.size === 0)
  ) {
    return {
      allResult: undefined,
      requestedResult: undefined,
      activeRouteSet: new Set(),
    };
  }
  const updateActionsResult = updateActions({
    globalAbortSignal,
    abortSignal,
    runSet: loadSet,
    rerunSet: reloadSet,
    abortSignalMap,
    reason,
    isReplace: navigationType === "replace",
  });
  const { allResult, runningActionSet } = updateActionsResult;
  const pendingTaskNameArray = [];
  for (const [route, routeAction] of routeLoadRequestedMap) {
    if (runningActionSet.has(routeAction)) {
      pendingTaskNameArray.push(`${route.relativeUrl} -> ${routeAction.name}`);
    }
  }
  routingWhile(() => allResult, pendingTaskNameArray);
  return { ...updateActionsResult, activeRouteSet };
};

const browserIntegration = setupBrowserIntegrationViaHistory({
  applyActions,
  applyRouting,
});

setOnAllRouteReady((v) => {
  updateRoutes = v;
  browserIntegration.init();
});
setRouteIntegration(browserIntegration);

export const navIntegratedVia = browserIntegration.integration;
export const navTo = (target, options) => {
  const url = new URL(target, window.location.href).href;
  const currentUrl = documentUrlSignal.peek();
  if (url === currentUrl) {
    if (options?.state === undefined) {
      return null;
    }
    // State-only update on same URL: skip if state is identical to current.
    const currentState = browserIntegration.getDocumentState();
    if (compareTwoJsValues(options.state, currentState)) {
      return null;
    }
  }
  return browserIntegration.navTo(url, options);
};
export const replaceUrl = (target, options = {}) => {
  return navTo(target, { ...options, replace: true });
};
export const stopLoad = (reason = "stopLoad() called") => {
  const windowIsLoading = windowIsLoadingSignal.value;
  if (windowIsLoading) {
    window.stop();
  }
  const documentIsBusy = documentIsBusySignal.value;
  if (documentIsBusy) {
    browserIntegration.stop(reason);
  }
};
export const reload = browserIntegration.reload;
export const navBack = browserIntegration.navBack;
export const navForward = browserIntegration.navForward;
export const isVisited = browserIntegration.isVisited;
export const visitedUrlsSignal = browserIntegration.visitedUrlsSignal;
export const handleActionTask = browserIntegration.handleActionTask;

const idUsageMap = new Map();
const useNavStateWithWarnings = (id, initialValue, options) => {
  const idRef = useRef(undefined);
  if (idRef.current !== id) {
    const oldId = idRef.current;
    idUsageMap.delete(oldId);
    idRef.current = id;

    const usage = idUsageMap.get(id);
    if (!usage) {
      idUsageMap.set(id, {
        stackTrace: new Error().stack,
      });
    } else {
      console.warn(
        `useNavState ID conflict detected!
ID "${id}" is already in use by another component.
This can cause UI state conflicts and unexpected behavior.
Consider using unique IDs for each component instance.`,
      );
    }
  }

  useEffect(() => {
    return () => {
      idUsageMap.delete(id);
    };
  }, [id]);

  return useNavStateBasic(id, initialValue, options);
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    idUsageMap.clear();
  });
}

const NO_OP = () => {};
const NO_ID_GIVEN = [undefined, NO_OP, NO_OP];
const useNavStateBasic = (
  id,
  initialValue,
  { debug, type = "replace", onLeave } = {},
) => {
  // Hooks must be called unconditionally — before the !id early return.
  const state = documentStateSignal.value;
  const valueInState = id
    ? state !== null
      ? state[id]
      : undefined
    : undefined;
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const prevValueInStateRef = useRef(valueInState);
  // enteredRef tracks whether enter() was called without a matching leave() yet.
  // It lets the effect distinguish an external disappearance (back button → fire onLeave)
  // from a programmatic one (leave() already set it to false before the state updates).
  const enteredRef = useRef(false);
  useEffect(() => {
    const prevValue = prevValueInStateRef.current;
    prevValueInStateRef.current = valueInState;
    if (
      prevValue !== undefined &&
      valueInState === undefined &&
      enteredRef.current
    ) {
      enteredRef.current = false;
      onLeaveRef.current?.();
    }
  }, [valueInState]);

  if (!id) {
    return NO_ID_GIVEN;
  }

  const currentValue = valueInState !== undefined ? valueInState : initialValue;

  if (debug) {
    console.debug(`useNavState(${id}) current value is ${currentValue}`);
  }

  // enter(value): navigate TO this state (push or replace depending on type).
  // Calling enter() without a value stores "on" — the mere presence of the key
  // in the document state is enough to match; the value just allows associating
  // extra data with the entry when needed.
  const enter = (value = "on") => {
    enteredRef.current = true;
    const currentState = browserIntegration.getDocumentState() || {};
    if (currentState[id] === value) {
      return;
    }
    const newState = { ...currentState, [id]: value };
    navTo(window.location.href, {
      replace: type !== "push",
      state: newState,
    });
  };

  // leave(): navigate AWAY FROM this state (navBack in push mode, replace in replace mode).
  // collapse: when true (confirmed close), replace the pushed entry instead of going back.
  //   This preserves the current URL state (e.g. a picker value set while open) while
  //   removing the popup key. The open_prop_change feedback loop is harmless here because
  //   openedRef.current is already false by the time the replace fires.
  const leave = ({ collapse = false } = {}) => {
    enteredRef.current = false;
    const currentState = browserIntegration.getDocumentState() || {};
    if (!Object.hasOwn(currentState, id)) {
      return;
    }
    if (type === "push" && !collapse) {
      browserIntegration.navBack();
    } else {
      const newState = { ...currentState };
      delete newState[id];
      navTo(window.location.href, { replace: true, state: newState });
    }
  };

  return [currentValue, enter, leave];
};

/**
 * Stores a named value in the browser's document state and returns it reactively.
 * The component re-renders whenever the value changes (navigation, back/forward button).
 *
 * @param {string} id
 *   Unique key used to store the value in document state. Must be stable across renders.
 *
 * @param {*} initialValue
 *   Value returned when `id` is absent from document state (e.g. before enter() is called).
 *
 * @param {object} [options]
 * @param {"push"|"replace"} [options.type="replace"]
 *   Controls how enter() adds the state to browser history.
 *   - "push": creates a new history entry — pressing the back button removes it and calls onLeave.
 *   - "replace": updates the current history entry — no extra history entry is created.
 * @param {() => void} [options.onLeave]
 *   Called when the state key disappears **externally** — e.g. the user presses the browser
 *   back button. Not called when leave() is invoked programmatically.
 *
 * @returns {[value, enter, leave]}
 *   - `value`: current value from document state, or `initialValue` when the key is absent.
 *   - `enter(value = "on")`: navigate TO this state (stores `value` under `id`).
 *     Calling without an argument stores `"on"` — the presence of the key is enough to match;
 *     the value allows associating extra data when needed.
 *   - `leave()`: navigate AWAY FROM this state (removes `id` from document state,
 *     or goes back in history when `type` is "push").
 */
export const useNavState = import.meta.dev
  ? useNavStateWithWarnings
  : useNavStateBasic;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    idUsageMap.clear();
  });
}
