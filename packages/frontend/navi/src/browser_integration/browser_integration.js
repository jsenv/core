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
  let result;

  // Extract action names from the sets
  const actionNames = [];
  const {
    preloadSet = new Set(),
    loadSet = new Set(),
    reloadSet = new Set(),
  } = params;
  for (const action of preloadSet) {
    actionNames.push(`${action.name} (preload)`);
  }
  for (const action of loadSet) {
    actionNames.push(`${action.name} (load)`);
  }
  for (const action of reloadSet) {
    actionNames.push(`${action.name} (reload)`);
  }

  workingWhile(() => {
    result = updateActions(params);
    const [, browserValueToWait] = result;
    return browserValueToWait;
  }, actionNames);
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
  const result = updateRoutes(url);
  if (!result) {
    return undefined;
  }

  const { loadSet, reloadSet, abortSignalMap, routeLoadRequestedNames } =
    result;

  return routingWhile(() => {
    const [, browserValueToWait] = updateActions(
      {
        globalAbortSignal,
        abortSignal,
        loadSet,
        reloadSet,
        abortSignalMap,
        reason: `Document navigating to ${url}`,
      },
      routeLoadRequestedNames,
    );
    return browserValueToWait;
  });
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
