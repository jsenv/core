import { updateDocumentUrl } from "./document_url_signal.js";

let DEBUG = false;

export const setupRoutingViaNavigation = (handler) => {
  updateDocumentUrl(navigation.currentEntry.url);
  navigation.addEventListener("currententrychange", () => {
    updateDocumentUrl(navigation.currentEntry.url);
  });

  let isReloadFromNavigationAPI = false;
  const navigationReload = navigation.reload;
  navigation.reload = (...args) => {
    isReloadFromNavigationAPI = true;
    navigationReload.call(navigation, ...args);
    isReloadFromNavigationAPI = false;
  };

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
    const { signal } = event;
    const formAction = event.info?.formAction;
    const isReload = event.navigationType === "reload";
    const isReplace = event.navigationType === "replace";
    const currentUrl = navigation.currentEntry.url;
    const destinationUrl = event.destination.url;
    const currentState = navigation.currentEntry.getState();
    const destinationState = event.destination.getState();
    const formData = event.formData || event.info?.formData;
    const formUrl = event.info?.formUrl;
    const stopAbortController = new AbortController();
    const stopSignal = stopAbortController.signal;
    const removeStopButtonClickDetector = detectBrowserStopButtonClick(
      signal,
      () => {
        stopAbortController.abort("stop button clicked");
      },
    );

    if (DEBUG) {
      console.log("receive navigate event", {
        destinationUrl,
        destinationState,
      });
    }

    event.intercept({
      handler: async () => {
        if (event.info?.onStart) {
          event.info.onStart();
        }
        try {
          await handler(event, {
            abortSignal: signal,
            stopSignal,
            formAction,
            formData,
            formUrl,
            isReload,
            isReplace,
            currentUrl,
            destinationUrl,
            currentState,
            destinationState,
          });
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
};

// setupNavigateHandler(async (event, { stopSignal, formAction, formData }) => {
//   if (formAction) {
//     const result = await applyAction(formAction, {
//       signal: stopSignal,
//       formData,
//     });
//     event.info.formActionCallback(result);
//   }

//   await navMethods.applyRouting({
//     sourceUrl: currentUrl,
//     targetUrl: formUrl || destinationUrl,
//     sourceState: currentState,
//     targetState: destinationState || currentState,
//     abortSignal,
//     stopSignal,
//     isReload,
//     isReplace,
//     info: event.info,
//   });
//   if (formUrl) {
//     const finishedPromise = event.target.transition.finished;
//     (async () => {
//       try {
//         await finishedPromise;
//       } finally {
//         navigation.navigate(window.location.href, {
//           state: navigation.currentEntry.getState(),
//           history: "replace",
//         });
//       }
//     })();
//   }
// });

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
let callEffect = () => {};
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
