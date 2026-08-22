import { signal } from "@preact/signals";

import { reportErrorIfNobodyDisplaysIt } from "../../action/action_error_report.js";
import { setActionDispatcher } from "../../action/actions.js";
import { executeWithCleanup } from "../../utils/execute_with_cleanup.js";
import { whenRenderingResumes } from "../rendering_hold.js";
import {
  installScrollRestoration,
  restoreScrollPosition,
} from "./scroll_restoration.js";
import { rearmUrlTarget } from "../url_target/url_target.js";
import { publishAfterRouting, publishBeforeRouting } from "./before_routing.js";
import { updateDocumentState } from "./document_state_signal.js";
import { updateDocumentUrl } from "./document_url_signal.js";
import { getHrefTargetInfo } from "./href_target_info.js";

export const setupBrowserIntegrationViaHistory = ({
  applyActions,
  applyRouting,
  isRouting,
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

  // The one thing the History API cannot say and the Navigation API can: what
  // stands NEXT to the current entry. A link to the page one just came from is
  // morally a back — pushed, it grows the stack (A, B, A, B…) and lands at the
  // top; traversed, the stack stays what the reader thinks it is and the page
  // comes back where they left it. So a push whose destination is the entry
  // right behind (or right ahead) is turned into a traversal, and the whole
  // traverse machinery (routing, scroll, movement) answers it as if the
  // browser's own button had been pressed.
  //
  // Only where the browser exposes the stack (window.navigation — everywhere
  // but Firefox today; without it a push stays a push, which is what this
  // whole file already does). And only towards entries of THIS document: a
  // traversal to another document is a full page load, which no press on a
  // link asked for — the entries that are ours are recorded as they are
  // created, starting with the one this document was loaded into.
  const sameDocumentEntryKeys = new Set();
  const rememberEntryIsOfThisDocument = () => {
    if (window.navigation) {
      sameDocumentEntryKeys.add(window.navigation.currentEntry.key);
    }
  };
  rememberEntryIsOfThisDocument();
  const adjacentEntryDelta = (url) => {
    const { navigation } = window;
    if (!navigation) {
      return 0;
    }
    const entries = navigation.entries();
    const index = navigation.currentEntry.index;
    // Behind first: when the same page stands on both sides (A, B, A and one
    // is on B), a link to it reads as going back.
    for (const delta of [-1, 1]) {
      const entry = entries[index + delta];
      if (entry && entry.url === url && sameDocumentEntryKeys.has(entry.key)) {
        return delta;
      }
    }
    return 0;
  };

  let abortController = null;
  const handleRoutingTask = (url, options) => {
    // Decided before anything is announced: an elided push IS the traversal it
    // becomes, and the traversal will make its own announcements when the
    // browser answers — a before/after cycle here would be about a navigation
    // that never happens.
    if (
      options.navigationType === "push" &&
      options.state === undefined &&
      url !== window.location.href
    ) {
      const delta = adjacentEntryDelta(url);
      if (delta === -1) {
        window.history.back();
        return undefined;
      }
      if (delta === 1) {
        window.history.forward();
        return undefined;
      }
    }
    // Before anything is written: the visited set, the URL and every route are
    // about to change, and this is the last moment the page still stands as it
    // was. And after, whichever way the change went out — so that whoever took
    // something at the first announcement has a definite place to give it back.
    publishBeforeRouting({ url, ...options });
    try {
      const routingResult = applyRoutingTask(url, options);
      if (routingResult && typeof routingResult.then === "function") {
        // Every caller below drops this value — a click handler has nothing to
        // do with what the routing returns — so a rejection here would become
        // an anonymous unhandled one, pointing at the navigation rather than at
        // what failed. It goes to the single place that knows what to do with
        // an error nobody displays (see action_error_report.js).
        routingResult.catch((e) => {
          reportErrorIfNobodyDisplaysIt(e);
        });
      }
      return routingResult;
    } finally {
      publishAfterRouting({ url, ...options });
    }
  };

  const applyRoutingTask = (url, options) => {
    const isSameUrl = url === window.location.href;
    const {
      reason,
      navigationType, // "load", "reload", "replace", "push", "traverse"
      state,
    } = options;

    if (navigationType === "push" || navigationType === "replace") {
      markUrlAsVisited(url);
      // undefined → inherit current state (link click, neutral navigation)
      // null     → explicit reset (no nav-state keys carried over)
      // {...}    → explicit state from enter()/leave(), already built from currentState
      // When state is given it's responsability of the caller to ensure it inherits document state (or not, you want it 99% of the time)
      let effectiveState;
      const sharedState = {
        jsenv_visited_urls: Array.from(visitedUrlSet),
      };
      if (state === undefined) {
        effectiveState = {
          ...(getDocumentState() || {}),
          ...sharedState,
        };
      } else if (state === null) {
        effectiveState = sharedState;
      } else if (state) {
        effectiveState = {
          ...state,
          ...sharedState,
        };
      }
      if (navigationType === "push") {
        window.history.pushState(effectiveState, null, url);
      } else {
        window.history.replaceState(effectiveState, null, url);
      }
      rememberEntryIsOfThisDocument();
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
    if (navigationType === "push") {
      whenRenderingResumes(() => startAtTop(url));
    } else if (navigationType === "traverse") {
      // Where this entry was left. Waited for like the reset above, and for
      // the same two reasons: the page has to be there to be scrolled, and a
      // picture taken before it would be of a page at its top.
      whenRenderingResumes(() => restoreScrollPosition(url));
    }
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
      const { isEmpty, isCurrent, isSameOrigin, isAnchor } =
        getHrefTargetInfo(href);
      if (isEmpty || !isSameOrigin) {
        // Let link to other origins be handled by the browser
        return;
      }
      if (isAnchor) {
        // Fragment navigation belongs to the browser: it owns the indicated
        // part of the document, and taking it over would cost `:target` and the
        // focus handling that come with it.
        if (isCurrent) {
          // Except this one, which the browser answers with a scroll and
          // nothing else: same pathname, same hash, so no event and no url
          // change reaches whoever is waiting on the designated element.
          rearmUrlTarget();
        }
        return;
      }
      // Nothing here declared a route, so there is nothing to route to: the
      // page is a plain document and a link in it is a plain link. Taking it
      // over anyway would push the url and then have nothing to show for it —
      // the address bar moves and the page does not (see applyRouting's own
      // "not called yet" branch, which is where that used to end up).
      if (!isRouting()) {
        return;
      }
      e.preventDefault();
      handleRoutingTask(href, {
        reason: `"click" on a[href="${href}"]`,
        navigationType: "push",
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

  // The browser's own scroll restoration is taken over here rather than left
  // to whoever navigates: it is a decision about the document, and the entry
  // being left must be recorded from the first pixel scrolled.
  installScrollRestoration();

  window.addEventListener("popstate", (popstateEvent) => {
    const url = window.location.href;
    const state = popstateEvent.state;
    handleRoutingTask(url, {
      reason: `"popstate" event for ${url}`,
      navigationType: "traverse",
      state,
    });
  });

  // A fragment navigation is left to the browser (see the click handler above):
  // it owns the indicated part of the document, and taking it over would cost
  // `:target` and the focus handling that come with it. The document url still
  // has to follow it — nothing else here would notice that it moved.
  window.addEventListener("hashchange", () => {
    updateDocumentUrl(window.location.href);
  });

  const navTo = async (url, { replace, state } = {}) => {
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

// A page one arrives at for the first time starts at its top. Only a document
// navigation does that on its own: a pushState creates its entry with whatever
// scroll happened to be there, so without this the new page opens at the offset
// of the one before it — and worse, that borrowed offset is what the browser
// then remembers FOR that entry, and hands back on the way forward.
//
// Push only. A traverse is the browser's business and it is already right: it
// keeps a position per entry and restores it. A replace is not an arrival —
// it is the same place, said differently (a tab row travelling, see
// route_travel.jsx), and resetting there would throw the reader out of a page
// they never left.
//
// After the routes have been told, and after the picture of the page being
// left has been taken — that ordering is the whole subtlety. The routes
// changing is what sets a movement off, and a movement measures the box it is
// leaving as it stands; put the document back to its top any earlier and the
// picture is of a page at its first line, which the reader was not at. The
// browser paints what the new offset shows and nothing else, so what is kept
// of the page being left is the band it had already painted, and the movement
// carries a fragment (see rendering_hold.js, which is where the waiting
// happens). After pushState too, so the entry being left keeps the offset it
// is at.
//
// The document, because the document is the scrollport in the common case. An
// app that scrolls an element of its own scrolls it itself.
const startAtTop = (url) => {
  // A fragment names where to land, and the browser is the one that finds it.
  if (new URL(url, window.location.href).hash) {
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};
