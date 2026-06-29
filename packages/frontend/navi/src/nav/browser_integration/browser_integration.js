import { useEffect, useRef } from "preact/hooks";

import { updateActions } from "../../action/actions.js";
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
    return null;
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
const useNavStateBasic = (id, initialValue, { debug, type = "replace" } = {}) => {
  if (!id) {
    return NO_ID_GIVEN;
  }

  // Reading documentStateSignal.value subscribes the component to state changes,
  // so it re-renders whenever the browser state changes (back/forward, programmatic update).
  const state = documentStateSignal.value;
  const valueInState = state !== null ? state[id] : undefined;
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
      if (!Object.hasOwn(currentState, id)) return;
      if (type === "push") {
        // The value was added via pushState → go back to pop that history entry.
        browserIntegration.navBack();
      } else {
        const newState = { ...currentState };
        delete newState[id];
        browserIntegration.replaceDocumentState(newState, {
          reason: `delete "${id}" from browser state`,
        });
      }
      return;
    }
    const valueInCurrentState = currentState[id];
    if (valueInCurrentState === value) return;
    const newState = { ...currentState, [id]: value };
    if (type === "push") {
      // Use the internal navTo (bypasses the url === currentUrl guard in the
      // exported navTo) to push a state-only history entry on the same URL.
      browserIntegration.navTo(window.location.href, {
        state: newState,
      });
    } else {
      browserIntegration.replaceDocumentState(newState, {
        reason: `set { ${id}: ${value} } in browser state`,
      });
    }
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
