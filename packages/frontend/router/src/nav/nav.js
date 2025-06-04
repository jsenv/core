/**
 * - https://github.com/WICG/navigation-api
 * - https://developer.mozilla.org/en-US/docs/Web/API/Navigation
 * - https://glitch.com/edit/#!/gigantic-honored-octagon?path=index.html%3A1%3A0
 */

import { applyAction } from "../action/action.js";
import { updateCanGoBack, updateCanGoForward } from "../back_and_forward.js";
import { compareTwoJsValues } from "../compare_two_js_values.js";
import { documentIsLoadingSignal } from "../document_loading.js";
import {
  documentIsRoutingSignal,
  updateDocumentState,
  updateDocumentUrl,
} from "../document_routing.js";

let debug = false;

updateDocumentUrl(navigation.currentEntry.url);
updateDocumentState(navigation.currentEntry.getState());
navigation.addEventListener("currententrychange", () => {
  updateDocumentUrl(navigation.currentEntry.url);
  updateDocumentState(navigation.currentEntry.getState());
});

updateCanGoBack(navigation.canGoBack);
updateCanGoForward(navigation.canGoForward);
navigation.addEventListener("currententrychange", () => {
  updateCanGoBack(navigation.canGoBack);
  updateCanGoForward(navigation.canGoForward);
});
navigation.addEventListener("navigatesuccess", () => {
  updateCanGoBack(navigation.canGoBack);
  updateCanGoForward(navigation.canGoForward);
});

let isReloadFromNavigationAPI = false;
const navigationReload = navigation.reload;
navigation.reload = (...args) => {
  isReloadFromNavigationAPI = true;
  navigationReload.call(navigation, ...args);
  isReloadFromNavigationAPI = false;
};

let navMethods;
navigation.addEventListener("navigate", (event) => {
  if (!event.canIntercept) {
    return;
  }
  if (event.hashChange || event.downloadRequest !== null) {
    return;
  }
  if (
    !event.userInitiated &&
    event.navigationType === "reload" &&
    event.isTrusted &&
    !isReloadFromNavigationAPI
  ) {
    // let window.location.reload() reload the whole document
    // (used by jsenv hot reload)
    return;
  }
  const formAction = event.info?.formAction;
  if (!navMethods && !formAction) {
    // navigation not installed and there is no action
    // let the natural browser nav occur
    return;
  }
  const isReload = event.navigationType === "reload";
  const isReplace = event.navigationType === "replace";
  const currentUrl = navigation.currentEntry.url;
  const destinationUrl = event.destination.url;
  const currentState = navigation.currentEntry.getState();
  const destinationState = event.destination.getState();
  const { signal } = event;
  if (debug) {
    console.log("receive navigate event", {
      destinationUrl,
      destinationState,
    });
  }
  const formData = event.formData || event.info?.formData;
  const formUrl = event.info?.formUrl;

  const abortSignal = signal;
  const stopAbortController = new AbortController();
  const stopSignal = stopAbortController.signal;
  const removeStopButtonClickDetector = detectBrowserStopButtonClick(
    signal,
    () => {
      stopAbortController.abort("stop button clicked");
    },
  );

  event.intercept({
    handler: async () => {
      let handle;
      if (formAction) {
        handle = async () => {
          const result = await applyAction(formAction, {
            signal: stopSignal,
            formData,
          });
          event.info.formActionCallback(result);
        };
      } else {
        handle = async () => {
          const targetState = destinationState
            ? { ...currentState, ...destinationState }
            : currentState;
          if (targetState) {
            navigation.updateCurrentEntry({ state: targetState });
          }
          await navMethods.applyRouting({
            sourceUrl: currentUrl,
            targetUrl: formUrl || destinationUrl,
            sourceState: currentState,
            targetState,
            abortSignal,
            stopSignal,
            isReload,
            isReplace,
            info: event.info,
          });
          if (formUrl) {
            const finishedPromise = event.target.transition.finished;
            (async () => {
              try {
                await finishedPromise;
              } finally {
                navigation.navigate(window.location.href, {
                  history: "replace",
                });
              }
            })();
          }
        };
      }
      try {
        await handle();
      } catch (e) {
        console.error(e); // browser remains silent in case of error during handler so we explicitely log the error to the console
        throw e;
      } finally {
        removeStopButtonClickDetector();
      }
    },
    // https://github.com/WICG/navigation-api?tab=readme-ov-file#focus-management
    // without this, after clicking <a href="...">, the focus does to document.body
    // which is problematic for shortcuts for instance
    focusReset: "manual",
  });
});

export const installNavigation = ({ applyRouting, applyAction }) => {
  navMethods = { applyRouting, applyAction };
  navigation.navigate(window.location.href, { history: "replace" });
};
let callEffect = () => {};

/**
 * There is 2 distinct reason to abort a navigation:
 * - the user clicked the browser stop button
 * - the user navigate to an other page
 *
 * When navigating to an other page we don't want to abort anything, the routing does that
 * When clicking the stop button we want to cancel everything
 *
 * To detect that when aborted, we wait a setTimeout to see if we receive a new navigation
 * If yes it means this is an abort due to a new navigation
 * Otherwise it's an abort due to the stop button
 *
 * On top of that stop button must cancel X navigation so the last navigation detecting the stop click
 * is notifying any current navigation that stop button was clicked
 */
const browserStopButtonClickCallbackSet = new Set();
const detectBrowserStopButtonClick = (navigateEventSignal, callback) => {
  callEffect();
  browserStopButtonClickCallbackSet.add(callback);
  navigateEventSignal.addEventListener("abort", async () => {
    const timeout = setTimeout(() => {
      callEffect = () => {};

      for (const browserStopButtonClickCallback of browserStopButtonClickCallbackSet) {
        browserStopButtonClickCallback();
      }
      browserStopButtonClickCallbackSet.clear();
    });
    callEffect = () => {
      clearTimeout(timeout);
    };
  });

  return () => {
    browserStopButtonClickCallbackSet.delete(callback);
  };
};

export const goTo = async (
  url,
  { state, replace, routesLoaded, routesToEnter, routesToLeave } = {},
) => {
  if (replace) {
    await navigation.navigate(url, {
      state,
      history: "replace",
      info: { routesLoaded, routesToEnter, routesToLeave },
    }).finished;
    return;
  }
  if (matchNavigationEntry(navigation.currentEntry, { url, state })) {
    return;
  }
  const entries = navigation.entries();
  const prevEntry = entries[navigation.currentEntry.index - 1];
  if (prevEntry && matchNavigationEntry(prevEntry, { url, state })) {
    goBack();
    return;
  }
  const nextEntry = entries[navigation.currentEntry.index + 1];
  if (nextEntry && matchNavigationEntry(nextEntry, { url, state })) {
    goForward();
    return;
  }
  await navigation.navigate(url, {
    state,
    info: { routesToEnter, routesToLeave },
  }).finished;
};
export const stopLoad = () => {
  const documentIsLoading = documentIsLoadingSignal.value;
  if (documentIsLoading) {
    window.stop();
    return;
  }
  const documentIsRouting = documentIsRoutingSignal.value;
  if (documentIsRouting) {
    window.stop();
    return;
  }
};
export const reload = (params) => {
  navigation.reload(params);
};
export const goBack = () => {
  navigation.back();
};
export const goForward = () => {
  navigation.forward();
};

const matchNavigationEntry = (entry, { url, state }) => {
  const entryUrl = entry.url;
  if (entryUrl !== url) {
    return false;
  }
  if (state) {
    const entryState = entry.getState();
    if (!compareTwoJsValues(entryState, state)) {
      return false;
    }
  }
  return true;
};
