/**
 * Dragging from one route to the next, when the tabs of a page are URLs.
 *
 * A swipe shows two pages at once, and the router shows one: it mounts the
 * branch that matches the URL and nothing else, which is what makes a page
 * shareable, reloadable and findable in the history. Both are right, so the
 * second picture is not taken from the DOM — it is taken from the SCREEN. The
 * browser's view transitions keep a picture of the page being left, and this
 * hands that picture to the finger:
 *
 *   the first pixel of drag       the URL changes (replaced, not pushed) and
 *                                 the browser freezes the page being left
 *   while the finger moves        the two pictures are dragged, the old one a
 *                                 still, the new one live under it
 *   let go                        the movement plays out to the end…
 *   let go too early              …or backwards, and the URL is put back
 *
 * So the URL leads and the picture follows, which is the opposite of what one
 * would write by hand and the only order the router allows: nothing is ever
 * mounted that does not match. The page being pulled in is therefore mounting
 * WHILE it is being dragged in — it arrives as its own loading state and fills
 * in under the finger, which is honest about what is happening (it is being
 * fetched) and is the only thing that can happen without a second router.
 *
 * What travels is decided at the first pixel, like the axis: one gesture brings
 * in ONE neighbour, and turning the hand around mid-drag puts the current page
 * back rather than fetching the other side.
 *
 * Anything else that must follow the gesture — the trait under a tab bar, a
 * header — follows by being NAMED, not by being told: give it a
 * `view-transition-name` of its own and the browser animates it from where it
 * was to where it is, on the same clock as the pages. That is why the tab row
 * can stay where it is, outside this box, and still move with the finger.
 */

import { useLayoutEffect, useMemo, useRef } from "preact/hooks";

import { startDragTravel, scrollRoomTowards } from "../layout/drag_travel.js";
import { collectRoutes } from "./route.jsx";
import { ensureDocumentStartViewTransition } from "../transition/start_view_transition_polyfill.js";

// A browser with no view transitions of its own has no picture of the page
// being left, so there is nothing to drag: the gesture is still read (it is how
// one asks to change tab with a thumb), and the change happens on release, as a
// press on the tab would have done.
const CAN_KEEP_PICTURE = Boolean(
  document.startViewTransition && !document.startViewTransition.isPolyfill,
);
const startViewTransition = ensureDocumentStartViewTransition();

const TRAVEL_ATTRIBUTE = "data-navi-route-travel";
// While a finger holds the travel: the pictures stand still and go exactly
// where it says (see the CSS, and scrubTravel).
const HOLD_ATTRIBUTE = "data-navi-route-travel-held";
// A travel a finger set off, for its whole life — including what plays out
// after the finger is gone. It moves by another law than one asked for by a
// press (see the CSS).
const DRAGGED_ATTRIBUTE = "data-navi-route-travel-dragged";

