/**
 * How two routes move against each other, said one relation at a time —
 * without putting them in a row, and without a box in the tree.
 *
 * A page one goes INTO (a game, a profile, a place) is entered from wherever
 * one opened it, and left back out the same way. That is a fact about a PAIR
 * of pages, and only about the pairs it is written for:
 *
 *   defineRouteTransition({ from: MY_GAMES_PAGE, to: GAME_PAGE, type: "slide-x" });
 *   defineRouteTransition({ from: RADAR_PAGE, to: GAME_PAGE, type: "slide-x" });
 *
 * Going from `from` to `to` plays forward, the reverse plays back, and two
 * pages never written in the same relation play nothing between each other —
 * two tabs of a bottom bar are side by side, neither is before the other, and
 * being animated by the same mechanism does not order them. This is what tells
 * this apart from <RouteTravel>: a travel box is a ROW — a total order, plus a
 * drag gesture that walks it — while this declares individual relations and
 * nothing else.
 *
 * The relation says WHEN something plays and which way; `type` says WHAT plays
 * — a movement navi ships, or a name the application defines in its own CSS
 * (see the JSDoc below). Said without a type, the relation plays the browser's
 * cross-fade.
 *
 * There is no box: what animates is the document itself (its `root` view
 * transition group). Anything that must NOT move — a fixed bar, a header —
 * stays still by carrying a `view-transition-name` of its own: named, it is a
 * picture of its own, animated from where it was to where it is, which for a
 * bar that does not move is standing still.
 *
 * The URL leads and the picture follows, as everywhere in navi: the change is
 * a navigation somebody else started (a <Link>, the back button), this only
 * watches it land and photographs the page being left in time (see
 * rendering_hold.js for how the picture is kept honest). A browser without
 * view transitions navigates without the movement.
 *
 * However many relations are defined, there is ONE watcher: every definition
 * lands in a shared registry, and the watcher is rebuilt over the whole of it
 * — a navigation is a single fact about the document, and the first relation
 * that speaks about it answers for it.
 */

import { computed } from "@preact/signals";

import {
  observeAfterRouting,
  observeBeforeRouting,
} from "./browser_integration/before_routing.js";
import { observeRouteRender } from "./route.jsx";
import {
  holdRenderingForRouting,
  releaseRoutingRenderingHold,
  takeoverRoutingRenderingHold,
} from "./rendering_hold.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { ensureDocumentStartViewTransition } from "../transition/start_view_transition_polyfill.js";

const startViewTransition = ensureDocumentStartViewTransition();

const TRANSITION_ATTRIBUTE = "data-navi-route-transition";
const TRANSITION_TYPE_ATTRIBUTE = "data-navi-route-transition-type";

