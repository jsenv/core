/**
 * How two routes move against each other, said one relation at a time —
 * without putting them in a row, and without a box in the tree.
 *
 * A page one goes INTO (a game, a profile, a place) is entered from wherever
 * one opened it, and left back out the same way. That is a fact about a PAIR
 * of pages, and only about the pairs it is written for:
 *
 *   defineRouteTransition(MY_GAMES_PAGE, GAME_PAGE, "slide-x");
 *   defineRouteTransition(RADAR_PAGE, GAME_PAGE, "slide-x");
 *
 * Going from the first page to the second plays forward, the reverse plays
 * back, and two pages never written in the same relation play nothing between
 * each other — two tabs of a bottom bar are side by side, neither is before
 * the other, and being animated by the same mechanism does not order them.
 * This is what tells this apart from <RouteTravel>: a travel box is a ROW — a
 * total order, plus a drag gesture that walks it — while this declares
 * individual relations and nothing else.
 *
 * A relation is reciprocal by DEFAULT, not by decree: the way back is the same
 * movement run the other way, because that is what lets a user build a map of
 * the app — but a relation written for the exact way travelled wins over being
 * the reverse of another, so B → A can be given a movement of its own, or
 * silenced with "none", by writing it (see findRelation).
 *
 * The relation says WHEN something plays and which way; the transition says
 * WHAT plays — a movement navi ships, or a name the application defines in its
 * own CSS (see the JSDoc below). Said without one, the relation plays the
 * browser's cross-fade.
 *
 * There is no box in the tree: by default what animates is the document itself
 * (its `root` view transition group), which is right for pages that ARE the
 * whole viewport. An application whose pages live between fixed bars marks the
 * region they live in with `data-navi-route-transition-area` — one attribute
 * on an element it already has — and the movement then plays on that region's
 * own pictures, clipped at its bounds, while the bars simply never move (see
 * TRANSITION_AREA_ATTRIBUTE for why the root pictures cannot do this job).
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
import { Box } from "../box/box.jsx";
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
const TRANSITION_DURATION_PROPERTY = "--navi-route-transition-duration";
// What the movement is played on. The root snapshot spans the viewport, and
// the regions of elements captured on their own (a named bar) are BLANK in it
// — a page sliding vertically then drags a blank band across the screen where
// the top bar was. An application with fixed bars therefore marks the region
// its pages live in with this attribute: the marked element is captured on its
// own, the movement plays on ITS pictures, clipped at its bounds, and the bars
// simply never move. Without the mark the document itself travels, which is
// right for a page that IS the whole viewport.
const TRANSITION_AREA_ATTRIBUTE = "data-navi-route-transition-area";
const TRANSITION_TARGET_ATTRIBUTE = "data-navi-route-transition-target";
const AREA_NAME = "navi-route-transition";
// route_travel.jsx wears this on the root for the length of one of its
// travels (its TRAVEL_ATTRIBUTE — a comment there mirrors this one). Read by
// name rather than imported: importing route_travel.jsx would pull the whole
// travel machinery into an application that only defines transitions.
const ROUTE_TRAVEL_ATTRIBUTE = "data-navi-route-travel";

// The same movements, written once and played on either target: the document,
// or the marked area. The guard keeps the two exclusive — with an area marked,
// the root pictures must NOT move (they carry the whole viewport, blank bands
// included).
const movementsCSS = (name, guard) => /* css */ `
  :root${guard} {
    &[${TRANSITION_TYPE_ATTRIBUTE}="slide-x"],
    &[${TRANSITION_TYPE_ATTRIBUTE}="slide-y"],
    &[${TRANSITION_TYPE_ATTRIBUTE}="cover-x"],
    &[${TRANSITION_TYPE_ATTRIBUTE}="cover-y"] {
      &::view-transition-old(${name}),
      &::view-transition-new(${name}) {
        /* The default cross-fade, dropped: two pages sliding past each other
           are two solid things, and seeing through one to the other says they
           are the same page changing its mind. */
        mix-blend-mode: normal;
        animation-timing-function: ease;
        animation-fill-mode: both;
      }
    }
    &[${TRANSITION_TYPE_ATTRIBUTE}="slide-x"] {
      &[${TRANSITION_ATTRIBUTE}="forward"] {
        &::view-transition-old(${name}) {
          animation-name: navi-route-transition-leave-towards-start;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-enter-from-end;
        }
      }
      &[${TRANSITION_ATTRIBUTE}="back"] {
        &::view-transition-old(${name}) {
          animation-name: navi-route-transition-leave-towards-end;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-enter-from-start;
        }
      }
    }
    /* The same four movements, along the other axis: the start of a column is
       its top, so going forward there is the page rising and the next one
       coming up from below. */
    &[${TRANSITION_TYPE_ATTRIBUTE}="slide-y"] {
      &[${TRANSITION_ATTRIBUTE}="forward"] {
        &::view-transition-old(${name}) {
          animation-name: navi-route-transition-leave-towards-top;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-enter-from-bottom;
        }
      }
      &[${TRANSITION_ATTRIBUTE}="back"] {
        &::view-transition-old(${name}) {
          animation-name: navi-route-transition-leave-towards-bottom;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-enter-from-top;
        }
      }
    }
    /* One page over the other, the way a sheet covers a desk: the page
       arriving slides in ON TOP of one that does not move, and going back it
       slides off, uncovering it. The still page is animated all the same — to
       a keyframe that goes nowhere — because left to the browser it would
       fade. */
    &[${TRANSITION_TYPE_ATTRIBUTE}="cover-x"] {
      &[${TRANSITION_ATTRIBUTE}="forward"] {
        &::view-transition-old(${name}) {
          animation-name: navi-route-transition-still;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-enter-from-end;
        }
      }
      &[${TRANSITION_ATTRIBUTE}="back"] {
        &::view-transition-old(${name}) {
          /* The page leaving is the cover: it must slide off ABOVE the one it
             uncovers, against the browser's default of drawing the new page
             on top. */
          z-index: 1;
          animation-name: navi-route-transition-leave-towards-end;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-still;
        }
      }
    }
    &[${TRANSITION_TYPE_ATTRIBUTE}="cover-y"] {
      &[${TRANSITION_ATTRIBUTE}="forward"] {
        &::view-transition-old(${name}) {
          animation-name: navi-route-transition-still;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-enter-from-bottom;
        }
      }
      &[${TRANSITION_ATTRIBUTE}="back"] {
        &::view-transition-old(${name}) {
          z-index: 1;
          animation-name: navi-route-transition-leave-towards-bottom;
        }
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-still;
        }
      }
    }
    /* Going deeper is coming closer: the page arriving lands from slightly too
       big, and going back it is the page leaving that grows away. The other
       side keeps the browser's own fade under it. */
    &[${TRANSITION_TYPE_ATTRIBUTE}="zoom"] {
      &::view-transition-old(${name}),
      &::view-transition-new(${name}) {
        animation-fill-mode: both;
      }
      &[${TRANSITION_ATTRIBUTE}="forward"] {
        &::view-transition-new(${name}) {
          animation-name: navi-route-transition-zoom-in;
        }
      }
      &[${TRANSITION_ATTRIBUTE}="back"] {
        &::view-transition-old(${name}) {
          animation-name: navi-route-transition-zoom-out;
        }
      }
    }
  }
`;

