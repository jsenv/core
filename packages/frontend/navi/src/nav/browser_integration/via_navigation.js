/**
 * The same integration as via_history.js, written on the Navigation API.
 *
 * PREPARED, NOT PLUGGED: history is the integration every browser gets today,
 * because Firefox has no `window.navigation` and one implementation serving
 * everyone beats two serving each their half. This file exists so the switch
 * is a one-line decision (see browser_integration.js) rather than a project;
 * it implements the exact contract of setupBrowserIntegrationViaHistory and is
 * verified against the same demos when flipped on.
 *
 * What the API changes, and what it does not:
 *
 * - ONE interception point. Every navigation — a link, the back button, a
 *   programmatic navigate — arrives as a `navigate` event, so there is no
 *   click listener guessing which presses are navigations: the browser says
 *   so. What must not be taken over (a fragment, a download, a form, a page
 *   with no routes, jsenv's own full reload) is declined there, explicitly.
 * - The stack is readable. The push-elision that via_history.js does by
 *   peeking at `navigation.entries()` is native ground here: a push whose
 *   destination is the entry next door becomes `traverseTo()` before anything
 *   commits.
 * - The browser's loading UI is honest: the intercept handler's promise IS
 *   the navigation, so the spinner spins while routing loads.
 *
 * What does NOT change: the scroll, the rendering hold and the announcements
 * are the shared modules (scroll_restoration.js, rendering_hold.js,
 * before_routing.js) — a picture of the page being left must be taken before
 * anything moves, whichever API drives the entries. Interception asks for
 * `scroll: "manual"` precisely so the browser does not scroll at commit time,
 * which is before the picture.
 */

import { clickIsSuppressed } from "@jsenv/dom";
import { signal } from "@preact/signals";

import { reportErrorIfNobodyDisplaysIt } from "../../action/action_error_report.js";
import { setActionDispatcher } from "../../action/actions.js";
import { executeWithCleanup } from "../../utils/execute_with_cleanup.js";
import { whenRenderingResumes } from "../rendering_hold.js";
import { resolveRouteRedirection } from "../route.js";
import { rearmUrlTarget } from "../url_target/url_target.js";
import { publishAfterRouting, publishBeforeRouting } from "./before_routing.js";
import {
  applyNavigationToNavDepth,
  canNavBackSignal,
  getNavDepth,
  NAV_DEPTH_STATE_KEY,
} from "./document_back_and_forward.js";
import {
  resolveEffectiveDocumentState,
  updateDocumentState,
} from "./document_state_signal.js";
import { updateDocumentUrl } from "./document_url_signal.js";
import { getHrefTargetInfo } from "./href_target_info.js";
import { linkAsksForReplace } from "./link_replace.js";
import {
  installScrollRestoration,
  restoreScrollPosition,
} from "./scroll_restoration.js";

