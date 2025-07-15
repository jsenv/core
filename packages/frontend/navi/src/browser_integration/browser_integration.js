import { setApplyActions, updateActions } from "../actions.js";
import { updateRoutes } from "../route/route.js";
import {
  documentIsBusySignal,
  routingWhile,
  windowIsLoadingSignal,
  workingWhile,
} from "./document_loading_signal.js";
import { setupBrowserIntegrationViaHistory } from "./via_history.js";

const applyActions = (params) => {
  const result = updateActions(params);
  const { allResult, loadingActionSet } = result;
  const loadingTaskNames = [];
  for (const loadingAction of loadingActionSet) {
    loadingTaskNames.push(loadingAction.name);
  }

  workingWhile(() => {
    return allResult;
  }, loadingTaskNames);
  return result;
};
setApplyActions(applyActions);

const applyRouting = (
  url,
  {
    globalAbortSignal,
    abortSignal,
    // state
  },
) => {
  const routingResult = updateRoutes(url);
  if (!routingResult) {
    return undefined;
  }
  const { loadSet, reloadSet, abortSignalMap, routeLoadRequestedMap } =
    routingResult;
  const updateActionsResult = updateActions({
    globalAbortSignal,
    abortSignal,
    loadSet,
    reloadSet,
    abortSignalMap,
    reason: `Document navigating to ${url}`,
  });
  const { requestedResult, allResult, loadingActionSet } = updateActionsResult;
  const loadingTaskNames = [];
  for (const [route, routeAction] of routeLoadRequestedMap) {
    if (loadingActionSet.has(routeAction)) {
      loadingTaskNames.push(`${route.relativeUrl} -> ${routeAction.name}`);
    }
  }

  routingWhile(() => {
    return allResult;
  }, loadingTaskNames);
  return requestedResult;
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
