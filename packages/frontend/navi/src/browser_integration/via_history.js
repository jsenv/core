import { signal } from "@preact/signals";
import { setActionDispatcher } from "../actions.js";
import { executeWithCleanup } from "../utils/execute_with_cleanup.js";
import { updateDocumentState } from "./document_state_signal.js";
import { documentUrlSignal, updateDocumentUrl } from "./document_url_signal.js";

export const setupBrowserIntegrationViaHistory = ({
  applyActions,
  applyRouting,
}) => {
  const { history } = window;

  let globalAbortController = new AbortController();
  const triggerGlobalAbort = (reason) => {
    globalAbortController.abort(reason);
    globalAbortController = new AbortController();
  };

  const dispatchActions = (params) => {
    const { requestedResult } = applyActions({
      globalAbortSignal: globalAbortController.signal,
      abortSignal: new AbortController().signal,
      ...params,
    });
    return requestedResult;
  };
  setActionDispatcher(dispatchActions);

  const getDocumentState = () => {
    return window.history.state ? { ...window.history.state } : null;
  };

  const replaceDocumentState = (
    newState,
    { reason = "replaceDocumentState called" } = {},
  ) => {
    const url = window.location.href;
    window.history.replaceState(newState, null, url);
    handleRoutingTask(url, {
      replace: true,
      state: newState,
      reason,
    });
  };

  const historyStartAtStart = getDocumentState();
  const visitedUrlSet = historyStartAtStart
    ? new Set(historyStartAtStart.jsenv_visited_urls || [])
    : new Set();

  // Create a signal that tracks visited URLs for reactive updates
  // Using a counter instead of the Set directly for better performance
  // Links will check isVisited() when this signal changes
  const visitedUrlsSignal = signal(0);

  const isVisited = (url) => {
    url = new URL(url, window.location.href).href;
    return visitedUrlSet.has(url);
  };
  const markUrlAsVisited = (url) => {
    if (visitedUrlSet.has(url)) {
      return;
    }
    visitedUrlSet.add(url);

    // Increment signal to notify subscribers that visited URLs changed
    visitedUrlsSignal.value++;

    const historyState = getDocumentState() || {};
    const hsitoryStateWithVisitedUrls = {
      ...historyState,
      jsenv_visited_urls: Array.from(visitedUrlSet),
    };
    window.history.replaceState(
      hsitoryStateWithVisitedUrls,
      null,
      window.location.href,
    );
    updateDocumentState(hsitoryStateWithVisitedUrls);
  };

  let abortController = null;
  const handleRoutingTask = (url, { state, replace, reason }) => {
    markUrlAsVisited(url);
    updateDocumentUrl(url);
    updateDocumentState(state);
    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();

    const { allResult, requestedResult } = applyRouting(url, {
      globalAbortSignal: globalAbortController.signal,
      abortSignal: abortController.signal,
      state,
      replace,
      isVisited,
      reason,
    });

    executeWithCleanup(
      () => allResult,
      () => {
        abortController = undefined;
      },
    );
    return requestedResult;
  };

  // Browser event handlers
  window.addEventListener(
    "click",
    (e) => {
      if (e.button !== 0) {
        // Ignore non-left clicks
        return;
      }
      if (e.metaKey) {
        // Ignore clicks with meta key (e.g. open in new tab)
        return;
      }
      const linkElement = e.target.closest("a");
      if (!linkElement) {
        return;
      }
      const href = linkElement.href;
      if (!href || !href.startsWith(window.location.origin)) {
        return;
      }
      if (linkElement.hasAttribute("data-readonly")) {
        return;
      }
      // TODO: ignore anchor navigation
      e.preventDefault();
      const state = null;
      history.pushState(state, null, href);
      handleRoutingTask(href, {
        state,
        reason: `"click" on a[href="${href}"]`,
      });
    },
    { capture: true },
  );

  window.addEventListener(
    "submit",
    () => {
      // TODO: Handle form submissions
    },
    { capture: true },
  );

  window.addEventListener("popstate", (popstateEvent) => {
    const url = window.location.href;
    const state = popstateEvent.state;
    handleRoutingTask(url, {
      state,
      reason: `"popstate" event for ${url}`,
    });
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
    handleRoutingTask(url, {
      state,
      replace,
      reason: `goTo called with "${url}"`,
    });
  };

  const stop = (reason = "stop called") => {
    triggerGlobalAbort(reason);
  };

  const reload = () => {
    const url = window.location.href;
    const state = history.state;
    handleRoutingTask(url, {
      state,
    });
  };

  const goBack = () => {
    window.history.back();
  };

  const goForward = () => {
    window.history.forward();
  };

  const init = () => {
    const url = window.location.href;
    const state = history.state;
    history.replaceState(state, null, url);
    handleRoutingTask(url, {
      state,
      replace: true,
      reason: "routing initialization",
    });
  };

  return {
    integration: "browser_history_api",
    init,
    goTo,
    stop,
    reload,
    goBack,
    goForward,
    getDocumentState,
    replaceDocumentState,
    isVisited,
    visitedUrlsSignal,
  };
};