const css = /* css */ `
  /* The marked region is a picture of its own during every view transition of
     the document — which is what keeps it out of the root snapshot, where its
     place would be blank. */
  [${TRANSITION_AREA_ATTRIBUTE}] {
    view-transition-name: ${AREA_NAME};
  }

  /* Only while a transition of OURS is playing: everything below changes how
     the document animates, and the document belongs to the application the
     rest of the time. The duration is written here, on the direction alone, so
     a relation with no type — the browser's cross-fade — answers to
     --navi-route-transition-duration like every other. */
  :root[${TRANSITION_ATTRIBUTE}] {
    &::view-transition-old(root),
    &::view-transition-new(root),
    &::view-transition-old(${AREA_NAME}),
    &::view-transition-new(${AREA_NAME}) {
      animation-duration: var(${TRANSITION_DURATION_PROPERTY}, 300ms);
    }

    /* The pages are cut at the edge of the area they move in: its pictures are
       drawn in the top layer, above the bars, and a page sliding in would
       otherwise be seen crossing them. */
    &::view-transition-group(${AREA_NAME}),
    &::view-transition-image-pair(${AREA_NAME}) {
      overflow: clip;
    }
  }

  ${movementsCSS("root", `:not([${TRANSITION_TARGET_ATTRIBUTE}])`)}
  ${movementsCSS(AREA_NAME, `[${TRANSITION_TARGET_ATTRIBUTE}="area"]`)}

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
  /* Standing still, said as an animation: naming it replaces the browser's own
     fade on that side, which is the whole point. */
  @keyframes navi-route-transition-still {
    to {
      translate: 0 0;
    }
  }
`;

