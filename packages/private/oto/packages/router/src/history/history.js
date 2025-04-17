import { updateCanGoBack, updateCanGoForward } from "../can_go_back_forward.js";
import { documentIsLoadingSignal } from "../document_loading.js";
import { documentIsNavigatingSignal } from "../document_navigating.js";
import { documentUrlSignal, updateDocumentUrl } from "../document_url.js";

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
    if (abortNavigation) {
      abortNavigation();
    }
    let abortController = new AbortController();
    abortNavigation = () => {
      abortController.abort();
    };
    const url = documentUrlSignal.peek();
    updateDocumentUrl(url);
    const routingPromise = applyRouting({
      url,
      state: popstateEvent.state,
      signal: abortController.signal,
    });
    try {
      await routingPromise;
    } finally {
      abortController = null;
      abortNavigation = null;
    }
  });
  window.history.replaceState(null, null, window.location.href);
};
let abortNavigation;

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
  const documentIsNavigating = documentIsNavigatingSignal.value;
  if (documentIsNavigating) {
    abortNavigation();
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
