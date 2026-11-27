/**
 * The same integration as via_history.js, written on the Navigation API.
 *
 * Maintained, and meant to take over from via_history.js; history is the
 * integration every browser gets today, because Firefox has no
 * `window.navigation`, and an app asks for this one with enableNavigationApi()
 * (see browser_integration.js). The contract is the one
 * setupBrowserIntegrationViaHistory keeps: tests/browser_integration_contract
 * plays the same presses on both, in Chromium and WebKit, and they agree on
 * every one. A change to one integration is made to the other, and that test
 * says when they part.
 *
 * What the API changes, and what it does not:
 *
 * - ONE interception point. Every navigation — the back button, a
 *   programmatic navigate, a link — arrives as a `navigate` event. A link the
 *   routes answer is the one press asked of the browser by hand, from the
 *   link's own click listener (see onLinkClick): so a card around it that
 *   cancels the click on its way up does not take the navigation back, as
 *   with via_history.js. What must not be taken over (a fragment, a
 *   download, a form, a link to another document, a page with no routes,
 *   jsenv's own full reload) is declined there, explicitly.
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

import { clickIsSuppressed, findEvent } from "@jsenv/dom";

import { runUnwatched } from "../../action/run_unwatched.js";
import { setActionDispatcher } from "../../action/actions.js";
import { noteShownByBrowser } from "../page_change.js";
import { whenRenderingResumes } from "../rendering_hold.js";
import { resolveRouteRedirection } from "../route.js";
import { isUrlOfThisDocument } from "../route_pattern.js";
import {
  isTargetWriteInProgress,
  landOnUrlTarget,
  rearmUrlTarget,
} from "../url_target/url_target.js";
import {
  announceRouting,
  publishAfterRouting,
  publishBeforeRouting,
  publishTraversalAsked,
} from "./before_routing.js";
import { whenDocumentMayEnd } from "./document_may_end.js";
import {
  applyNavigationToNavDepth,
  canNavBackSignal,
  getNavDepth,
  NAV_DEPTH_STATE_KEY,
  stateWithNavDepthOnLoad,
} from "./document_back_and_forward.js";
import {
  applyPressWrites,
  documentStateSignal,
  dropGeneratedIdKeys,
  resolveEffectiveDocumentState,
  updateDocumentState,
  writePressWritesHere,
} from "./document_state_signal.js";
import { updateDocumentUrl } from "./document_url_signal.js";
import { getHrefTargetInfo } from "./href_target_info.js";
import { linkAsksForDocument } from "./link_document.js";
import { linkOpensElsewhere, pressOpensElsewhere } from "./link_elsewhere.js";
import {
  linkAsksToOpen,
  NAV_STATE_ENTERED_VALUE,
  readPageStateUnderPopup,
  resolveOpenOnArrival,
} from "./link_open.js";
import { linkAsksForReplace } from "./link_replace.js";
import { linkAsksForReturn } from "./link_return.js";
import { findPressedLink, readLinkHref } from "./pressed_link.js";
import {
  isUrlVisited,
  markUrlAsVisited,
  visitedUrlsSignal,
} from "./visited_urls.js";
import {
  forgetScrollersOnArrival,
  hasScrollPositionToReturnTo,
  installScrollRestoration,
  isArrival,
  restoreScrollPositionOnReturn,
  startAtTop,
  stayInPlace,
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

  // `navigation.currentEntry` is null in a document that is not fully active,
  // and iOS Safari answers null in a document that plainly is (a booted app,
  // minutes into a session — seen through via_history.js, which reads the same
  // getter). Nothing can be done about it, so every read and write of the
  // entry goes through here and has an answer without one: the state is what
  // this document last read from or wrote onto its entry (documentStateSignal
  // is updated with every write below), a write lands on the document alone,
  // and the adjacency has no stack to read.
  const readEntryState = () => {
    const { currentEntry } = navigation;
    if (currentEntry) {
      return currentEntry.getState();
    }
    return documentStateSignal.peek();
  };
  const writeEntryState = (state) => {
    // updateCurrentEntry throws an InvalidStateError without a current entry.
    if (navigation.currentEntry) {
      navigation.updateCurrentEntry({ state });
    }
  };
  const getDocumentState = () => {
    const state = readEntryState();
    return state ? { ...state } : null;
  };

  // Resolved against the address the document stands at (see readAddress);
  // the set is the tab's, out of the entries (see visited_urls.js).
  const isVisited = (url) => {
    return isUrlVisited(new URL(url, readAddress()).href);
  };

  // Entries of THIS document: any entry seen current while this document is
  // alive belongs to it — a traversal to a cross-document entry unloads us
  // before any event fires. Traversing to one of these stays in the page;
  // traversing to any other is a full load no link asked for.
  const sameDocumentEntryKeys = new Set();
  const rememberEntryIsOfThisDocument = () => {
    const { currentEntry } = navigation;
    if (currentEntry) {
      sameDocumentEntryKeys.add(currentEntry.key);
    }
  };
  rememberEntryIsOfThisDocument();
  navigation.addEventListener("currententrychange", () => {
    if (isTargetWriteInProgress()) {
      // The fragment navigation navi makes to set `:target` (see
      // url_target.js), put back to the address and the state it left.
      return;
    }
    rememberEntryIsOfThisDocument();
    const fragment = fragmentPending;
    fragmentPending = null;
    if (fragment) {
      answerFragmentNavigation(fragment);
      return;
    }
    // The change has committed: the document url is the entry's url — unless
    // a debounced replace is still on its way to the browser (a state write
    // onto the entry fires this too), in which case the document is ahead.
    updateDocumentUrl(readAddress());
  });
  // A fragment navigation within the page shown — a `#id` link, the address
  // bar, `location.hash` — is the browser's: it places the element, owns
  // `:target` and the focus, and commits the entry itself. It is answered once
  // committed, as via_history.js answers it: a press onto another `#id` is a
  // push and the same `#id` a replace, with navi's state written onto the
  // entry (its depth, what is open on the page), nothing routed; a traversal
  // between two fragments of the page is a traversal like any other, routed
  // and announced, the position put back.
  let fragmentPending = null;
  const answerFragmentNavigation = ({
    url,
    navigationType,
    state,
    urlLeft,
    stateLeft,
  }) => {
    if (navigationType === "traverse") {
      announceRouting({ url, navigationType }, () =>
        runRouting(url, {
          reason: `fragment traversal towards ${url}`,
          navigationType,
          state,
          urlLeft,
          stateLeft,
        }),
      );
      return;
    }
    const navigationTypeOfEntry =
      url === urlLeft || navigationType === "replace" ? "replace" : "push";
    applyNavigationToNavDepth(navigationTypeOfEntry, undefined);
    const entryState = {
      ...stateLeft,
      [NAV_DEPTH_STATE_KEY]: getNavDepth(),
    };
    writeEntryState(entryState);
    updateDocumentUrl(url);
    updateDocumentState(entryState);
  };

  const entryNextDoor = (delta) => {
    const { currentEntry } = navigation;
    if (!currentEntry) {
      return null;
    }
    const entry = navigation.entries()[currentEntry.index + delta];
    if (!entry || !sameDocumentEntryKeys.has(entry.key)) {
      return null;
    }
    return entry;
  };
  const adjacentEntryKey = (url) => {
    // Behind first: when the same page stands on both sides, a link to it
    // reads as going back.
    for (const delta of [-1, 1]) {
      const entry = entryNextDoor(delta);
      if (entry && entry.url === url) {
        return entry.key;
      }
    }
    return null;
  };
  // Whether a back would land on `target` (see navBackToState in route.js).
  // Never while a back is in flight: the stack read here is the one around the
  // entry being left.
  const isEntryBehind = (target) =>
    !backInFlight &&
    entryNextDoor(-1)?.url === new URL(target, readAddress()).href;

  // An address that only sends elsewhere is answered by going there, and this
  // document never routes to it (see resolveRouteRedirection). A press that
  // asked for a new entry gets one, on the destination; anything else takes the
  // place of the entry the redirecting address would have held — the reader
  // must not be able to walk back into it.
  // Every navigation navi asks of the browser: its promises reject when it is
  // superseded or declined — a push re-asked as a traversal, a press that
  // redirects to the address displayed — which is how the navigate handler
  // answers, never a failure to report.
  const navigate = (url, options) => {
    const result = navigation.navigate(url, options);
    result.committed.catch(() => {});
    result.finished.catch(() => {});
    return result;
  };
  // WebKit answers undefined for a traversal's destination.getState(); the
  // entry being reached holds it all the same.
  const readDestinationState = (event) => {
    const state = event.destination.getState();
    if (state !== undefined || event.navigationType !== "traverse") {
      return state;
    }
    const entry = navigation.entries()[event.destination.index];
    return entry ? entry.getState() : undefined;
  };

  const redirectAway = (redirectionUrl, { history = "replace", info } = {}) => {
    navigate(redirectionUrl, { history, info });
  };

  // The routing itself — what the intercept handler, init and reload share.
  const runRouting = (
    url,
    {
      reason,
      navigationType,
      state,
      urlLeft,
      stateLeft,
      landing,
      pressWrites,
      asReturn,
    },
  ) => {
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
      // runs), so the state is written onto it — and what the entry left held
      // is read by the caller, before that commit.
      const effectiveState = applyPressWrites(
        resolveEffectiveDocumentState(state, {
          navigationType,
          isArrival: isArrival(url, { from: urlLeft }),
          currentState: stateLeft,
          sharedState: {
            [NAV_DEPTH_STATE_KEY]: getNavDepth(),
          },
        }),
        pressWrites,
      );
      writeEntryState(effectiveState);
      updateDocumentUrl(url);
      updateDocumentState(effectiveState);
    } else {
      markUrlAsVisited(url);
      updateDocumentUrl(url);
      updateDocumentState(state);
    }

    // The page's own scrollers are told of an arrival before the routing
    // renders anything: a list arriving decides where it opens in its first
    // render (see scroll_restoration.js). The document itself is moved once
    // the page is there, below. A push that says it is a return keeps them
    // (see link_return.js).
    if (navigationType === "push" && !asReturn) {
      forgetScrollersOnArrival(url, { from: urlLeft });
    }
    // Every caller drops what the routing returns — the handler below waits on
    // allResult instead — so a failure travelling that way would be an
    // anonymous unhandled one, naming the navigation rather than what failed.
    // The call is inside, not only its result: a route action throwing
    // synchronously must not take the navigation down either. Same treatment,
    // same reason, as via_history.js.
    let allResult;
    runUnwatched(() => {
      const routingResult = applyRouting(url, {
        globalAbortSignal: globalAbortController.signal,
        reason,
        navigationType,
        isVisited,
        state,
      });
      allResult = routingResult.allResult;
      return routingResult.requestedResult;
    });
    // Same rule, same timing as via_history.js's own, and the same reading of
    // a replace: only the row that travels knows one of its own is an arrival.
    // A landing is the back's return, whatever the replace that writes it (see
    // navBack's `landOn`).
    if (
      navigationType === "push" &&
      asReturn &&
      hasScrollPositionToReturnTo(url, { from: urlLeft })
    ) {
      restoreScrollPositionOnReturn(url);
    } else if (navigationType === "push") {
      whenRenderingResumes(() => startAtTop(url, { from: urlLeft }));
      landOnUrlTarget(url, { from: urlLeft });
    } else if (navigationType === "traverse" || landing) {
      restoreScrollPositionOnReturn(url);
    } else if (navigationType === "replace") {
      stayInPlace(url);
    }
    return { allResult };
  };

  // A replace the browser's address is allowed to follow late (see
  // stateSignal's `debounceUrl`, and via_history.js for the rules: written
  // once the state has settled, with the last value; a push flushes it first,
  // a traversal drops it).
  //
  // Here a navigation IS the routing (the navigate event drives runRouting),
  // so the routing is run by hand at once, exactly as the intercept handler
  // would, and only the browser's write is deferred. That write is
  // history.replaceState, not navigation.navigate(): the Navigation API's
  // replace would come back as a navigate event asking to route what has
  // already been routed, and a document leaving (pagehide) can no longer
  // navigate at all while it can still write its entry. replaceState drops the
  // entry's Navigation API state, which is written back right after (see
  // writeAddressNow), and fires a navigate event of its own, which the
  // listener below recognizes by `addressWriteInProgress` and leaves alone.
  let pendingReplace = null;
  let pendingReplaceTimer = null;
  let addressWriteInProgress = false;
  const readAddress = () => {
    return pendingReplace ? pendingReplace.url : window.location.href;
  };
  const replaceAddressWhenSettled = (url, debounce) => {
    const urlLeft = readAddress();
    if (url === urlLeft) {
      return;
    }
    announceRouting({ url, navigationType: "replace" }, () => {
      runRouting(url, {
        reason: `navTo called with "${url}"`,
        navigationType: "replace",
        state: undefined,
        urlLeft,
        stateLeft: getDocumentState(),
      });
    });
    if (pendingReplaceTimer !== null) {
      clearTimeout(pendingReplaceTimer);
    }
    pendingReplace = { url };
    pendingReplaceTimer = setTimeout(flushPendingReplace, debounce);
  };
  const flushPendingReplace = () => {
    const pending = pendingReplace;
    dropPendingReplace();
    if (pending) {
      writeAddressNow(pending.url);
    }
  };
  const dropPendingReplace = () => {
    pendingReplace = null;
    if (pendingReplaceTimer !== null) {
      clearTimeout(pendingReplaceTimer);
      pendingReplaceTimer = null;
    }
  };
  const writeAddressNow = (url) => {
    // replaceState drops the entry's Navigation API state (Chrome, WebKit):
    // read before, written back after — the depth and what is open on the
    // page stay the entry's.
    const entryState = readEntryState();
    addressWriteInProgress = true;
    try {
      window.history.replaceState(window.history.state, null, url);
      if (entryState !== undefined) {
        writeEntryState(entryState);
      }
    } finally {
      addressWriteInProgress = false;
    }
  };
  // The document is leaving, or may be killed in the background: what the
  // entry says about it has to be what the document says.
  whenDocumentMayEnd(flushPendingReplace);

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

  // What the press on a link asks of the history entry, handed to the
  // navigation it starts (see via_history.js's carryByLinkNavigation), keyed by
  // the link: the navigate event names the element pressed, not the click. It
  // fires once the click has been dispatched and before any task, so a write
  // still here when the next task runs belongs to a press that started no
  // navigation in this document (a modifier asking for another tab, a
  // refusal), and is made where it would have been made.
  const linkPressWritesMap = new Map();
  const carryByLinkNavigation = (event, pressWrite) => {
    const clickEvent = findEvent(event, "click");
    if (!clickEvent || clickEvent.eventPhase === Event.NONE) {
      return false;
    }
    const linkElement = clickEvent.target.closest("a");
    if (!linkElement) {
      return false;
    }
    const pressWrites = linkPressWritesMap.get(linkElement);
    if (pressWrites) {
      pressWrites.push(pressWrite);
      return true;
    }
    linkPressWritesMap.set(linkElement, [pressWrite]);
    setTimeout(() => {
      writePressWritesHere(takeLinkPressWrites(linkElement));
    });
    return true;
  };
  const takeLinkPressWrites = (element) => {
    const pressWrites = linkPressWritesMap.get(element);
    linkPressWritesMap.delete(element);
    return pressWrites;
  };

  navigation.addEventListener("navigate", (event) => {
    if (!event.canIntercept) {
      // Another origin, or a cross-document traversal: the browser's business.
      return;
    }
    if (addressWriteInProgress) {
      // The browser being told an address the document is already at (see
      // replaceAddressWhenSettled): same document, already routed, nothing
      // to do.
      return;
    }
    if (isTargetWriteInProgress()) {
      // The fragment navigation navi makes to set `:target` (see
      // url_target.js). It keeps the address's fragment most of the time, and
      // the browser then does not call it a hashChange: intercepted, it would
      // route the page again.
      return;
    }
    if (pendingReplace) {
      // A debounced replace has not reached the browser yet and another
      // navigation is arriving. A push that can still be declined is
      // re-asked once the pending write is out, so the entry it stacks on
      // carries the address the document is at — the same decline-and-re-ask
      // a replace link gets below. Anything else (a traversal, a fragment, a
      // replace, a push the browser has decided) supersedes the entry or
      // leaves it: the pending write is dropped, and the entry keeps the last
      // address written.
      if (
        event.navigationType === "push" &&
        event.cancelable &&
        !event.hashChange
      ) {
        event.preventDefault();
        flushPendingReplace();
        navigate(event.destination.url, {
          history: "push",
          state: event.destination.getState(),
          info: {
            ...event.info,
            element: event.sourceElement || event.info?.element,
          },
        });
        return;
      }
      dropPendingReplace();
    }
    if (event.hashChange) {
      // A fragment belongs to the browser (`:target`, focus): answered once
      // the entry has committed (see answerFragmentNavigation).
      fragmentPending = {
        url: event.destination.url,
        navigationType: event.navigationType,
        state: readDestinationState(event),
        urlLeft: readAddress(),
        stateLeft: getDocumentState(),
      };
      return;
    }
    if (event.downloadRequest !== null) {
      // A download is not a navigation at all.
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
    if (!isUrlOfThisDocument(event.destination.url)) {
      // Outside the directory the document's addresses start in (see
      // setBaseUrl): another document of this origin, left to the browser.
      return;
    }
    if (event.sourceElement && linkAsksForDocument(event.sourceElement)) {
      // The pressed link says its address is another document of this origin
      // (see link_document.js). Declined so the browser loads the page;
      // intercepting would land on the fallback route instead.
      return;
    }
    if (!isRouting()) {
      // No routes declared: the page is a plain document and a link in it is
      // a plain link.
      return;
    }
    const url = event.destination.url;
    const navigationType = event.navigationType;
    if (event.hasUAVisualTransition) {
      // Shown moving by the browser already (see page_change.js).
      noteShownByBrowser();
    }

    // Before anything is announced or committed: where this url really leads.
    // A push can be declined and re-asked; a traversal the browser has already
    // decided cannot, so it is intercepted and left immediately — the entry is
    // written over on the way out.
    const redirectionUrl = resolveRouteRedirection(url);
    if (
      redirectionUrl &&
      redirectionUrl === readAddress() &&
      event.cancelable
    ) {
      // Asked to go where the document already is: an address that redirects
      // is never the one displayed, so there is nothing to go to and nothing
      // to stack — what the press wrote goes onto the entry it was made on.
      event.preventDefault();
      writePressWritesHere(
        takeLinkPressWrites(event.sourceElement || event.info?.element),
      );
      return;
    }
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

    // A link to a page with one of its popups open (see link_open.js):
    // declined and re-asked as the entries it is, the page's and the popup's.
    if (
      navigationType === "push" &&
      event.sourceElement &&
      linkAsksToOpen(event.sourceElement)
    ) {
      event.preventDefault();
      navToWithPopupOpen(
        url,
        {
          replace: linkAsksForReplace(event.sourceElement),
          info: { element: event.sourceElement },
        },
        linkAsksToOpen(event.sourceElement),
      );
      return;
    }

    // A link that takes the place of the current entry rather than stacking on
    // it (see link_replace.js), or one to the address the document is at,
    // which a page load would replace too: stacked, it would leave behind an
    // entry that a Back returns to without moving. The browser has already
    // decided this is a push and nothing can turn a live push into a replace,
    // so the navigation is declined and re-asked as one — carrying by hand
    // what such a call has no sourceElement to say: the element pressed, and
    // with it what that element asks of a route transition (it wears it as an
    // attribute).
    if (
      navigationType === "push" &&
      event.sourceElement &&
      (linkAsksForReplace(event.sourceElement) || url === readAddress())
    ) {
      event.preventDefault();
      navigate(url, {
        history: "replace",
        info: { element: event.sourceElement },
      });
      return;
    }

    // The element pressed, also for a press re-asked above (a replace link, a
    // push behind a pending replace), which carries it in `info`.
    const pressElement = event.sourceElement || event.info?.element;

    // A push to the entry next door is morally a traversal: taken as one, the
    // stack stays what the reader thinks it is and the page comes back where
    // they left it. Decided before anything commits — preventDefault is only
    // legal here because a same-document push is cancelable. A push with
    // something of its own for its entry — a state, what the press handed
    // over (see carryByLinkNavigation) — is a new entry. So is a push a signal
    // write makes: the writes after it in the same move build on its address
    // at once, and a traversal would only land after they went to the entry
    // being left.
    if (
      navigationType === "push" &&
      event.destination.getState() === undefined &&
      !linkPressWritesMap.has(pressElement) &&
      !event.info?.fromSignal &&
      url !== readAddress()
    ) {
      const key = adjacentEntryKey(url);
      if (key !== null) {
        event.preventDefault();
        // The press is still the press: what it asks of a route transition is
        // about this crossing, and the traversal's navigate event reads it
        // from `info` like any re-asked navigation's.
        const press = {
          element: pressElement,
          routeTransition: event.info ? event.info.routeTransition : undefined,
        };
        publishTraversalAsked(press);
        // The entry being left carries the address the document is at.
        flushPendingReplace();
        navigation.traverseTo(key, { info: press });
        return;
      }
    }

    // The url the reader is being taken away from, and what its entry holds,
    // read here because the commit — and with it the document url and the
    // entry the state is read from — happens before the handler runs.
    const urlLeft = readAddress();
    const stateLeft = getDocumentState();
    const pressWrites = takeLinkPressWrites(pressElement);
    const isSameUrl = url === urlLeft;
    const isLanding = Boolean(event.info && event.info.landOn);
    // A push or a replace onto the address already displayed (useNavState)
    // changes the entry's state and nothing the routes read: the state signals
    // move, the routes do not, and nobody is told — the announcements are for
    // whoever needs the page as it stands before a change (a hold on the
    // rendering, a picture for a transition), and there is no change to
    // picture here.
    const isStateOnly =
      isSameUrl &&
      !isLanding &&
      (navigationType === "push" || navigationType === "replace");
    // The traversal of a back asked to land elsewhere (navBack's `landOn`) is
    // only the pop: the replace that follows is the navigation, announced on
    // its own — once, as via_history.js announces it.
    const isLandingPop =
      navigationType === "traverse" && landOnPending !== null;
    const announced = !isStateOnly && !isLandingPop;
    if (announced) {
      // Before the commit writes anything: the last moment the page still
      // stands as it was, which is what the rendering hold (and the picture of
      // a transition) needs.
      publishBeforeRouting({
        url,
        navigationType,
        // The two things a navigation carries that the url does not: who
        // started it, and what it asks of a route transition (see
        // route_transition.jsx). Both are the same facts via_history.js
        // announces; here the browser hands them over — sourceElement for a
        // press, info for a navTo() call.
        element: pressElement,
        routeTransition: event.info ? event.info.routeTransition : undefined,
        // What the entry being reached holds — for a traversal, the crossing
        // that created it (see route_transition.jsx's readTraversalReplay).
        state: readDestinationState(event),
      });
    }
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
          const state = readDestinationState(event);
          const landOn = landOnPending;
          landOnPending = null;
          if (landOn && navigationType === "traverse") {
            // A back asked to land elsewhere than on the entry behind as it
            // was (see navBack's `landOn`): the traversal is only the pop, and
            // nothing is routed for it — the entry it landed on is taken over
            // by a replace, the one navigation the routes read.
            applyNavigationToNavDepth(navigationType, state);
            navigate(landOn.url, {
              history: "replace",
              state: landOn.state,
              info: { landOn: true },
            });
            return;
          }
          if (isStateOnly) {
            runStateOnly(navigationType, state, stateLeft, pressWrites);
            return;
          }
          const { allResult } = runRouting(url, {
            reason: `"navigate" event towards ${url}`,
            navigationType,
            state,
            urlLeft,
            stateLeft,
            landing: isLanding,
            pressWrites,
            // Said by the link pressed, or by the navTo() call in `info` (see
            // link_return.js).
            asReturn: Boolean(
              (pressElement && linkAsksForReturn(pressElement)) ||
              event.info?.asReturn,
            ),
          });
          // The handler's promise IS the navigation for the browser (its
          // loading UI follows it) — but a routing that fails is displayed by
          // the page, never thrown at the navigation: rejected here, the
          // browser would abort a navigation whose page is busy explaining
          // what went wrong.
          await Promise.resolve(allResult).catch(() => {});
        } finally {
          if (announced) {
            publishAfterRouting({ url, navigationType });
          }
        }
      },
    });
  });

  const runStateOnly = (navigationType, state, stateLeft, pressWrites) => {
    applyNavigationToNavDepth(navigationType, state);
    const effectiveState = applyPressWrites(
      resolveEffectiveDocumentState(state, {
        navigationType,
        // The address does not change: the page stays.
        isArrival: false,
        currentState: stateLeft,
        sharedState: {
          [NAV_DEPTH_STATE_KEY]: getNavDepth(),
        },
      }),
      pressWrites,
    );
    writeEntryState(effectiveState);
    updateDocumentState(effectiveState);
  };

  // A click on a link is answered on the link itself, after the link's own
  // listeners, as via_history.js answers it: a navi control decides there
  // whether the press is allowed (it refuses with preventDefault from its click
  // reaction), and a card around the link that cancels the click on its way
  // up does not take the navigation back — the browser alone would start no
  // navigation for a cancelled click. A link the routes answer is asked of the
  // browser by hand, the element pressed carried in `info`; anything else
  // (another document, another origin, a fragment, a press opening another
  // tab) is left to the browser and its navigate event.
  const onLinkClick = (e) => {
    if (e.defaultPrevented || pressOpensElsewhere(e)) {
      return;
    }
    const linkElement = e.currentTarget;
    if (
      linkElement.hasAttribute("data-readonly") ||
      linkOpensElsewhere(linkElement) ||
      linkAsksForDocument(linkElement) ||
      !isRouting()
    ) {
      return;
    }
    const href = readLinkHref(linkElement);
    const { isEmpty, isSameOrigin, isAnchor } = getHrefTargetInfo(href);
    if (isEmpty || !isSameOrigin || isAnchor || !isUrlOfThisDocument(href)) {
      return;
    }
    e.preventDefault();
    if (resolveRouteRedirection(href) === readAddress()) {
      // An address that redirects to the one displayed: nothing to go to and
      // nothing to stack, the press writes onto the entry it was made on.
      writePressWritesHere(takeLinkPressWrites(linkElement));
      return;
    }
    const info = { element: linkElement };
    const replace = linkAsksForReplace(linkElement);
    const open = linkAsksToOpen(linkElement);
    if (open) {
      navToWithPopupOpen(href, { replace, info }, open);
      return;
    }
    // One to the address the document is at replaces too, as the browser
    // answers it: stacked, it would leave behind an entry that a Back returns
    // to without moving.
    navigate(href, {
      history: replace || href === readAddress() ? "replace" : "push",
      info,
    });
  };
  // Wired on every click, before it reaches the link: a listener a link
  // already has is not added twice.
  window.addEventListener(
    "click",
    (e) => {
      const linkElement = findPressedLink(e);
      if (linkElement) {
        linkElement.addEventListener("click", onLinkClick);
      }
    },
    { capture: true },
  );

  // The one press the browser answers with a scroll and nothing else: same
  // pathname, same hash. No navigate event reaches anyone, so the element the
  // url designates has to be re-armed by hand — the same corner case
  // via_history.js keeps a click listener for.
  window.addEventListener(
    "click",
    (e) => {
      if (pressOpensElsewhere(e) || e.defaultPrevented) {
        return;
      }
      if (clickIsSuppressed(e)) {
        // The click that ends a gesture (click_suppression.js in @jsenv/dom).
        // Its suppressor also listens on window in capture, so whichever
        // module registered first runs first — asked explicitly, the order
        // stops mattering.
        return;
      }
      const linkElement = findPressedLink(e);
      if (!linkElement) {
        return;
      }
      const { isCurrent, isAnchor } = getHrefTargetInfo(
        readLinkHref(linkElement),
      );
      if (isAnchor && isCurrent) {
        rearmUrlTarget();
      }
    },
    { capture: true },
  );

  installScrollRestoration({ readAddress });

  const navTo = async (
    url,
    {
      replace,
      state,
      routeTransition,
      debounce,
      asReturn,
      open,
      fromSignal,
    } = {},
  ) => {
    if (replace && debounce && state === undefined) {
      replaceAddressWhenSettled(url, debounce);
      return;
    }
    if (!replace) {
      // The entry being stacked on must carry the address the document is at.
      flushPendingReplace();
    }
    // Not state: what is asked of a transition, whether a push is a return
    // (see link_return.js), and whether a signal write made it, are about the
    // navigation, not about the entry it leaves behind. `info` is exactly
    // that — handed to the navigate event and forgotten afterwards.
    const info =
      routeTransition === undefined && !asReturn && !fromSignal
        ? undefined
        : { routeTransition, asReturn, fromSignal };
    if (open) {
      await navToWithPopupOpen(url, { replace, state, info }, open);
      return;
    }
    navigate(url, {
      info,
      // undefined stays "inherit" through the event: navigate() stores no
      // state, destination.getState() answers undefined, and runRouting reads
      // that as a neutral navigation (see resolveEffectiveDocumentState).
      state,
      // "push" and never "auto": a push to the address displayed (useNavState
      // entering a popup) is a new entry, which "auto" would make a replace.
      history: replace ? "replace" : "push",
    });
  };
  // The page's entry, then the one the popup's opening writes over it (see
  // link_open.js). Stacked once the page's routing is over: a navigation
  // started meanwhile aborts the one in progress, routing included.
  const navToWithPopupOpen = async (url, { replace, state, info }, open) => {
    const { id, type } = resolveOpenOnArrival(open);
    const urlLeft = readAddress();
    // Already on the page: only the popup's opening is left to write.
    const onThePage = url === urlLeft;
    const pageState = readPageStateUnderPopup(url, {
      state,
      urlLeft,
      stateLeft: getDocumentState(),
    });
    if (type !== "push") {
      navigate(url, {
        info,
        state: { ...pageState, [id]: NAV_STATE_ENTERED_VALUE },
        history: replace || onThePage ? "replace" : "push",
      });
      return;
    }
    if (!onThePage) {
      const { finished } = navigate(url, {
        info,
        state: pageState,
        history: replace ? "replace" : "push",
      });
      await finished.catch(() => {});
    }
    // Where the page landed: a redirection may have taken it elsewhere.
    navigate(readAddress(), {
      info: onThePage ? info : undefined,
      state: { ...getDocumentState(), [id]: NAV_STATE_ENTERED_VALUE },
      // A push to the address displayed, which "auto" would turn into a
      // replace.
      history: "push",
    });
  };

  const stop = (reason = "stop called") => {
    triggerGlobalAbort(reason);
  };

  const reload = () => {
    const url = readAddress();
    announceRouting({ url, navigationType: "reload" }, () =>
      runRouting(url, {
        reason: "reload called",
        navigationType: "reload",
        state: getDocumentState(),
      }),
    );
  };

  // What the traversal a back asked for writes over the entry it lands on
  // (see navBack's `landOn`), read by the navigate handler of that traversal.
  let landOnPending = null;
  // The back navBack asked for, until its traversal committed or was
  // aborted. Meanwhile the document still reads the entry being left (see
  // whenBackLanded).
  let backInFlight = null;
  const whenBackLanded = (callback) => {
    if (backInFlight) {
      return backInFlight.then(callback);
    }
    return callback();
  };
  // A second back asked before the first one landed (two popups closed in the
  // same handler) waits for it: the landing has one slot, and its `landOn` was
  // read on the entry the first back leaves.
  const navBack = (options) => whenBackLanded(() => navBackNow(options));
  const navBackNow = ({ fallback, landOn } = {}) => {
    // canGoBack says there is an entry behind; what an app's back arrow
    // promises is that the entry behind is one of ITS screens (see
    // document_back_and_forward.js). navigation.back() throws with nowhere to
    // go, so the two are asked together.
    if (canNavBackSignal.peek() && navigation.canGoBack) {
      landOnPending = landOn || null;
      // The entry being left carries the address the document is at: a
      // forward back to it finds what was typed there.
      flushPendingReplace();
      const { committed } = navigation.back();
      // Committed: the traverse's own navigate event has been answered, so
      // the document url and state already say where it landed. An aborted
      // back (another navigation preempting it) lands nowhere — said with
      // `false`, so a caller waiting to write onto the landed entry knows
      // not to.
      const landedPromise = committed.then(
        () => {
          backInFlight = null;
          return true;
        },
        () => {
          backInFlight = null;
          return false;
        },
      );
      backInFlight = landedPromise;
      return landedPromise;
    }
    if (fallback === undefined) {
      return undefined;
    }
    // Replace, not push: pushing the fallback would put the screen just left
    // one press ahead, and the device's own back button would walk straight
    // back into it — a loop with no way out of the app.
    navTo(fallback, { replace: true });
    return undefined;
  };
  const navForward = () => {
    if (navigation.canGoForward) {
      flushPendingReplace();
      navigation.forward();
    }
  };

  const init = () => {
    const url = window.location.href;
    const stateOnEntry = getDocumentState();
    const state = stateWithNavDepthOnLoad(dropGeneratedIdKeys(stateOnEntry));
    if (state !== stateOnEntry) {
      // The entry itself has to carry it, not just the document state:
      // getDocumentState() reads the entry back, every state write copies what
      // it finds there onto the next one, and a back returning here reads its
      // depth from it.
      writeEntryState(state);
    }
    runRouting(url, {
      reason: "routing initialization",
      navigationType: "load",
      state,
    });
  };

  return {
    integration: "browser_navigation_api",
    init,
    navTo,
    stop,
    reload,
    navBack,
    whenBackLanded,
    isEntryBehind,
    navForward,
    getDocumentState,
    carryByLinkNavigation,
    isVisited,
    visitedUrlsSignal,
  };
};
