import { documentIsLoadingSignal } from "./document_loading_signal.js";
import {
  documentIsRoutingSignal,
  routingWhile,
} from "./document_routing_signal.js";
import { documentUrlSignal, updateDocumentUrl } from "./document_url_signal.js";

export const setupRoutingViaHistory = (applyRouting) => {
  const { history } = window;

  let stopAbortController = new AbortController();
  const abortStopSignal = (reason) => {
    stopAbortController.abort(reason);
    stopAbortController = new AbortController();
  };

  let abortController = null;
  const handleRouting = ({ url, state }) => {
    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();
    routingWhile(
      () => {
        const result = applyRouting({
          signal: abortController.signal,
          stopSignal: stopAbortController.signal,
          url,
          state,
        });
        return result;
      },
      {
        onFinally: () => {
          abortController = undefined;
        },
      },
    );
  };

  window.addEventListener(
    "click",
    (e) => {
      if (e.target.tagName === "A") {
        const href = e.target.href;
        if (href && href.startsWith(window.location.origin)) {
          e.preventDefault();
          const url = e.target.href;
          history.pushState(null, null, url);
          updateDocumentUrl(url);
          handleRouting({
            url,
            state: history.state,
          });
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

  window.addEventListener("popstate", (popstateEvent) => {
    const url = window.location.href;
    const state = popstateEvent.state;
    updateDocumentUrl(url);
    handleRouting({
      url,
      state,
    });
  });
  const url = window.location.href;
  updateDocumentUrl(url);
  history.replaceState(null, null, url);
  handleRouting({
    url,
    state: history.state,
  });

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
    // Manually trigger routing since pushState/replaceState don't fire popstate
    updateDocumentUrl(url);
    routingWhile(() => {
      const result = applyRouting({
        signal: new AbortController().signal,
        stopSignal: stopAbortController.signal,
        url,
        state,
      });
      return result;
    });
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
