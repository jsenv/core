import { documentIsLoadingSignal } from "./document_loading_signal.js";
import {
  documentIsRoutingSignal,
  routingWhile,
} from "./document_routing_signal.js";
import { updateDocumentState } from "./document_state_signal.js";
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
    updateDocumentUrl(url);
    updateDocumentState(state);
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
          const state = null; // New navigation, start with null state
          history.pushState(state, null, url);
          handleRouting({
            url,
            state,
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
    handleRouting({
      url,
      state,
    });
  });
  const url = window.location.href;
  const state = history.state;
  history.replaceState(state, null, url);
  handleRouting({
    url,
    state,
  });

  const goTo = async (url, { state = null, replace } = {}) => {
    const currentUrl = documentUrlSignal.peek();
    if (url === currentUrl) {
      return;
    }
    if (replace) {
      window.history.replaceState(state, null, url);
    } else {
      window.history.pushState(state, null, url);
    }
    handleRouting({ url, state });
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
    const url = window.location.href;
    const state = history.state;
    handleRouting({
      url,
      state,
    });
  };
  const goBack = () => {
    window.history.back();
  };
  const goForward = () => {
    window.history.forward();
  };

  const getDocumentState = () => {
    return window.history.state ? { ...window.history.state } : null;
  };
  const replaceDocumentState = (newState) => {
    const url = window.location.href;
    window.history.replaceState(newState, null, url);
    handleRouting({
      url,
      state: newState,
    });
  };

  return {
    goTo,
    stopLoad,
    reload,
    goBack,
    goForward,
    getDocumentState,
    replaceDocumentState,
  };
};