const css = /* css */ `
  .navi_route_travel {
    position: relative;
    /* Named, so the page inside this box is a picture of its own during a
       transition rather than part of the one big picture the document takes:
       the two pages can then move past each other while everything else stays
       where it is. */
    view-transition-name: navi-route-travel;
    /* The gesture takes the axis the pages travel on and leaves the other one
       to the page, so a list still scrolls under the same finger. */
    touch-action: pan-y;
  }
  .navi_route_travel[data-axis="y"] {
    touch-action: pan-x;
  }

  /* Only while a travel of OURS is playing: everything below changes how the
     document animates, and the document belongs to the application the rest of
     the time. */
  :root[${TRAVEL_ATTRIBUTE}] {
    /* The rest of the page is taken as a picture too, said here rather than
       relied upon: an application that animates its own lists has good reason
       to opt the document out (view-transition-name: none), and under that
       rule the page would keep rendering LIVE under the two pictures being
       dragged — the page arriving would show through beside itself. Written
       while the attribute is on, so the application gets its own rule back the
       moment the travel is over. */
    view-transition-name: root;

    /* What is not the pages — a top bar, a tab row — is one still picture that
       must not fade: it is the same thing before and after, and a cross-fade of
       something onto itself is a flicker. */
    &::view-transition-old(root),
    &::view-transition-new(root) {
      mix-blend-mode: normal;
      animation: none;
    }
    &::view-transition-old(navi-route-travel),
    &::view-transition-new(navi-route-travel) {
      height: 100%;
      /* The default cross-fade, dropped: two pages sliding past each other are
         two solid things, and seeing through one to the other says they are the
         same page changing its mind. */
      mix-blend-mode: normal;
    }
    /* The pages are cut at the edge of the box they travel in. Said HERE and
       nowhere else: these pictures are drawn in the top layer, so no overflow
       on any element of the document — not the box's own, not a frame around
       it — can reach them. Without it a page being pulled in is seen sliding
       across whatever sits beside the box. */
    &::view-transition-group(navi-route-travel),
    &::view-transition-image-pair(navi-route-travel) {
      overflow: clip;
    }
    &::view-transition-group(navi-route-travel) {
      animation-duration: var(--navi-route-travel-duration, 300ms);
    }
  }

  /* Held by a finger: nothing moves on its own, and where the pictures stand is
     set by hand (scrubTravel). In CSS rather than paused in JS because JS
     cannot pause what does not exist yet: a transition is ready several frames
     after it is asked for — a navigation and a render later — and those frames
     are the beginning of the gesture. Played at their own pace, a quick swipe
     would be over before it was ever taken in hand, which is exactly what one
     sees: the page arriving lands at once instead of following the thumb. */
  :root[${HOLD_ATTRIBUTE}] {
    &::view-transition-group(*),
    &::view-transition-old(*),
    &::view-transition-new(*) {
      animation-play-state: paused;
    }
  }

  /* Longhands, never the \`animation\` shorthand: the shorthand also writes
     animation-play-state, so it would set these back to running and undo the
     hold above — a finger would then watch the pages travel on their own. */
  :root[${TRAVEL_ATTRIBUTE}] {
    &::view-transition-old(navi-route-travel),
    &::view-transition-new(navi-route-travel) {
      animation-duration: var(--navi-route-travel-duration, 300ms);
      animation-timing-function: ease;
      animation-fill-mode: both;
    }
  }

  /* Under a finger, the pace IS the finger: an eased travel would run ahead of
     it in the middle of the gesture and lag behind it at the ends, and what one
     feels then is the page leaving on its own rather than being pushed. The
     curve of the movement is the hand's, and it is already in the pull. Kept
     linear once it is let go of too: changing the curve of an animation that is
     halfway through moves the picture without anything having moved. */
  :root[${DRAGGED_ATTRIBUTE}] {
    &::view-transition-group(navi-route-travel),
    &::view-transition-old(navi-route-travel),
    &::view-transition-new(navi-route-travel) {
      animation-timing-function: linear;
    }
  }
  :root[${TRAVEL_ATTRIBUTE}="forward"] {
    &::view-transition-old(navi-route-travel) {
      animation-name: navi-route-travel-leave-towards-start;
    }
    &::view-transition-new(navi-route-travel) {
      animation-name: navi-route-travel-enter-from-end;
    }
  }
  :root[${TRAVEL_ATTRIBUTE}="back"] {
    &::view-transition-old(navi-route-travel) {
      animation-name: navi-route-travel-leave-towards-end;
    }
    &::view-transition-new(navi-route-travel) {
      animation-name: navi-route-travel-enter-from-start;
    }
  }

  @keyframes navi-route-travel-leave-towards-start {
    from {
      translate: 0 0;
    }
    to {
      translate: -100% 0;
    }
  }
  @keyframes navi-route-travel-enter-from-end {
    from {
      translate: 100% 0;
    }
    to {
      translate: 0 0;
    }
  }
  @keyframes navi-route-travel-leave-towards-end {
    from {
      translate: 0 0;
    }
    to {
      translate: 100% 0;
    }
  }
  @keyframes navi-route-travel-enter-from-start {
    from {
      translate: -100% 0;
    }
    to {
      translate: 0 0;
    }
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   routes?: Array<object>,
 *   axis?: "x"|"y",
 *   travelByDrag?: boolean,
 *   onTravel?: (detail: {route: object, cause: string}) => void|Promise<void>,
 * }>}
 * @param {Array<object>} [props.routes] - the tabs, in the order they are shown.
 *   Read from the <Route> children by default, in the order they are written:
 *   the router already holds that list, and asking a caller to write it twice is
 *   asking for the two to disagree. Pass it to say another order, or when the
 *   pages are not children of this box.
 * @param {"x"|"y"} [props.axis="x"] - which way the pages are laid out.
 * @param {boolean} [props.travelByDrag=true] - whether a pointer dragging the
 *   page travels. Off where the gesture belongs to the content.
 * @param {(detail: {route: object, cause: "drag"|"revert"}) => void|Promise<void>} [props.onTravel]
 *   - how to go to a route. The default REPLACES the current history entry
 *   rather than pushing one: a swipe is how one browses a page, not a place one
 *   aimed at, and three swipes back and forth must not bury the way out of the
 *   page under six entries. A tab pressed is the other case and pushes, which
 *   is what its <Link> already does.
 */
export const RouteTravel = ({
  routes: routesProp,
  axis = "x",
  travelByDrag = true,
  onTravel = ({ route }) => route.redirectTo(),
  className,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const elementRef = useRef();
  const gestureRef = useRef(null);
  // The travel in hand: the transition keeping the picture of the page being
  // left, the animations the finger drives, and what to do with them once the
  // browser has them ready. Null when no page is on its way anywhere.
  const travelRef = useRef(null);

  const routesFromChildren = useMemo(() => collectRoutes(children), [children]);
  const routes = routesProp || routesFromChildren;

  // Which page is on screen, read from the routes themselves: every one of them
  // is read, so this re-renders when any of them starts or stops matching.
  let currentIndex = -1;
  for (let i = 0; i < routes.length; i++) {
    if (routes[i].matchingSignal.value) {
      currentIndex = i;
    }
  }
  // The page that was on screen when the change now happening was asked for:
  // a travel is between two of them, and by the time anything renders the first
  // one is already gone. Written after each render (below), so a subscriber
  // reading it — they all run before Preact flushes — reads the one being left.
  const currentIndexRef = useRef(currentIndex);

  // One travel, whoever asked for it: a finger, a tab pressed, the browser's
  // own back button. What differs is only who moves it — the finger drives it
  // frame by frame (`scrub`), everything else lets it play.
  const beginTravel = ({ route, fromRoute, direction, scrub, change }) => {
    const travel = {
      route,
      // The page this set off from, kept rather than looked up again: the URL
      // changes at the first pixel, so a moment later nothing on screen
      // remembers where it started.
      fromRoute,
      direction,
      scrub,
      ratio: 0,
      // The animations of the pictures, once the browser has them. Held still
      // by CSS until then, so an empty hand here costs nothing: there is
      // nothing to stop, only nowhere to put them yet.
      animations: null,
      ended: false,
    };
    travelRef.current = travel;
    document.documentElement.setAttribute(TRAVEL_ATTRIBUTE, direction);
    if (scrub) {
      document.documentElement.setAttribute(HOLD_ATTRIBUTE, "");
      document.documentElement.setAttribute(DRAGGED_ATTRIBUTE, "");
    }
    const viewTransition = startViewTransition(async () => {
      if (change) {
        await change();
      }
      // The picture the browser is about to take must be of the page that was
      // asked for, and a route matching is not yet a page rendered.
      await nextRender();
    });
    travel.viewTransition = viewTransition;
    if (!scrub) {
      // Nobody is holding it: it plays as any transition does, and is over when
      // the browser says so.
      viewTransition.finished.then(() => {
        endTravel(travel);
      }, ignoreSkipped);
      return travel;
    }
    // The pictures exist from `ready` on, and the finger may have moved a long
    // way by then — held at their start meanwhile, so this is where they catch
    // up with it rather than where they set off.
    viewTransition.ready.then(() => {
      if (travel === travelRef.current) {
        scrubTravel(travel, travel.ratio);
      }
    }, ignoreSkipped);
    return travel;
  };

  // A page change nobody here asked for: a tab pressed, a key, the back button.
  // The transition is started from the route's own announcement rather than
  // from a render, because a render is one flush too late — by then the DOM
  // holds the new page and the picture of the old one cannot be taken anymore.
  useLayoutEffect(() => {
    const unsubscribes = routes.map((route, index) =>
      route.subscribeStatus(({ matching }) => {
        if (!matching) {
          return;
        }
        // A travel of ours already playing: this announcement IS that travel.
        if (travelRef.current) {
          return;
        }
        const fromIndex = currentIndexRef.current;
        currentIndexRef.current = index;
        if (fromIndex === -1 || fromIndex === index) {
          // Arriving from outside this row (or not moving at all): there is no
          // pair of pages to show, so there is nothing to travel between.
          return;
        }
        beginTravel({
          route,
          fromRoute: routes[fromIndex],
          direction: index > fromIndex ? "forward" : "back",
          scrub: false,
        });
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [routes]);

  // What the next announcement will compare itself against: written after the
  // render that shows it, so it is always the page one is looking at.
  useLayoutEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Let go of far enough: the movement carries on from under the finger, at its
  // own pace, to the end.
  const finishTravel = (travel) => {
    releaseHold();
    travel.viewTransition.finished.then(
      () => endTravel(travel),
      () => endTravel(travel),
    );
  };

  // Let go of too early: the pages go back the way they came, and the URL with
  // them. The way back is not a travel of its own — the same animations are run
  // backwards, and the page that was left is put back under the picture BEFORE
  // the picture is dropped, so the two are the same thing at the moment they
  // are swapped and nothing is seen changing.
  const revertTravel = (travel) => {
    const animations = travelAnimations(travel);
    for (const animation of animations) {
      animation.playbackRate = -1;
    }
    releaseHold();
    const backAtTheStart = animations.length
      ? Promise.all(
          animations.map((animation) => animation.finished.catch(() => {})),
        )
      : // Nothing to run backwards — a transition the browser skipped, or one
        // that never became ready. There is no picture to undo either, so the
        // way back is the state alone.
        Promise.resolve();
    backAtTheStart.then(async () => {
      await onTravel({ route: travel.fromRoute, cause: "revert" });
      await nextRender();
      travel.viewTransition.skipTransition();
      endTravel(travel);
    });
  };

  const endTravel = (travel) => {
    if (travel.ended) {
      return;
    }
    travel.ended = true;
    if (travelRef.current === travel) {
      travelRef.current = null;
      releaseHold();
      document.documentElement.removeAttribute(TRAVEL_ATTRIBUTE);
      document.documentElement.removeAttribute(DRAGGED_ATTRIBUTE);
    }
  };

  const onPointerDown = (pointerDownEvent) => {
    if (!travelByDrag || gestureRef.current || travelRef.current) {
      return;
    }
    if (currentIndex === -1) {
      return;
    }
    const gesture = startDragTravel(pointerDownEvent, {
      element: elementRef.current,
      axes: axis,
      onStart: ({ sign, target }) => {
        const box = elementRef.current.getBoundingClientRect();
        const size = axis === "x" ? box.width : box.height;
        // Dragging the page towards the end of the axis brings in what is
        // BEFORE it, the way pushing a sheet to the right reveals its left.
        const route =
          sign > 0 ? routes[currentIndex - 1] : routes[currentIndex + 1];
        if (
          !route ||
          !size ||
          scrollRoomTowards(target, elementRef.current, axis, sign)
        ) {
          return false;
        }
        if (CAN_KEEP_PICTURE) {
          beginTravel({
            route,
            fromRoute: routes[currentIndex],
            direction: sign > 0 ? "back" : "forward",
            scrub: true,
            change: () => onTravel({ route, cause: "drag" }),
          });
        } else {
          travelRef.current = { route, noPicture: true, ended: false };
        }
        return {
          size,
          travelBack: sign > 0,
          travelOn: sign < 0,
        };
      },
      onPull: ({ progress }) => {
        const travel = travelRef.current;
        if (!travel || travel.noPicture) {
          return;
        }
        // Only what goes the way the gesture set off: a hand turning around
        // mid-drag is putting the page back, and there is no second picture to
        // show it anything else.
        const ratio = travel.direction === "back" ? progress : -progress;
        travel.ratio = ratio > 0 ? ratio : 0;
        scrubTravel(travel, travel.ratio);
      },
      onEnd: ({ travels }) => {
        gestureRef.current = null;
        const travel = travelRef.current;
        if (!travel) {
          return;
        }
        if (travel.noPicture) {
          travelRef.current = null;
          if (travels) {
            onTravel({ route: travel.route, cause: "drag" });
          }
          return;
        }
        if (travels) {
          finishTravel(travel);
          return;
        }
        revertTravel(travel);
      },
      onGiveUp: () => {
        gestureRef.current = null;
      },
    });
    gestureRef.current = gesture;
  };

  return (
    <div
      {...rest}
      ref={elementRef}
      className={
        className ? `navi_route_travel ${className}` : "navi_route_travel"
      }
      data-axis={axis}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  );
};

// Nobody holds the pictures anymore: whatever they were told (a time to stand
// at, a direction to run in) is what they carry on from.
const releaseHold = () => {
  document.documentElement.removeAttribute(HOLD_ATTRIBUTE);
};

// The animations of the pictures, asked for again until there are some: they
// come into existence with the transition, several frames after it was asked
// for, and the gesture has already begun by then. Kept once found — the set
// does not change for the length of one travel.
const travelAnimations = (travel) => {
  if (travel.animations) {
    return travel.animations;
  }
  const animations = [];
  for (const animation of document.getAnimations()) {
    const pseudoElement = animation.effect?.pseudoElement;
    if (pseudoElement && pseudoElement.startsWith("::view-transition")) {
      animations.push(animation);
    }
  }
  if (animations.length) {
    travel.animations = animations;
  }
  return animations;
};

// Where the two pictures stand, said as a moment in the movement they would
// have played on their own: the browser knows how they move (it is written in
// CSS), so the finger only has to say how far in. They are held still by CSS
// while this lasts, so a time written here is a place they stay at.
const scrubTravel = (travel, ratio) => {
  for (const animation of travelAnimations(travel)) {
    const timing = animation.effect.getComputedTiming();
    const duration = timing.delay + timing.activeDuration;
    animation.currentTime = ratio * duration;
  }
};

// The render a route change sets off: a route matching is a signal changing,
// and Preact answers it in a microtask of its own — so the DOM holds the new
// page a few microtasks later, never in the same one.
//
// Microtasks, and NOT a frame: this is awaited inside the callback of a view
// transition, and the browser has stopped rendering by then — it is waiting for
// this very promise to take its picture. A requestAnimationFrame in there waits
// for a frame that cannot come until it resolves, and the transition hangs.
const nextRender = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

// A transition skipped by another one starting is an outcome, not a failure.
const ignoreSkipped = () => {};
