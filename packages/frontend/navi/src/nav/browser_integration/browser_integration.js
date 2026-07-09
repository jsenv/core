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
const useNavStateWithWarnings = (id, options) => {
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

  return useNavStateBasic(id, options);
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    idUsageMap.clear();
  });
}

// Preact's own useId() (see preact/hooks) returns "P<mask0>-<mask1>", where
// the mask is derived from render order within the nearest root/async
// boundary — stable across re-renders of the *same* mount, but not across a
// reload (render order can differ) or even across two mounts on the same
// page (two components hitting useId() in the same relative order get the
// same string). Storing one of these under type: "push" bakes it into a
// history entry: reload the page and the entry's key may now belong to a
// completely different component (or none), silently auto-opening whatever
// happens to render at that same position instead.
const PREACT_GENERATED_ID_REGEX = /^P\d+-\d+/;
const isLikelyPreactGeneratedId = (id) => PREACT_GENERATED_ID_REGEX.test(id);

const NO_OP = () => {};
const NO_ID_GIVEN = [undefined, NO_OP, NO_OP];
const useNavStateBasic = (
  id,
  { debug, type = "replace", onLeave, defaultValue } = {},
) => {
  // Hooks must be called unconditionally — before the !id early return.
  const state = documentStateSignal.value;
  // Key presence is the flag — the value may be anything, including undefined.
  const keyInState = Boolean(id && state && Object.hasOwn(state, id));
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const prevKeyInStateRef = useRef(keyInState);
  // enteredRef tracks whether enter() was called without a matching leave() yet.
  // It lets the effect distinguish an external disappearance (back button → fire onLeave)
  // from a programmatic one (leave() already set it to false before the state updates).
  const enteredRef = useRef(false);
  useEffect(() => {
    const prevKeyInState = prevKeyInStateRef.current;
    prevKeyInStateRef.current = keyInState;
    if (prevKeyInState && !keyInState && enteredRef.current) {
      enteredRef.current = false;
      onLeaveRef.current?.();
    }
  }, [keyInState]);

  if (!id) {
    return NO_ID_GIVEN;
  }

  let effectiveType = type;
  if (type === "push" && isLikelyPreactGeneratedId(id)) {
    if (import.meta.dev) {
      console.warn(
        `useNavState(${id}): this id looks auto-generated (e.g. preact's useId()) and type is "push" — falling back to "replace". A push history entry keyed by an unstable id won't survive a reload correctly, and could even collide with a different component's own auto-generated id. Pass a stable, explicit id to use type: "push".`,
      );
    }
    effectiveType = "replace";
  }

  const currentValue = keyInState ? state[id] : defaultValue;

  if (debug) {
    console.debug(`useNavState(${id}) current value is ${currentValue}`);
  }

  // enter(value): navigate TO this state (push or replace depending on type).
  // Calling enter() without a value stores "on" — the mere presence of the key
  // in the document state is enough to match; the value just allows associating
  // extra data with the entry when needed.
  const enter = (value = "on") => {
    enteredRef.current = true;
    const currentStateCopy = browserIntegration.getDocumentState() || {};
    if (Object.hasOwn(currentStateCopy, id) && currentStateCopy[id] === value) {
      return;
    }
    currentStateCopy[id] = value;
    navTo(window.location.href, {
      replace: effectiveType !== "push",
      state: currentStateCopy,
    });
  };

  // leave(): navigate AWAY FROM this state (navBack in push mode, replace in replace mode).
  // isBack: when true (cancel close in push mode), call history.back() to restore the
  //   pre-open state — discards any in-progress edits.
  //   When false (confirmed close), replace the pushed entry instead: preserves the
  //   current URL state (e.g. a new picker value) while removing the popup key.
  const leave = ({ isBack } = {}) => {
    enteredRef.current = false;
    const currentStateCopy = browserIntegration.getDocumentState() || {};
    if (!Object.hasOwn(currentStateCopy, id)) {
      return;
    }
    if (effectiveType === "push" && isBack) {
      browserIntegration.navBack();
    } else {
      delete currentStateCopy[id];
      navTo(window.location.href, {
        replace: true,
        state: currentStateCopy,
      });
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
 * @param {object} [options]
 * @param {"push"|"replace"} [options.type="replace"]
 *   Controls how enter() adds the state to browser history.
 *   - "push": creates a new history entry — pressing the back button removes it and calls onLeave.
 *   - "replace": updates the current history entry — no extra history entry is created.
 *   Silently downgraded to "replace" (with a dev-only console.warn) when `id`
 *   looks auto-generated (e.g. preact's own useId()) — an unstable id baked
 *   into a pushed history entry won't survive a reload correctly, and could
 *   even collide with a different component's own auto-generated id. Pass a
 *   stable, explicit id to actually get "push" behavior.
 * @param {() => void} [options.onLeave]
 *   Called when the state key disappears **externally** — e.g. the user presses the browser
 *   back button. Not called when leave() is invoked programmatically.
 * @param {*} [options.defaultValue]
 *   Value returned when `id` is absent from document state. Defaults to `undefined`.
 *
 * @returns {[value, enter, leave]}
 *   - `value`: current value from document state, or `defaultValue` when the key is absent.
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
