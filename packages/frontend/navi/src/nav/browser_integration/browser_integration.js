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

export const actionIntegratedVia = browserIntegration.integration;
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
  // Detect when the state key disappears externally (e.g. back-button navigation)
  // and notify the caller so it can react (e.g. close a dialog in cancel mode).
  useEffect(() => {
    const prevValue = prevValueInStateRef.current;
    prevValueInStateRef.current = valueInState;
    if (
      onLeaveRef.current &&
      prevValue !== undefined &&
      valueInState === undefined
    ) {
      onLeaveRef.current();
    }
  }, [valueInState]);

  if (!id) {
    return NO_ID_GIVEN;
  }

  const currentValue = valueInState !== undefined ? valueInState : initialValue;

  if (debug) {
    console.debug(`useNavState(${id}) current value is ${currentValue}`);
  }

  const set = (value) => {
    if (typeof value === "function") {
      value = value(currentValue);
    }
    const currentState = browserIntegration.getDocumentState() || {};
    if (value === undefined) {
      // Key already absent — nothing to undo (e.g. back button already fired).
      if (!Object.hasOwn(currentState, id)) {
        return;
      }
      if (type === "push") {
        // Value was pushed as a history entry → go back to pop it.
        browserIntegration.navBack();
      } else {
        const newState = { ...currentState };
        delete newState[id];
        navTo(window.location.href, { replace: true, state: newState });
      }
      return;
    }
    const valueInCurrentState = currentState[id];
    if (valueInCurrentState === value) return;
    const newState = { ...currentState, [id]: value };
    navTo(window.location.href, {
      replace: type !== "push",
      state: newState,
    });
  };

  return [currentValue, set, () => set(undefined)];
};

export const useNavState = import.meta.dev
  ? useNavStateWithWarnings
  : useNavStateBasic;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    idUsageMap.clear();
  });
}
