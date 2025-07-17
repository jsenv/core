import { useEffect, useRef } from "preact/hooks";
import { createAction, updateActions } from "../actions.js";
import { createRoute, updateRoutes } from "../route/route.js";
import {
  documentIsBusySignal,
  routingWhile,
  windowIsLoadingSignal,
  workingWhile,
} from "./document_loading_signal.js";
import { setupBrowserIntegrationViaHistory } from "./via_history.js";

const applyActions = (params) => {
  const updateActionsResult = updateActions(params);
  const { allResult, loadingActionSet } = updateActionsResult;
  const loadingTaskNames = [];
  for (const loadingAction of loadingActionSet) {
    loadingTaskNames.push(loadingAction.name);
  }
  workingWhile(() => allResult, loadingTaskNames);
  return updateActionsResult;
};

const applyRouting = (
  url,
  {
    globalAbortSignal,
    abortSignal,
    // state
  },
) => {
  const { loadSet, reloadSet, abortSignalMap, routeLoadRequestedMap } =
    updateRoutes(url);
  if (loadSet.size === 0 && reloadSet.size === 0) {
    return { allResult: undefined, requestedResult: undefined };
  }
  const updateActionsResult = updateActions({
    globalAbortSignal,
    abortSignal,
    loadSet,
    reloadSet,
    abortSignalMap,
    reason: `Document navigating to ${url}`,
  });
  const { allResult, loadingActionSet } = updateActionsResult;
  const loadingTaskNames = [];
  for (const [route, routeAction] of routeLoadRequestedMap) {
    if (loadingActionSet.has(routeAction)) {
      loadingTaskNames.push(`${route.relativeUrl} -> ${routeAction.name}`);
    }
  }
  routingWhile(() => allResult, loadingTaskNames);
  return updateActionsResult;
};

const browserIntegration = setupBrowserIntegrationViaHistory({
  applyActions,
  applyRouting,
});
// All routes MUST be created at once because any url can be accessed
// at any given ti,e (url can be shared, reloaded, etc..)
// Later I'll consider addin ability to have dynamic import into the mix
// (An async function returning an action)
export const defineRoutes = (routeDefinition) => {
  const routeArray = [];
  for (const key of Object.keys(routeDefinition)) {
    const value = routeDefinition[key];
    const route = createRoute(key);
    if (typeof value === "function") {
      const actionFromFunction = createAction(value);
      route.bindAction(actionFromFunction);
    } else if (value) {
      route.bindAction(value);
    }
    routeArray.push(route);
  }
  browserIntegration.init();

  return routeArray;
};

export const actionIntegratedVia = browserIntegration.integration;
export const goTo = browserIntegration.goTo;
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
export const goBack = browserIntegration.goBack;
export const goForward = browserIntegration.goForward;
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
      delete currentState[id];
    } else {
      currentState[id] = value;
    }
    browserIntegration.replaceDocumentState(currentState);
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
