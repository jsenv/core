/*
next step is to see if we can cancel a pending navigation

- https://github.com/WICG/navigation-api
- https://developer.mozilla.org/en-US/docs/Web/API/Navigation
- https://glitch.com/edit/#!/gigantic-honored-octagon?path=index.html%3A1%3A0
*/

import { updateCanGoBack, updateCanGoForward } from "../can_go_back_forward.js";
import { documentIsLoadingSignal } from "../document_loading.js";
import { documentIsRoutingSignal } from "../document_routing.js";
import { documentUrlSignal, updateDocumentUrl } from "../document_url.js";

let debug = false;

updateDocumentUrl(navigation.currentEntry.url);
navigation.addEventListener("currententrychange", () => {
  updateDocumentUrl(navigation.currentEntry.url);
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
navigation.reload = () => {
  isReloadFromNavigationAPI = true;
  navigationReload.call(navigation);
  isReloadFromNavigationAPI = false;
};

export const installNavigation = ({ applyRouting }) => {
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
    const url = event.destination.url;
    const state = event.state;
    const { signal } = event;
    if (debug) {
      console.log("receive navigate event");
      signal.addEventListener("abort", () => {
        console.log("nav aborted");
      });
    }
    const method = event.info?.method || "GET";
    const formData = event.formData || event.info?.formData;

    event.intercept({
      handler: async () => {
        await applyRouting({
          method,
          url,
          formData,
          state,
          signal,
          reload: event.navigationType === "reload",
        });
      },
    });
  });
  navigation.navigate(window.location.href, { history: "replace" });
};
export const goTo = (url, { state, replace } = {}) => {
  if (replace) {
    navigation.navigate(url, { state, history: "replace" });
    return;
  }
  const currentUrl = documentUrlSignal.peek();
  if (url === currentUrl) {
    return;
  }
  const entries = navigation.entries();
  const prevEntry = entries[navigation.currentEntry.index - 1];
  if (prevEntry && prevEntry.url === url) {
    goBack();
    return;
  }
  const nextEntry = entries[navigation.currentEntry.index + 1];
  if (nextEntry && nextEntry.url === url) {
    goForward();
    return;
  }
  navigation.navigate(url, { state });
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
export const reload = () => {
  navigation.reload();
};
export const goBack = () => {
  navigation.back();
};
export const goForward = () => {
  navigation.forward();
};