const css = /* css */ `
  /* Only while a transition of OURS is playing: everything below changes how
     the document animates, and the document belongs to the application the
     rest of the time. The duration is written here, on the direction alone, so
     a relation with no type — the browser's cross-fade — answers to
     --navi-route-transition-duration like every other. */
  :root[${TRANSITION_ATTRIBUTE}] {
    &::view-transition-old(root),
    &::view-transition-new(root) {
      animation-duration: var(--navi-route-transition-duration, 300ms);
    }
  }

  /* The movements navi ships. Anything else written as a type belongs to the
     application: the attributes are on the root either way, and its CSS picks
     them up exactly as these rules do. */
  :root[${TRANSITION_TYPE_ATTRIBUTE}="slide-x"],
  :root[${TRANSITION_TYPE_ATTRIBUTE}="slide-y"] {
    &::view-transition-old(root),
    &::view-transition-new(root) {
      /* The default cross-fade, dropped: two pages sliding past each other are
         two solid things, and seeing through one to the other says they are
         the same page changing its mind. */
      mix-blend-mode: normal;
      animation-timing-function: ease;
      animation-fill-mode: both;
    }
  }
  :root[${TRANSITION_TYPE_ATTRIBUTE}="slide-x"] {
    &[${TRANSITION_ATTRIBUTE}="forward"] {
      &::view-transition-old(root) {
        animation-name: navi-route-transition-leave-towards-start;
      }
      &::view-transition-new(root) {
        animation-name: navi-route-transition-enter-from-end;
      }
    }
    &[${TRANSITION_ATTRIBUTE}="back"] {
      &::view-transition-old(root) {
        animation-name: navi-route-transition-leave-towards-end;
      }
      &::view-transition-new(root) {
        animation-name: navi-route-transition-enter-from-start;
      }
    }
  }

  /* The same four movements, along the other axis: the start of a column is
     its top, so going forward there is the page rising and the next one coming
     up from below. */
  :root[${TRANSITION_TYPE_ATTRIBUTE}="slide-y"] {
    &[${TRANSITION_ATTRIBUTE}="forward"] {
      &::view-transition-old(root) {
        animation-name: navi-route-transition-leave-towards-top;
      }
      &::view-transition-new(root) {
        animation-name: navi-route-transition-enter-from-bottom;
      }
    }
    &[${TRANSITION_ATTRIBUTE}="back"] {
      &::view-transition-old(root) {
        animation-name: navi-route-transition-leave-towards-bottom;
      }
      &::view-transition-new(root) {
        animation-name: navi-route-transition-enter-from-top;
      }
    }
  }

  /* Going deeper is coming closer: the page arriving lands from slightly too
     big, and going back it is the page leaving that grows away. The other side
     keeps the browser's own fade under it. */
  :root[${TRANSITION_TYPE_ATTRIBUTE}="zoom"] {
    &::view-transition-old(root),
    &::view-transition-new(root) {
      animation-fill-mode: both;
    }
    &[${TRANSITION_ATTRIBUTE}="forward"] {
      &::view-transition-new(root) {
        animation-name: navi-route-transition-zoom-in;
      }
    }
    &[${TRANSITION_ATTRIBUTE}="back"] {
      &::view-transition-old(root) {
        animation-name: navi-route-transition-zoom-out;
      }
    }
  }

  @keyframes navi-route-transition-leave-towards-start {
    to {
      translate: -100% 0;
    }
  }
  @keyframes navi-route-transition-enter-from-end {
    from {
      translate: 100% 0;
    }
  }
  @keyframes navi-route-transition-leave-towards-end {
    to {
      translate: 100% 0;
    }
  }
  @keyframes navi-route-transition-enter-from-start {
    from {
      translate: -100% 0;
    }
  }
  @keyframes navi-route-transition-leave-towards-top {
    to {
      translate: 0 -100%;
    }
  }
  @keyframes navi-route-transition-enter-from-bottom {
    from {
      translate: 0 100%;
    }
  }
  @keyframes navi-route-transition-leave-towards-bottom {
    to {
      translate: 0 100%;
    }
  }
  @keyframes navi-route-transition-enter-from-top {
    from {
      translate: 0 -100%;
    }
  }
  @keyframes navi-route-transition-zoom-in {
    from {
      opacity: 0;
      scale: 1.1;
    }
  }
  @keyframes navi-route-transition-zoom-out {
    to {
      opacity: 0;
      scale: 1.1;
    }
  }
`;

/**
 * Declare how a pair of routes moves against each other.
 *
 * @param {Object} options
 * @param {object} options.from - a route, or `{ route, params }` when the page
 *   is a param of a route rather than a route of its own.
 * @param {object} options.to - same forms. Going from `from` to `to` plays
 *   forward, the reverse plays back, and a change between two pages no
 *   relation was defined for plays nothing.
 * @param {string} [options.type] - what plays. Omitted, the browser's own
 *   cross-fade. Shipped with navi: `"slide-x"` and `"slide-y"` (the pages
 *   slide past each other, forward towards the start of the axis) and
 *   `"zoom"` (the deeper page is the closer one). Any other name belongs to
 *   the application: for the length of the transition the root carries
 *   `data-navi-route-transition-type="<type>"` next to
 *   `data-navi-route-transition="forward"|"back"`, and the application's CSS
 *   defines the movement against the document's view transition
 *   pseudo-elements:
 *
 *     :root[data-navi-route-transition-type="spin"][data-navi-route-transition="forward"] {
 *       &::view-transition-new(root) {
 *         animation-name: my-spin-in;
 *       }
 *     }
 * @returns {() => void} remove this relation.
 */
export const defineRouteTransition = ({ from, to, type }) => {
  import.meta.css = css;
  const relation = {
    from: normalizePage(from),
    to: normalizePage(to),
    type,
  };
  relations.push(relation);
  rebuildWatcher();
  return () => {
    const index = relations.indexOf(relation);
    if (index > -1) {
      relations.splice(index, 1);
      rebuildWatcher();
    }
  };
};

// Every relation defined, and the single watcher standing over all of them.
const relations = [];
let watcher = null;
const rebuildWatcher = () => {
  if (watcher) {
    watcher.stop();
    watcher = null;
  }
  if (relations.length === 0) {
    return;
  }
  // Every page any relation mentions, each once: the position of the current
  // page in this list is what turns "some signal moved" into "the document
  // went from page A to page B".
  const pages = [];
  for (const { from, to } of relations) {
    if (pageIndexOf(pages, from) === -1) {
      pages.push(from);
    }
    if (pageIndexOf(pages, to) === -1) {
      pages.push(to);
    }
  }
  const currentIndexSignal = computed(() => currentPageIndex(pages));
  let currentIndex;
  let firstReading = true;
  const onMove = (index) => {
    const fromIndex = currentIndex;
    currentIndex = index;
    if (firstReading) {
      // Where the document already is — nothing changed, there is nothing to
      // animate. Also the first reading after a definition landed mid-life:
      // the watcher is standing again on whatever page is current.
      firstReading = false;
      return;
    }
    if (index === -1 || fromIndex === -1 || fromIndex === index) {
      return;
    }
    const found = findRelation(pages[fromIndex], pages[index]);
    if (!found) {
      // No relation says anything about these two: they are side by side, and
      // silence is the fact — not a missing case.
      return;
    }
    beginTransition({
      page: pages[index],
      direction: found.direction,
      type: found.type,
    });
  };
  // `subscribe` rather than `effect`: it hands the value to a callback that is
  // not being tracked, and starting a view transition releases holds that make
  // the very signals this is watched through move again.
  const unsubscribe = currentIndexSignal.subscribe(onMove);
  // The picture of the page being left has to be honest, so rendering is held
  // from before the navigation's first write (see rendering_hold.js) — and
  // given back right away when the change turns out to be one no relation
  // animates.
  const stopWatchingStart = observeBeforeRouting(holdRenderingForRouting);
  const stopWatchingEnd = observeAfterRouting(releaseRoutingRenderingHold);
  watcher = {
    stop: () => {
      unsubscribe();
      stopWatchingStart();
      stopWatchingEnd();
    },
  };
};