/**
 * The region the pages live in — where the movements play.
 *
 * Wrap the `<Route>` tree with it in an application that has fixed furniture
 * (a top bar, a tab bar): the movements then play on THIS element's pictures,
 * clipped at its bounds, and the bars never move. Without it the document
 * itself travels, which is right only when the pages are the whole viewport —
 * with bars around, the moving root picture drags a blank band across the
 * screen where they stand.
 *
 * It is a real box, and it must be: what is photographed and clipped IS its
 * rectangle. So `display: contents` cannot be used on it — an element with no
 * box is never captured, the movement plays on nothing and the browser aborts
 * the transition. Give it the layout the pages need instead — it is a `Box`,
 * so `flex`, `className`, `style` and the rest are there for that. An
 * application that already has an element holding its pages can mark that one
 * with `data-navi-route-transition-area` rather than nesting another.
 *
 * @type {import("preact").FunctionComponent<{ children?: any, [key: string]: any }>}
 */
export const RouteTransitionArea = ({ children, ...rest }) => {
  import.meta.css = css;
  const props = { ...rest, [TRANSITION_AREA_ATTRIBUTE]: "" };
  return <Box {...props}>{children}</Box>;
};

/**
 * Declare how a pair of routes moves against each other.
 *
 * @param {object} from - a route, or `{ route, params }` when the page is a
 *   param of a route rather than a route of its own.
 * @param {object} to - same forms. Going from `from` to `to` plays forward,
 *   the reverse plays back — unless the reverse is written as a relation of
 *   its own, which then owns that way (a movement of its own, or `"none"` for
 *   a plain cut). A change between two pages no relation was written for plays
 *   nothing.
 * @param {string|{type?: string, duration?: number|string}} [transition] -
 *   what plays: a type name, or `{ type, duration }` to also say how long
 *   (`--navi-route-transition-duration` says it for everyone otherwise).
 *   Omitted, the browser's own cross-fade. Shipped with navi:
 *   - `"slide-x"`, `"slide-y"`: the two pages slide past each other, forward
 *     towards the start of the axis;
 *   - `"cover-x"`, `"cover-y"`: the page arriving slides in OVER one that does
 *     not move, and slides off it on the way back;
 *   - `"zoom"`: the deeper page is the closer one — it lands from slightly too
 *     big, and grows away when left;
 *   - `"none"`: nothing, said out loud — written on one way of a pair, it cuts
 *     where the reverse of the other way (or the default) would have played;
 *   - `"cross-fade"`: the omitted case, nameable — so one way of a pair can
 *     fade while the other way moves.
 *   Every type plays on the document, or on the element marked
 *   `data-navi-route-transition-area` when the application has one (see the
 *   top of this file). Any other name belongs to the application: for the
 *   length of the transition the root carries
 *   `data-navi-route-transition-type="<type>"` next to
 *   `data-navi-route-transition="forward"|"back"`, and the application's CSS
 *   defines the movement against the view transition pseudo-elements:
 *
 *     :root[data-navi-route-transition-type="spin"][data-navi-route-transition="forward"] {
 *       &::view-transition-new(root) {
 *         animation-name: my-spin-in;
 *       }
 *     }
 * @returns {() => void} remove this relation.
 */
