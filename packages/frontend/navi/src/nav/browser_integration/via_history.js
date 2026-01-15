import { signal } from "@preact/signals";

import { setActionDispatcher } from "../../action/actions.js";
import { executeWithCleanup } from "../../utils/execute_with_cleanup.js";
import { updateDocumentState } from "./document_state_signal.js";
import { updateDocumentUrl } from "./document_url_signal.js";
import { getHrefTargetInfo } from "./href_target_info.js";

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
    handleRoutingTask(url, {
      reason,
      navigationType: "replace",
      state: newState,
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
    visitedUrlsSignal.value++; // Increment signal to notify subscribers that visited URLs changed

    const historyState = getDocumentState() || {};
    const historyStateWithVisitedUrls = {
      ...historyState,
      jsenv_visited_urls: Array.from(visitedUrlSet),
    };
    window.history.replaceState(
      historyStateWithVisitedUrls,
      null,
      window.location.href,
    );
    updateDocumentState(historyStateWithVisitedUrls);
  };

  let abortController = null;
  const handleRoutingTask = (
    url,
    {
      reason,
      navigationType, // "push", "reload", "replace", "traverse"
      state,
    },
  ) => {
    if (navigationType === "push") {
      window.history.pushState(state, null, url);
    } else if (navigationType === "replace") {
      window.history.replaceState(state, null, url);
    }

    updateDocumentUrl(url);
    updateDocumentState(state);
    markUrlAsVisited(url);
    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();

    const { allResult, requestedResult } = applyRouting(url, {
      globalAbortSignal: globalAbortController.signal,
      abortSignal: abortController.signal,
      reason,
      navigationType,
      isVisited,
      state,
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
      if (e.defaultPrevented) {
        return;
      }
      const linkElement = e.target.closest("a");
      if (!linkElement) {
        return;
      }
      if (linkElement.hasAttribute("data-readonly")) {
        return;
      }
      const href = linkElement.href;
      const { isEmpty, isSameOrigin, isAnchor } = getHrefTargetInfo(href);
      if (
        isEmpty ||
        // Let link to other origins be handled by the browser
        !isSameOrigin ||
        // Ignore anchor navigation (same page, different hash)
        isAnchor
      ) {
        return;
      }
      e.preventDefault();
      handleRoutingTask(href, {
        reason: `"click" on a[href="${href}"]`,
        navigationType: "push",
        state: null,
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
      reason: `"popstate" event for ${url}`,
      navigationType: "traverse",
      state,
    });
  });

  const navTo = async (url, { state = null, replace } = {}) => {
    handleRoutingTask(url, {
      reason: `navTo called with "${url}"`,
      navigationType: replace ? "replace" : "push",
      state,
    });
  };

  const stop = (reason = "stop called") => {
    triggerGlobalAbort(reason);
  };

  const reload = () => {
    const url = window.location.href;
    const state = history.state;
    handleRoutingTask(url, {
      reason: "reload called",
      navigationType: "reload",
      state,
    });
  };

  const navBack = () => {
    window.history.back();
  };

  const navForward = () => {
    window.history.forward();
  };

  const init = () => {
    const url = window.location.href;
    const state = history.state;
    handleRoutingTask(url, {
      reason: "routing initialization",
      navigationType: "replace",
      state,
    });
  };

  return {
    integration: "browser_history_api",
    init,
    navTo,
    stop,
    reload,
    navBack,
    navForward,
    getDocumentState,
    replaceDocumentState,
    isVisited,
    visitedUrlsSignal,
  };
};
