import { useEffect, useRef } from "preact/hooks";

import { updateActions } from "../../action/actions.js";
import {
  setBrowserIntegration,
  setOnRouteDefined,
  updateRoutes,
} from "../route.js";
import {
  documentIsBusySignal,
  routingWhile,
  windowIsLoadingSignal,
  workingWhile,
} from "./document_loading_signal.js";
import { setupBrowserIntegrationViaHistory } from "./via_history.js";

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
    replace,
    isVisited,
    reason,
  },
) => {
  const {
    loadSet,
    reloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    activeRouteSet,
  } = updateRoutes(url, {
    replace,
    // state,
    isVisited,
  });
  if (loadSet.size === 0 && reloadSet.size === 0) {
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

setOnRouteDefined(() => {
  browserIntegration.init();
});
setBrowserIntegration(browserIntegration);

export const actionIntegratedVia = browserIntegration.integration;
export const navTo = browserIntegration.navTo;
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

const NOT_SET = {};
const NO_OP = () => {};
const NO_ID_GIVEN = [undefined, NO_OP, NO_OP];
const useNavStateBasic = (id, initialValue, { debug } = {}) => {
  const navStateRef = useRef(NOT_SET);
  if (!id) {
    return NO_ID_GIVEN;
  }

  if (navStateRef.current === NOT_SET) {
    const documentState = browserIntegration.getDocumentState();
    const valueInDocumentState = documentState ? documentState[id] : undefined;
    if (valueInDocumentState === undefined) {
      navStateRef.current = initialValue;
      if (initialValue !== undefined) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from initialValue passed in as argument)`,
        );
      }
    } else {
      navStateRef.current = valueInDocumentState;
      if (debug) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from nav state)`,
        );
      }
    }
  }

  const set = (value) => {
    const currentValue = navStateRef.current;
    if (typeof value === "function") {
      value = value(currentValue);
    }
    if (debug) {
      console.debug(
        `useNavState(${id}) set ${value} (previous was ${currentValue})`,
      );
    }

    const currentState = browserIntegration.getDocumentState() || {};

    if (value === undefined) {
      if (!Object.hasOwn(currentState, id)) {
        return;
      }
      delete currentState[id];
      browserIntegration.replaceDocumentState(currentState, {
        reason: `delete "${id}" from browser state`,
      });
      return;
    }

    const valueInBrowserState = currentState[id];
    if (valueInBrowserState === value) {
      return;
    }
    currentState[id] = value;
    browserIntegration.replaceDocumentState(currentState, {
      reason: `set { ${id}: ${value} } in browser state`,
    });
  };

  return [
    navStateRef.current,
    set,
    () => {
      set(undefined);
    },
  ];
};

export const useNavState = import.meta.dev
  ? useNavStateWithWarnings
  : useNavStateBasic;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    idUsageMap.clear();
  });
}
