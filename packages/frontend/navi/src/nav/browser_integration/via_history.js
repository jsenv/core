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
    visitedUrlsSignal.value++;
  };

  let abortController = null;
  const handleRoutingTask = (
    url,
    {
      reason,
      navigationType, // "load", "reload", "replace", "push", "traverse"
      state,
    },
  ) => {
    const isSameUrl = url === window.location.href;

    if (navigationType === "push" || navigationType === "replace") {
      // Merge onto the current state so existing useNavState entries (e.g. an
      // open dialog/popover) survive URL changes triggered by signal updates.
      // "traverse" is intentionally excluded: it restores the exact historical
      // state from the history entry, which is the source of truth for back/forward.
      const currentState = getDocumentState() || {};
      markUrlAsVisited(url);
      const effectiveState = {
        ...currentState,
        ...(state || {}),
        jsenv_visited_urls: Array.from(visitedUrlSet),
      };
      if (navigationType === "push") {
        window.history.pushState(effectiveState, null, url);
      } else {
        window.history.replaceState(effectiveState, null, url);
      }
      updateDocumentUrl(url);
      updateDocumentState(effectiveState);
    } else {
      // traverse / reload: state comes from the history entry, no push/replace needed.
      markUrlAsVisited(url);
      updateDocumentUrl(url);
      updateDocumentState(state);
    }

    // Skip route matching for state-only changes: push/replace to the same URL
    // (e.g. useNavState updating document state without changing the route).
    // Do NOT apply for "traverse" — window.location.href is already updated by
    // the browser before the popstate handler runs, so isSameUrl is always true
    // for back/forward navigation regardless of whether the URL actually changed.
    if (
      isSameUrl &&
      (navigationType === "push" || navigationType === "replace")
    ) {
      return undefined;
    }

    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();
    const abortSignal = abortController.signal;
    const { allResult, requestedResult } = applyRouting(url, {
      globalAbortSignal: globalAbortController.signal,
      abortSignal,
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
      // Handle form submissions?
      // Not needed yet
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

  const navTo = async (url, { replace, state = null } = {}) => {
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
      navigationType: "load",
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
    isVisited,
    visitedUrlsSignal,
  };
};