export const defineRouteTransition = (from, to, transition) => {
  import.meta.css = css;
  const { type, duration } = normalizeTransition(transition);
  const relation = {
    from: normalizePage(from),
    to: normalizePage(to),
    type,
    duration,
  };
  relations.push(relation);
  rebuildWatcher();
  updateRoutingObservers();
  return () => {
    const index = relations.indexOf(relation);
    if (index > -1) {
      relations.splice(index, 1);
      rebuildWatcher();
      updateRoutingObservers();
    }
  };
};

/**
 * What plays on a navigation no relation was written for: every route change
 * then plays this transition, and the written relations keep their own.
 *
 * A default has no direction — nothing says which of two arbitrary pages is
 * "before" the other — so give it a movement that does not need one:
 * `"cross-fade"`, or a custom type whose CSS is keyed on the type alone.
 *
 * @param {string|{type?: string, duration?: number|string}} transition - same
 *   forms as defineRouteTransition's. `"none"` (or removing the default) puts
 *   the silence back.
 * @returns {() => void} remove this default.
 */
export const defineRouteDefaultTransition = (transition) => {
  import.meta.css = css;
  const value = normalizeTransition(transition);
  defaultTransition = value;
  updateRoutingObservers();
  return () => {
    if (defaultTransition === value) {
      defaultTransition = null;
      updateRoutingObservers();
    }
  };
};

// "cross-fade" is a name for what plays when nothing is asked for — the
// browser's own animation — so it normalizes to asking for nothing. Having the
// name lets one way of a pair say it out loud while the other way slides.
const normalizeTransition = (transition) => {
  const { type, duration } =
    typeof transition === "string" ? { type: transition } : transition || {};
  return { type: type === "cross-fade" ? undefined : type, duration };
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
    const { direction, relation } = found;
    if (relation.type === "none") {
      // Silence said out loud: this way of the pair was written to play
      // nothing, where the reverse of the other way — or the default — would
      // have played.
      navigationAnimated = true;
      return;
    }
    beginTransition({
      page: pages[index],
      direction,
      type: relation.type,
      duration: relation.duration,
    });
  };
  // `subscribe` rather than `effect`: it hands the value to a callback that is
  // not being tracked, and starting a view transition releases holds that make
  // the very signals this is watched through move again.
  const unsubscribe = currentIndexSignal.subscribe(onMove);
  watcher = { stop: unsubscribe };
};

// What plays when no relation matched (see defineRouteDefaultTransition), and
// whether the navigation now landing found an answer already — a relation's
// transition, a "none", a RouteTravel travel. The flag is reset when a
// navigation begins, so it is always about the latest one.
let defaultTransition = null;
let navigationAnimated = false;

// The two ends of a navigation, watched while there is anyone to animate it.
// The picture of the page being left has to be honest, so rendering is held
// from before the navigation's first write (see rendering_hold.js) — and given
// back at the far end when the change turns out to be one nobody animates,
// which is also the one moment the DEFAULT can decide: every relation has had
// its say by then.
let stopRoutingObservers = null;
const updateRoutingObservers = () => {
  const wanted = relations.length > 0 || defaultTransition !== null;
  if (wanted && !stopRoutingObservers) {
    const stopWatchingStart = observeBeforeRouting(() => {
      navigationAnimated = false;
      holdRenderingForRouting();
    });
    const stopWatchingEnd = observeAfterRouting(() => {
      if (
        defaultTransition &&
        defaultTransition.type !== "none" &&
        !navigationAnimated
      ) {
        beginTransition({
          page: null,
          // A default has no direction: nothing says which of two arbitrary
          // pages is before the other. The attribute is worn empty — present
          // for whoever keys on "one of ours is playing", silent on the way.
          direction: "",
          type: defaultTransition.type,
          duration: defaultTransition.duration,
        });
      }
      releaseRoutingRenderingHold();
    });
    stopRoutingObservers = () => {
      stopWatchingStart();
      stopWatchingEnd();
    };
    return;
  }
  if (!wanted && stopRoutingObservers) {
    stopRoutingObservers();
    stopRoutingObservers = null;
  }
};

