import { updateActions } from "../actions.js";
import { updateRoutes } from "../route/route.js";
import {
  documentIsRoutingSignal,
  routingWhile,
  windowIsLoadingSignal,
} from "./document_loading_signal.js";
import { setupBrowserIntegrationViaHistory } from "./via_history.js";

const applyRouting = (
  url,
  {
    globalAbortSignal,
    abortSignal,
    // state
  },
) => {
  return routingWhile(() => {
    const { loadSet, reloadSet, abortSignalMap } = updateRoutes(url);
    const [allResult] = updateActions({
      globalAbortSignal,
      abortSignal,
      loadSet,
      reloadSet,
      abortSignalMap,
      reason: `Document navigating to ${url}`,
    });
    return allResult;
  });
};

const browserIntegration = setupBrowserIntegrationViaHistory();
// TODO: should be called once route are registered
// and we'll likely register all route at once because it would create bug
// to have lazy loaded route as any route (url) can be accessed at any time by
// "definition" (a url can be shared, reloaded, etc)
browserIntegration.init({
  applyRouting,
});

export const actionIntegratedVia = browserIntegration.integration;
export const goTo = browserIntegration.goTo;
export const stopLoad = (reason = "stopLoad() called") => {
  const windowIsLoading = windowIsLoadingSignal.value;
  if (windowIsLoading) {
    window.stop();
  }
  const documentIsRouting = documentIsRoutingSignal.value;
  if (documentIsRouting) {
    browserIntegration.stop(reason);
  }
};
export const reload = browserIntegration.reload;
export const goBack = browserIntegration.goBack;
export const goForward = browserIntegration.goForward;
export const handleActionTask = browserIntegration.handleActionTask;