export const setupBrowserIntegrationViaNavigation = ({
  applyActions,
  applyRouting,
  isRouting,
}) => {
  const { navigation } = window;

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
    const state = navigation.currentEntry.getState();
    return state ? { ...state } : null;
  };

  const stateAtStart = getDocumentState();
  const visitedUrlSet = stateAtStart
    ? new Set(stateAtStart.jsenv_visited_urls || [])
    : new Set();
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

  // Entries of THIS document: any entry seen current while this document is
  // alive belongs to it — a traversal to a cross-document entry unloads us
  // before any event fires. Traversing to one of these stays in the page;
  // traversing to any other is a full load no link asked for.
  const sameDocumentEntryKeys = new Set([navigation.currentEntry.key]);
  navigation.addEventListener("currententrychange", () => {
    sameDocumentEntryKeys.add(navigation.currentEntry.key);
    updateDocumentUrl(navigation.currentEntry.url);
  });

  const adjacentEntryKey = (url) => {
    const entries = navigation.entries();
    const index = navigation.currentEntry.index;
    // Behind first: when the same page stands on both sides, a link to it
    // reads as going back.
    for (const delta of [-1, 1]) {
      const entry = entries[index + delta];
      if (entry && entry.url === url && sameDocumentEntryKeys.has(entry.key)) {
        return entry.key;
      }
    }
    return null;
  };

  // An address that only sends elsewhere is answered by going there, and this
  // document never routes to it (see resolveRouteRedirection). A press that
  // asked for a new entry gets one, on the destination; anything else takes the
  // place of the entry the redirecting address would have held — the reader
  // must not be able to walk back into it.
  const redirectAway = (redirectionUrl, { history = "replace", info } = {}) => {
    navigation.navigate(redirectionUrl, { history, info });
  };

  // The routing itself — what the intercept handler, init and reload share.
  // Aborting: each run aborts the previous one, and the navigate event's own
  // signal (superseded navigation, stop button) aborts the current one.
  let abortController = null;
  const runRouting = (url, { reason, navigationType, state, abortEvent }) => {
    const redirectionUrl = resolveRouteRedirection(url);
    if (redirectionUrl) {
      redirectAway(redirectionUrl);
      return { allResult: undefined, requestedResult: undefined };
    }
    // Where the entry being reached stands in this document's own stack —
    // decided before the state that carries it is built (see
    // document_back_and_forward.js).
    applyNavigationToNavDepth(navigationType, state);

    if (navigationType === "push" || navigationType === "replace") {
      markUrlAsVisited(url);
      // The entry already exists (interception commits before the handler
      // runs), so the state is written onto it.
      const effectiveState = resolveEffectiveDocumentState(state, {
        navigationType,
        currentState: getDocumentState(),
        sharedState: {
          jsenv_visited_urls: Array.from(visitedUrlSet),
          [NAV_DEPTH_STATE_KEY]: getNavDepth(),
        },
      });
      navigation.updateCurrentEntry({ state: effectiveState });
      updateDocumentUrl(url);
      updateDocumentState(effectiveState);
    } else {
      markUrlAsVisited(url);
      updateDocumentUrl(url);
      updateDocumentState(state);
    }

    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();
    const routingAbortController = abortController;
    if (abortEvent) {
      abortEvent.addEventListener("abort", () => {
        routingAbortController.abort(abortEvent.reason);
      });
    }
    const { allResult, requestedResult } = applyRouting(url, {
      globalAbortSignal: globalAbortController.signal,
      abortSignal: routingAbortController.signal,
      reason,
      navigationType,
      isVisited,
      state,
    });
    if (navigationType === "push") {
      whenRenderingResumes(() => startAtTop(url));
    } else if (navigationType === "traverse") {
      whenRenderingResumes(() => restoreScrollPosition(url));
    }
    executeWithCleanup(
      () => allResult,
      () => {
        abortController = undefined;
      },
    );
    return { allResult, requestedResult };
  };

  // window.location.reload() — jsenv's hot reload uses it — must stay a full
  // document reload; navigation.reload() would arrive as an interceptable
  // "reload" and be swallowed. Told apart by wrapping the one caller that is
  // ours (nobody here calls navigation.reload today, the wrapper is the
  // contract for whoever does).
  let isReloadFromNavigationAPI = false;
  const navigationReload = navigation.reload.bind(navigation);
  navigation.reload = (...args) => {
    isReloadFromNavigationAPI = true;
    try {
      return navigationReload(...args);
    } finally {
      isReloadFromNavigationAPI = false;
    }
  };

  navigation.addEventListener("navigate", (event) => {
    if (!event.canIntercept) {
      // Another origin, or a cross-document traversal: the browser's business.
      return;
    }
    if (event.hashChange || event.downloadRequest !== null) {
      // A fragment belongs to the browser (`:target`, focus); a download is
      // not a navigation at all.
      return;
    }
    if (event.formData) {
      // Forms are not taken over (same stance as via_history.js's empty
      // submit listener): the browser submits.
      return;
    }
    if (
      event.navigationType === "reload" &&
      event.isTrusted &&
      !isReloadFromNavigationAPI
    ) {
      // window.location.reload(): the full document reload it asks for.
      return;
    }
    if (!isRouting()) {
      // No routes declared: the page is a plain document and a link in it is
      // a plain link.
      return;
    }
    const url = event.destination.url;
    const navigationType = event.navigationType;

    // Before anything is announced or committed: where this url really leads.
    // A push can be declined and re-asked; a traversal the browser has already
    // decided cannot, so it is intercepted and left immediately — the entry is
    // written over on the way out.
    const redirectionUrl = resolveRouteRedirection(url);
    if (redirectionUrl) {
      const options = {
        history: navigationType === "push" ? "push" : "replace",
        info: event.info,
      };
      if (event.cancelable) {
        event.preventDefault();
        redirectAway(redirectionUrl, options);
        return;
      }
      event.intercept({
        scroll: "manual",
        focusReset: "manual",
        handler: async () => {
          redirectAway(redirectionUrl, options);
        },
      });
      return;
    }

    // A link that takes the place of the current entry rather than stacking on
    // it (see link_replace.js). The browser has already decided this is a push
    // and nothing can turn a live push into a replace, so the navigation is
    // declined and re-asked as one — carrying by hand what such a call has no
    // sourceElement to say: the element pressed, and with it what that element
    // asks of a route transition (it wears it as an attribute).
    if (
      navigationType === "push" &&
      event.sourceElement &&
      linkAsksForReplace(event.sourceElement)
    ) {
      event.preventDefault();
      navigation.navigate(url, {
        history: "replace",
        info: { element: event.sourceElement },
      });
      return;
    }

    // A push to the entry next door is morally a traversal: taken as one, the
    // stack stays what the reader thinks it is and the page comes back where
    // they left it. Decided before anything commits — preventDefault is only
    // legal here because a same-document push is cancelable.
    if (
      navigationType === "push" &&
      event.destination.getState() === undefined &&
      url !== window.location.href
    ) {
      const key = adjacentEntryKey(url);
      if (key !== null) {
        event.preventDefault();
        navigation.traverseTo(key);
        return;
      }
    }

    // Before the commit writes anything: the last moment the page still
    // stands as it was, which is what the rendering hold (and the picture of
    // a transition) needs.
    publishBeforeRouting({
      url,
      navigationType,
      // The two things a navigation carries that the url does not: who started
      // it, and what it asks of a route transition (see route_transition.jsx).
      // Both are the same facts via_history.js announces; here the browser
      // hands them over — sourceElement for a press, info for a navTo() call.
      element:
        event.sourceElement || (event.info ? event.info.element : undefined),
      routeTransition: event.info ? event.info.routeTransition : undefined,
    });
    const isSameUrl = url === window.location.href;
    event.intercept({
      // The browser would scroll at commit time — before the picture of the
      // page being left is taken. The shared scroll machinery does it at the
      // right moment instead (see runRouting).
      scroll: "manual",
      // Without this, focus goes to document.body after every navigation,
      // which kills keyboard shortcuts aimed at what was focused.
      focusReset: "manual",
      handler: async () => {
        try {
          const state = event.destination.getState();
          // State-only change on the same url (useNavState): the state signals
          // move, the routes do not.
          if (
            isSameUrl &&
            (navigationType === "push" || navigationType === "replace")
          ) {
            runStateOnly(navigationType, state);
            return;
          }
          const { allResult } = runRouting(url, {
            reason: `"navigate" event towards ${url}`,
            navigationType,
            state,
            abortEvent: event.signal,
          });
          // The handler's promise IS the navigation for the browser (its
          // loading UI follows it) — but a routing that fails is displayed by
          // the page, never thrown at the navigation: rejected here, the
          // browser would abort a navigation whose page is busy explaining
          // what went wrong.
          await Promise.resolve(allResult).catch((e) => {
            reportErrorIfNobodyDisplaysIt(e);
          });
        } finally {
          publishAfterRouting({ url, navigationType });
        }
      },
    });
  });

  const runStateOnly = (navigationType, state) => {
    applyNavigationToNavDepth(navigationType, state);
    const effectiveState = resolveEffectiveDocumentState(state, {
      navigationType,
      currentState: getDocumentState(),
      sharedState: {
        jsenv_visited_urls: Array.from(visitedUrlSet),
        [NAV_DEPTH_STATE_KEY]: getNavDepth(),
      },
    });
    navigation.updateCurrentEntry({ state: effectiveState });
    updateDocumentState(effectiveState);
  };

  // The one press the browser answers with a scroll and nothing else: same
  // pathname, same hash. No navigate event reaches anyone, so the element the
  // url designates has to be re-armed by hand — the same corner case
  // via_history.js keeps a click listener for.
  window.addEventListener(
    "click",
    (e) => {
      if (e.button !== 0 || e.metaKey || e.defaultPrevented) {
        return;
      }
      if (clickIsSuppressed()) {
        // The click that ends a gesture (click_suppression.js in @jsenv/dom).
        // Its suppressor also listens on window in capture, so whichever
        // module registered first runs first — asked explicitly, the order
        // stops mattering.
        return;
      }
      const linkElement = e.target.closest("a");
      if (!linkElement) {
        return;
      }
      const { isCurrent, isAnchor } = getHrefTargetInfo(linkElement.href);
      if (isAnchor && isCurrent) {
        rearmUrlTarget();
      }
    },
    { capture: true },
  );

  installScrollRestoration();

  const navTo = async (url, { replace, state, routeTransition } = {}) => {
    navigation.navigate(url, {
      // Not state: what is asked of a transition is about the navigation, not
      // about the entry it leaves behind. `info` is exactly that — handed to
      // the navigate event and forgotten afterwards.
      info: routeTransition === undefined ? undefined : { routeTransition },
      // undefined stays "inherit" through the event: navigate() stores no
      // state, destination.getState() answers undefined, and runRouting reads
      // that as "keep what the document holds".
      state,
      history: replace ? "replace" : "auto",
    });
  };

  const stop = (reason = "stop called") => {
    triggerGlobalAbort(reason);
  };

  const reload = () => {
    const url = window.location.href;
    runRouting(url, {
      reason: "reload called",
      navigationType: "reload",
      state: getDocumentState(),
    });
  };

  const navBack = ({ fallback } = {}) => {
    // canGoBack says there is an entry behind; what an app's back arrow
    // promises is that the entry behind is one of ITS screens (see
    // document_back_and_forward.js). navigation.back() throws with nowhere to
    // go, so the two are asked together.
    if (canNavBackSignal.peek() && navigation.canGoBack) {
      navigation.back();
      return;
    }
    if (fallback === undefined) {
      return;
    }
    // Replace, not push: pushing the fallback would put the screen just left
    // one press ahead, and the device's own back button would walk straight
    // back into it — a loop with no way out of the app.
    navTo(fallback, { replace: true });
  };
  const navForward = () => {
    if (navigation.canGoForward) {
      navigation.forward();
    }
  };

  const init = () => {
    const url = window.location.href;
    runRouting(url, {
      reason: "routing initialization",
      navigationType: "load",
      state: getDocumentState(),
    });
  };

  return {
    integration: "browser_navigation_api",
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

// Same rule, same timing as via_history.js's own: a page one arrives at for
// the first time starts at its top, once the picture of the page being left
// has been taken.
const startAtTop = (url) => {
  if (new URL(url, window.location.href).hash) {
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};
