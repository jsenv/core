import { documentIsLoadingSignal } from "./document_loading_signal.js";
import {
  documentIsRoutingSignal,
  routingWhile,
} from "./document_routing_signal.js";
import { documentUrlSignal, updateDocumentUrl } from "./document_url_signal.js";

export const setupRoutingViaHistory = (applyRouting) => {
  const { history } = window;

  updateDocumentUrl(window.location.href);

  window.addEventListener(
    "click",
    (e) => {
      if (e.target.tagName === "A") {
        const href = e.target.href;
        if (href && href.startsWith(window.location.origin)) {
          e.preventDefault();
          history.pushState(null, null, e.target.href);
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

  let stopAbortController = new AbortController();
  const abortStopSignal = (reason) => {
    stopAbortController.abort(reason);
    stopAbortController = new AbortController();
  };

  let popstateAbortController = null;
  window.addEventListener("popstate", async (popstateEvent) => {
    const url = window.location.href;
    const state = popstateEvent.state;
    if (popstateAbortController) {
      popstateAbortController.abort(`navigating to ${url}`);
    }
    popstateAbortController = new AbortController();

    updateDocumentUrl(url);
    routingWhile(
      () => {
        const result = applyRouting({
          signal: popstateAbortController.signal,
          stopSignal: stopAbortController.signal,
          url,
          state,
        });
        return result;
      },
      {
        onFinally: () => {
          popstateAbortController = undefined;
        },
      },
    );
  });
  history.replaceState(null, null, window.location.href);

  const goTo = async (url, { state, replace } = {}) => {
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
  const stopLoad = () => {
    const documentIsLoading = documentIsLoadingSignal.value;
    if (documentIsLoading) {
      window.stop();
      return;
    }
    const documentIsRouting = documentIsRoutingSignal.value;
    if (documentIsRouting) {
      abortStopSignal();
      return;
    }
  };
  const reload = () => {
    window.history.replaceState(null, null, documentUrlSignal.peek());
  };
  const goBack = () => {
    window.history.back();
  };
  const goForward = () => {
    window.history.forward();
  };

  return { goTo, stopLoad, reload, goBack, goForward };
};
