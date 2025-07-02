import { updateCanGoBack, updateCanGoForward } from "../back_and_forward.js";
import { documentIsLoadingSignal } from "../document_loading.js";
import {
  documentIsRoutingSignal,
  documentUrlSignal,
  updateDocumentUrl,
} from "../document_routing.js";

updateCanGoBack(true);
updateCanGoForward(true);
updateDocumentUrl(window.location.href);

export const installNavigation = ({ applyRouting }) => {
  window.addEventListener(
    "click",
    (e) => {
      if (e.target.tagName === "A") {
        const href = e.target.href;
        if (href && href.startsWith(window.location.origin)) {
          e.preventDefault();
          window.history.pushState(null, null, e.target.href);
        }
      }
    },
    { capture: true },
  );
  window.addEventListener(
    "submit",
    () => {
      // for the form submission it's a bit more tricky
      // we need to have an example with navigation to actually
      // implement it there too
    },
    { capture: true },
  );
  window.addEventListener("popstate", async (popstateEvent) => {
    if (abortRouting) {
      abortRouting();
    }
    let abortController = new AbortController();
    abortRouting = () => {
      abortController.abort();
    };
    const url = documentUrlSignal.peek();
    updateDocumentUrl(url);
    const routingPromise = applyRouting({
      url,
      state: popstateEvent.state,
      stopSignal: abortController.signal,
    });
    try {
      await routingPromise;
    } finally {
      abortController = null;
      abortRouting = null;
    }
  });
  window.history.replaceState(null, null, window.location.href);
};
let abortRouting;

export const goTo = async (url, { state, replace } = {}) => {
  const currentUrl = documentUrlSignal.peek();
  if (url === currentUrl) {
    return;
  }
  if (replace) {
    window.history.replaceState(state, null, url);
  } else {
    window.history.pushState(state, null, url);
  }
};
export const stopLoad = () => {
  const documentIsLoading = documentIsLoadingSignal.value;
  if (documentIsLoading) {
    window.stop();
    return;
  }
  const documentIsRouting = documentIsRoutingSignal.value;
  if (documentIsRouting) {
    abortRouting();
    return;
  }
};
export const reload = () => {
  window.history.replaceState(null, null, documentUrlSignal.peek());
};
export const goBack = () => {
  window.history.back();
};
export const goForward = () => {
  window.history.forward();
};