// The first relation that speaks about this pair answers for it.
const findRelation = (fromPage, toPage) => {
  for (const { from, to, type } of relations) {
    if (samePage(from, fromPage) && samePage(to, toPage)) {
      return { direction: "forward", type };
    }
    if (samePage(from, toPage) && samePage(to, fromPage)) {
      return { direction: "back", type };
    }
  }
  return null;
};

// The transition whose direction the document is currently wearing. One per
// document, as with view transitions themselves: a new one starting takes the
// attributes over, and only their owner may take them off.
let currentTransition = null;

const beginTransition = ({ page, direction, type }) => {
  const transition = {};
  currentTransition = transition;
  document.documentElement.setAttribute(TRANSITION_ATTRIBUTE, direction);
  if (type) {
    document.documentElement.setAttribute(TRANSITION_TYPE_ATTRIBUTE, type);
  }
  const releaseRendering = takeoverRoutingRenderingHold();
  // Armed from here rather than from inside the callback below: the browser
  // calls that callback a frame later, and a navigation that has already
  // been decided renders its page in between — a wait armed then waits for
  // something that has already happened.
  const renderWait = armRouteRenderWait();
  const viewTransition = startViewTransition(async () => {
    // The picture the browser is about to take must be of the page that was
    // asked for, and a route matching is not yet a page rendered. Whatever
    // is awaited here must be able to resolve without a frame: the document
    // is frozen for the whole of this callback.
    try {
      releaseRendering();
      if (pageIsCurrent(page)) {
        await renderWait.rendered;
      }
    } finally {
      renderWait.stop();
    }
  });
  const end = () => {
    // Whatever ends it — played out, skipped by another transition starting,
    // failed before its callback ever ran — the hold is given back and the
    // document is handed back to the application. Both are idempotent, and
    // the attributes belong to the LAST transition begun: an earlier one
    // ending late must not strip what a later one is wearing.
    renderWait.stop();
    releaseRendering();
    if (currentTransition === transition) {
      currentTransition = null;
      document.documentElement.removeAttribute(TRANSITION_ATTRIBUTE);
      document.documentElement.removeAttribute(TRANSITION_TYPE_ATTRIBUTE);
    }
  };
  viewTransition.finished.then(end, end);
};

// A route matching is a signal changing; how many passes Preact takes to
// answer it is its own business, and the render is the moment the picture can
// be taken. Listening starts before the change, or a render landing while the
// change settles is a render nobody heard.
const armRouteRenderWait = () => {
  let stopListening;
  const rendered = new Promise((resolve) => {
    stopListening = observeRouteRender(resolve);
  });
  return { rendered, stop: () => stopListening() };
};

const normalizePage = (page) =>
  page.isRoute ? { route: page, params: undefined } : page;

// Two pages are the same page when they select the same thing, not when they
// were written by the same hand.
const samePage = (a, b) => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.route === b.route && compareTwoJsValues(a.params, b.params);
};
const pageIndexOf = (pages, page) =>
  pages.findIndex((candidate) => samePage(candidate, page));

// Whether this page is the one on screen — same reading as route_travel.jsx's
// own: matchingSignal is the necessary condition and is read whatever happens,
// params only for a route that matches (the params of a route that does not
// match are not params).
const pageIsCurrent = ({ route, params }) => {
  if (!route.matchingSignal.value) {
    return false;
  }
  return params ? route.matchesParams(params) : true;
};
// The FIRST page that answers, and every page read all the same: a page that
// is not the current one today is the one that must wake the reader tomorrow.
const currentPageIndex = (pages) => {
  let currentIndex = -1;
  for (let i = 0; i < pages.length; i++) {
    const isCurrent = pageIsCurrent(pages[i]);
    if (isCurrent && currentIndex === -1) {
      currentIndex = i;
    }
  }
  return currentIndex;
};