// The exact way travelled first, over the whole registry, and only then the
// reverses: a relation written B → A owns that way, and being the reverse of
// one written A → B never outranks it. This is what makes reciprocity a
// default rather than a decree — write the way back to give it a movement of
// its own, or "none" to silence it.
const findRelation = (fromPage, toPage) => {
  for (const relation of relations) {
    if (samePage(relation.from, fromPage) && samePage(relation.to, toPage)) {
      return { direction: "forward", relation };
    }
  }
  for (const relation of relations) {
    if (samePage(relation.from, toPage) && samePage(relation.to, fromPage)) {
      return { direction: "back", relation };
    }
  }
  return null;
};

// The transition whose direction the document is currently wearing. One per
// document, as with view transitions themselves: a new one starting takes the
// attributes over, and only their owner may take them off.
let currentTransition = null;

const beginTransition = ({ page, direction, type, duration }) => {
  navigationAnimated = true;
  const documentElement = document.documentElement;
  // One navigation, one animator. A RouteTravel box already travelling this
  // change owns the document's transition — and possibly a finger; starting
  // one here on top would skip its pictures mid-slide. A pair of routes must
  // be animated by RouteTravel or by a route transition, never both.
  if (documentElement.hasAttribute(ROUTE_TRAVEL_ATTRIBUTE)) {
    console.warn(
      "A RouteTravel is animating this navigation; the route transition defined between these routes is skipped. Animate a pair of routes with RouteTravel or defineRouteTransition, not both.",
    );
    return;
  }
  const transition = {};
  currentTransition = transition;
  documentElement.setAttribute(TRANSITION_ATTRIBUTE, direction);
  if (type) {
    documentElement.setAttribute(TRANSITION_TYPE_ATTRIBUTE, type);
  }
  // Looked up per transition, not once: the area is the application's own
  // element and follows its lifecycle — a page layout without bars has none,
  // and the movement then plays on the document itself.
  const areaElements = document.querySelectorAll(
    `[${TRANSITION_AREA_ATTRIBUTE}]`,
  );
  if (areaElements.length > 1) {
    warnOnce(
      "several-areas",
      `${areaElements.length} elements carry ${TRANSITION_AREA_ATTRIBUTE}. They all take the same view-transition-name, and a name belongs to one element at a time: the browser refuses EVERY view transition of the document while this holds. Mark the one element the pages live in.`,
    );
  }
  if (areaElements.length > 0) {
    documentElement.setAttribute(TRANSITION_TARGET_ATTRIBUTE, "area");
  }
  // A duration of this relation's own, worn for the length of the transition —
  // and whatever the application had written inline put back afterwards, not
  // erased.
  let restoreDuration = null;
  if (duration !== undefined) {
    const durationBefore = documentElement.style.getPropertyValue(
      TRANSITION_DURATION_PROPERTY,
    );
    documentElement.style.setProperty(
      TRANSITION_DURATION_PROPERTY,
      typeof duration === "number" ? `${duration}ms` : duration,
    );
    restoreDuration = () => {
      if (durationBefore) {
        documentElement.style.setProperty(
          TRANSITION_DURATION_PROPERTY,
          durationBefore,
        );
      } else {
        documentElement.style.removeProperty(TRANSITION_DURATION_PROPERTY);
      }
    };
  }
  const releaseRendering = takeoverRoutingRenderingHold();
  // Armed from here rather than from inside the callback below: the browser
  // calls that callback a frame later, and a navigation that has already
  // been decided renders its page in between — a wait armed then waits for
  // something that has already happened.
  const renderWait = armRouteRenderWait();
  // What the browser ACTUALLY captured, read once the pictures exist: it is
  // the only place the two silent misconfigurations show. Both are about the
  // same thing — a movement playing on pictures that are not the pages.
  const viewTransitionReady = () => {
    const capturedNames = capturedViewTransitionNames();
    if (areaElements.length > 0) {
      if (!capturedNames.has(AREA_NAME)) {
        warnOnce(
          "area-not-captured",
          `The element marked ${TRANSITION_AREA_ATTRIBUTE} was not captured, so the movement plays on nothing. An element is captured only if it generates a box: \`display: contents\` (or an element not rendered) cannot be the area — its rectangle is what gets photographed and clipped.`,
        );
      }
      return;
    }
    for (const name of capturedNames) {
      if (name === "root") {
        continue;
      }
      // Something stands still while the whole document travels under it. The
      // root picture spans the viewport and has a HOLE where that thing was
      // captured, so what crosses the screen is a blank band.
      warnOnce(
        "pages-travel-under-named-elements",
        `The movement plays on the whole document while "${name}" is captured on its own, so a blank band travels where it stands. Wrap the pages in <RouteTransitionArea> (or mark their element with ${TRANSITION_AREA_ATTRIBUTE}) so the movement plays on them rather than on the document.`,
      );
      break;
    }
  };
  const viewTransition = startViewTransition(async () => {
    // The picture the browser is about to take must be of the page that was
    // asked for, and a route matching is not yet a page rendered. Whatever
    // is awaited here must be able to resolve without a frame: the document
    // is frozen for the whole of this callback.
    try {
      // Releasing flushes the held render synchronously, so a route that
      // rendered has already resolved the wait by the next line.
      releaseRendering();
      if (page === null) {
        // A default transition: which page is arriving is unknown, and some
        // navigations render no route at all (a search param bound to a
        // signal) — waited on, those would freeze the page until the browser
        // gives up. The wait is raced with a short timer instead.
        await Promise.race([renderWait.rendered, waitMs(50)]);
      } else if (pageIsCurrent(page)) {
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
      documentElement.removeAttribute(TRANSITION_ATTRIBUTE);
      documentElement.removeAttribute(TRANSITION_TYPE_ATTRIBUTE);
      documentElement.removeAttribute(TRANSITION_TARGET_ATTRIBUTE);
      if (restoreDuration) {
        restoreDuration();
      }
    }
  };
  viewTransition.ready.then(viewTransitionReady, ignoreSkipped);
  viewTransition.finished.then(end, end);
};

// A transition skipped by another one starting is an outcome, not a failure.
const ignoreSkipped = () => {};

// The names the browser captured, read off the pictures themselves: what was
// asked for in CSS and what was taken are not the same question (see
// viewTransitionReady).
const capturedViewTransitionNames = () => {
  const names = new Set();
  for (const animation of document.getAnimations()) {
    const pseudoElement = animation.effect?.pseudoElement;
    if (!pseudoElement || !pseudoElement.startsWith("::view-transition")) {
      continue;
    }
    const nameStart = pseudoElement.indexOf("(");
    if (nameStart === -1) {
      continue;
    }
    names.add(pseudoElement.slice(nameStart + 1, -1));
  }
  return names;
};

// Said once per kind, whatever the number of navigations: a misconfiguration
// is one fact about the application, and repeating it every time the user
// moves would bury it.
const warningsSaid = new Set();
const warnOnce = (id, message) => {
  if (warningsSaid.has(id)) {
    return;
  }
  warningsSaid.add(id);
  console.warn(message);
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

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
