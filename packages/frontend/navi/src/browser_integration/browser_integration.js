import { useEffect, useRef } from "preact/hooks";
import { updateActions } from "../actions.js";
import { updateRoutes } from "../route/route.js";
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
// TODO: should be called once route are registered
// and we'll likely register all route at once because it would create bug
// to have lazy loaded route as any route (url) can be accessed at any time by
// "definition" (a url can be shared, reloaded, etc)
browserIntegration.init();

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
const useElementStateWithWarnings = (id, initialValue, options) => {
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
        `useElementState ID conflict detected!
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

  return useElementStateBasic(id, initialValue, options);
};

const NOT_SET = {};
const NO_OP = () => {};
const NO_ID_GIVEN = [undefined, NO_OP, NO_OP];
const useElementStateBasic = (id, initialValue, { debug } = {}) => {
  const elementStateRef = useRef(NOT_SET);
  if (!id) {
    return NO_ID_GIVEN;
  }

  if (elementStateRef.current === NOT_SET) {
    const documentState = browserIntegration.getDocumentState();
    const valueInDocumentState = documentState ? documentState[id] : undefined;
    if (valueInDocumentState === undefined) {
      elementStateRef.current = initialValue;
      if (initialValue !== undefined) {
        console.debug(
          `useElementState(${id}) initial value is ${initialValue} (from initialValue passed in as argument)`,
        );
      }
    } else {
      elementStateRef.current = valueInDocumentState;
      if (debug) {
        console.debug(
          `useElementState(${id}) initial value is ${initialValue} (from nav state)`,
        );
      }
    }
  }

  const set = (value) => {
    const currentValue = elementStateRef.current;
    if (typeof value === "function") {
      value = value(currentValue);
    }
    if (debug) {
      console.debug(
        `useElementState(${id}) set ${value} (previous was ${currentValue})`,
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
    elementStateRef.current,
    set,
    () => {
      set(undefined);
    },
  ];
};

export const useElementState = import.meta.dev
  ? useElementStateWithWarnings
  : useElementStateBasic;
