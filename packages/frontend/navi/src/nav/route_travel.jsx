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
 * What travels is decided at the first pixel, like the axis: a travel brings in
 * ONE neighbour, and turning the hand around mid-drag puts the current page
 * back rather than fetching the other side. A hand that walks a whole page
 * across and keeps going is not turning around though — it is asking for the
 * next one, and the gesture relays into a second travel without being let go
 * of (see onEdge).
 *
 * Anything else that must follow the gesture — the trait under a tab bar, a
 * header — follows by being NAMED, not by being told: give it a
 * `view-transition-name` of its own and the browser animates it from where it
 * was to where it is, on the same clock as the pages. That is why the tab row
 * can stay where it is, outside this box, and still move with the finger.
 */

import { options } from "preact";
import { useLayoutEffect, useMemo, useRef } from "preact/hooks";

import {
  scrollRoomTowards,
  startDragTravel,
  watchWheelTravel,
} from "@jsenv/dom";
import { observeBeforeRouting } from "./browser_integration/before_routing.js";
import { collectRoutes, observeRouteRender } from "./route.jsx";
import {
  ensureDocumentStartViewTransition,
  holdViewTransition,
} from "../transition/start_view_transition_polyfill.js";

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
// A travel that changed its mind about where it was going (see
// turnTravelAround). Only the pages can be turned around: everything else the
// transition carries was measured once, at the start, against a destination
// this travel is no longer going to.
const TURNED_ATTRIBUTE = "data-navi-route-travel-turned";

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
    /* The page around the box is NOT taken as a picture, against the browser's
       own default: an element that has been captured is not painted where it
       was and cannot be pointed at either — every press lands on the document
       root instead. Capturing the whole page therefore freezes it in both
       senses at once, and a tab row beside a travel is dead for the length of
       every travel: nothing highlights, the cursor is an arrow, a press on the
       tab one changed one's mind about goes nowhere.

       Left live, the page around answers as it always did, and nothing shows
       through where the pages are: the box IS captured (it is named below), so
       it paints nothing of its own, and the two pictures cover its rectangle
       between them at every moment of the travel. */
    view-transition-name: none;

    /* The pictures are looked at, never touched: they are drawn in the top
       layer, above everything, so a hand reaching for a page that is still
       sliding would land on the picture of it and the box below would never
       hear the press. Nothing here is interactive — what the finger is
       reaching for is the travel underneath, and it must reach it. */
    &::view-transition,
    &::view-transition-group(*),
    &::view-transition-image-pair(*),
    &::view-transition-old(*),
    &::view-transition-new(*) {
      pointer-events: none;
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

  /* A travel that turned around takes its pages with it and nothing else. Every
     other thing the transition carries — a bar under a tab row, a header — was
     PHOTOGRAPHED when the transition began: where it stood, and where it was
     going to stand. Both are fixed, and the second one is now a place nobody is
     going to. Worse, the thing itself has moved on in the live page (the bar is
     already under the tab one is heading for), so the picture and the thing are
     in two places at once — and two bars is what one sees.

     So the pictures of everything that is not the pages are dropped, and those
     things are simply left where they are, live. A jump rather than a slide, on
     the one gesture that cannot have both. */
  :root[${TURNED_ATTRIBUTE}] {
    &::view-transition-group(*) {
      display: none;
    }
    /* …except the pages, which are what a travel is about. Listed after, so it
       wins on order rather than on a specificity war. */
    &::view-transition-group(navi-route-travel) {
      display: block;
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
 * @param {(detail: {route: object, cause: "drag"|"wheel"|"revert"}) => void|Promise<void>} [props.onTravel]
 *   - how to go to a route. The default REPLACES the current history entry
 *   rather than pushing one: a swipe is how one browses a page, not a place one
 *   aimed at, and three swipes back and forth must not bury the way out of the
 *   page under six entries. A tab pressed is the other case and pushes, which
 *   is what its <Link> already does.
 *
 * The pages are cut at the edge of this box while they travel, which is written
 * on the transition's own pseudo-elements — no overflow of the document reaches
 * pictures drawn in the top layer. It needs nothing of the browser beyond view
 * transitions themselves: a browser without them (Firefox) navigates without the
 * movement, and the gesture applies its change on release instead of dragging a
 * picture that does not exist.
 *
 * While a travel plays, the rest of the page is taken as a picture too — this
 * box asks for `view-transition-name: root` back for that time, so an
 * application that opts the document out for its own transitions gets its rule
 * back the moment the travel is over.
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
  // The route this box has ASKED for and is still waiting to see arrive.
  // Routing is asynchronous: a travel's own navigation lands well after the
  // travel decided anything about it — sometimes after the travel was undone —
  // and read back as "the route changed" it would start a second travel nobody
  // asked for, over pictures that are already showing something else.
  const routeAskedForRef = useRef(null);
  // What a press stopped in flight, until the gesture says what it is about.
  const caughtAtPressRef = useRef(null);
  // The latest way to answer a gesture, for a watcher that outlives every
  // render (see the wheel effect below).
  const travelHandlersRef = useRef(null);
  const pointerDownRef = useRef(null);

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
      holdPictures(travel);
      document.documentElement.setAttribute(DRAGGED_ATTRIBUTE, "");
    }
    routeAskedForRef.current = route;
    // The hold a navigation already took, if this travel is the answer to one:
    // taking another would be taking a hold on a page that is holding still.
    const releaseRendering = renderingHeldForRouting || holdRendering();
    renderingHeldForRouting = null;
    // The picture the browser is about to take must be of the page that was
    // asked for, and a route matching is not yet a page rendered.
    const viewTransition = startViewTransition(() =>
      whileRouteRenders(route, async () => {
        releaseRendering();
        if (change) {
          await change();
        }
      }),
    );
    travel.viewTransition = viewTransition;
    if (scrub) {
      // Said only now: the release has to have something to let go of, and the
      // transition did not exist a line above.
      travel.dropHold = holdViewTransition(() => {
        viewTransition.skipTransition();
        endTravel(travel);
      });
    }
    // Another transition starting SKIPS this one — there is only ever one in a
    // document. That must end the travel here and now, and above all lift the
    // hold: the hold is written in CSS against whatever transition is running
    // (it has to be, so that everything named — a trait under a tab row —
    // follows the same finger), so left on it would take hold of the transition
    // that has just replaced ours. Born paused, with nobody holding it, that
    // one never finishes: its pictures stand over a page that cannot be
    // touched anymore.
    viewTransition.finished.catch(() => {
      // A transition that fails before it ever calls back leaves the page held:
      // whoever asked for the hold gives it back, here as everywhere else.
      releaseRendering();
      endTravel(travel);
    });
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
        // …and so is one this box asked for and had given up waiting on: what
        // arrives here is the answer to a question already answered, not
        // somebody going somewhere.
        if (routeAskedForRef.current === route) {
          routeAskedForRef.current = null;
          currentIndexRef.current = index;
          return;
        }
        // Somewhere else arrived first: whatever this box was still waiting for
        // is not coming, or no longer means anything. Forgotten here rather
        // than kept, or the next press on that very tab would be taken for the
        // late answer to a question nobody remembers asking.
        routeAskedForRef.current = null;
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

  // Rendering is held for the length of a navigation, so that whatever picture
  // this box is about to take is of the page being LEFT (see holdRendering).
  // Held from before the navigation's first write, because by the time a route
  // announces that it matches, Preact has already been told and the render is
  // queued — a hold taken then is a hold taken too late.
  useLayoutEffect(() => {
    return observeBeforeRouting(() => {
      renderingHeldForRouting = holdRendering();
      // Nobody may have a picture to take: this navigation is not always one
      // this box travels, and a page held for a change it does not animate is
      // a page that stutters for nothing. Whoever wants it takes it over
      // (beginTravel) before this runs.
      queueMicrotask(() => {
        const release = renderingHeldForRouting;
        renderingHeldForRouting = null;
        if (release) {
          release();
        }
      });
    });
  }, []);

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
    travel.reverting = true;
    const animations = travelAnimations(travel);
    for (const animation of animations) {
      animation.playbackRate = -1;
    }
    releaseHold(travel);
    const backAtTheStart = animations.length
      ? Promise.all(
          animations.map((animation) => animation.finished.catch(() => {})),
        )
      : // Nothing to run backwards — a transition the browser skipped, or one
        // that never became ready. There is no picture to undo either, so the
        // way back is the state alone.
        Promise.resolve();
    backAtTheStart.then(async () => {
      try {
        routeAskedForRef.current = travel.fromRoute;
        // The page that was left is put back UNDER the picture before the
        // picture is dropped, so the two are the same thing at the moment they
        // are swapped: that only holds once the page is really back.
        await whileRouteRenders(travel.fromRoute, () =>
          onTravel({ route: travel.fromRoute, cause: "revert" }),
        );
        travel.viewTransition.skipTransition();
      } finally {
        // A travel ENDS, whatever happened on the way back: put the state back,
        // fail to drop the picture, be interrupted by something else — the one
        // thing that must not happen is a travel that stays "in flight"
        // forever. Nothing would lift the hold, the pictures would stand where
        // they are over a page that cannot be touched, and every gesture after
        // this one would find the box busy.
        endTravel(travel);
      }
    });
  };

  // Taken back in hand: the pictures stop where they are and answer the finger
  // again (see the CSS hold).
  const holdTravel = (travel) => {
    if (travel.ended || travel.reverting) {
      return;
    }
    travel.scrub = true;
    holdPictures(travel);
    // Whatever asks for a transition next takes ours away (there is one per
    // document): it must find this one already let go of, or it inherits a hold
    // nobody is holding.
    travel.dropHold = holdViewTransition(() => {
      travel.viewTransition?.skipTransition();
      endTravel(travel);
    });
  };

  // The same travel, going the other way from where it began: the still it
  // starts from does not change, only what is being brought in against it.
  const turnTravelAround = (travel, route, direction) => {
    travel.route = route;
    travel.direction = direction;
    travel.ratio = 0;
    // The other way round is another pair of keyframes, and naming another
    // animation builds another Animation: whatever was collected answers to
    // nobody now.
    travel.animations = null;
    document.documentElement.setAttribute(TRAVEL_ATTRIBUTE, direction);
    document.documentElement.setAttribute(TURNED_ATTRIBUTE, "");
    routeAskedForRef.current = route;
  };

  const endTravel = (travel) => {
    if (travel.ended) {
      return;
    }
    travel.ended = true;
    travel.dropHold?.();
    travel.dropHold = null;
    // Its own hold, always — whether or not this travel is still the current
    // one. Nobody else will lift it.
    releaseHold(travel);
    if (travelRef.current === travel) {
      travelRef.current = null;
      document.documentElement.removeAttribute(TRAVEL_ATTRIBUTE);
      document.documentElement.removeAttribute(DRAGGED_ATTRIBUTE);
      document.documentElement.removeAttribute(TURNED_ATTRIBUTE);
    }
  };

  // What a gesture is about, whichever hand made it: a thumb dragging the page
  // and two fingers pushing it sideways on a trackpad ask for the same travel,
  // so they are answered by the same three callbacks and only the reading of
  // the input differs (see drag_travel.js).
  const boxSizeOnAxis = () => {
    const box = elementRef.current.getBoundingClientRect();
    return axis === "x" ? box.width : box.height;
  };

  const travelHandlers = {
    onStart: ({ sign, target }) => {
      const size = boxSizeOnAxis();
      const travelInFlight = travelRef.current;
      if (travelInFlight) {
        // A travel is already playing, and a second one cannot be started on
        // top of it: there is one picture of the page being left, and it is
        // taken. So the gesture takes over THIS travel instead of asking for
        // another — which is what a hand reaching for a page still sliding is
        // asking for anyway. It is refused only when there is nothing to take
        // over (no picture at all).
        //
        // Never given up, even then: a gesture handed back to the browser is a
        // page that rocks under a travel that is already moving.
        // A travel being undone is not up for grabs either: it is already on
        // its way back and its end is decided. Held again mid-revert, its
        // animations would never finish — and the wait for them never resolves,
        // so the pictures stay where they are, over a page that cannot be
        // touched anymore.
        if (
          travelInFlight.noPicture ||
          travelInFlight.ended ||
          travelInFlight.reverting
        ) {
          return { size, travelBack: false, travelOn: false };
        }
        caughtAtPressRef.current = null;
        holdTravel(travelInFlight);
        // Where the pictures stand right now, said as a pull: what the finger
        // continues from, so nothing jumps when it takes them over.
        const ratio = ratioOfTravel(travelInFlight);
        travelInFlight.ratio = ratio;
        const pulledSign = travelInFlight.direction === "back" ? 1 : -1;
        return {
          size,
          slack: ratio * size * pulledSign,
          // One box, the one being travelled. Either of its ends can be walked
          // out of and the hand carries on into the next page, but that is a
          // travel of its own and the gesture asks for it when it gets there
          // (see onEdge) — from here there is one page on its way.
          travelBack: travelInFlight.direction === "back",
          travelOn: travelInFlight.direction === "forward",
        };
      }
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
    // A page walked all the way to one of its ends and the finger still going:
    // what it asks for is the page past that end, and it has said so by not
    // stopping. Which end decides how it is answered, and the two are not the
    // same amount of work.
    onEdge: ({ sign }) => {
      const travel = travelRef.current;
      if (
        !travel ||
        travel.noPicture ||
        travel.ended ||
        travel.reverting ||
        !CAN_KEEP_PICTURE
      ) {
        return false;
      }
      // Where the page in hand is coming from, said the way the gesture says
      // it: dragging towards the end of the axis brings in what comes BEFORE.
      const pulledSign = travel.direction === "back" ? 1 : -1;
      const direction = sign > 0 ? "back" : "forward";
      if (sign === pulledSign) {
        // Walked whole. What the pictures show is the page that has arrived,
        // and the one leaving is gone: there is no pair left to travel with, so
        // the next travel needs pictures of its own — a navigation, a render, a
        // snapshot, and for those few frames the page does not follow the
        // finger before catching up with it (see `ready` in beginTravel). At
        // the start of a gesture that gap is invisible, the hand has barely
        // moved; here the hand is at full speed, and this is what it costs.
        //
        // Where we are is what THIS travel was bringing in — the URL changed at
        // the first pixel, so `currentIndex` belongs to a render this gesture
        // is older than.
        const fromIndex = routes.indexOf(travel.route);
        const route =
          direction === "back" ? routes[fromIndex - 1] : routes[fromIndex + 1];
        if (fromIndex === -1 || !route) {
          return false;
        }
        // At their very end before they are let go of: what ends the travel in
        // hand is the next transition starting (there is one per document, and
        // the funnel skips ours), and a picture skipped short of its end is a
        // page seen jumping the last few pixels.
        scrubTravel(travel, 1);
        travel.ratio = 1;
        beginTravel({
          route,
          fromRoute: travel.route,
          direction,
          scrub: true,
          change: () => onTravel({ route, cause: "drag" }),
        });
        return {
          size: boxSizeOnAxis(),
          travelBack: sign > 0,
          travelOn: sign < 0,
        };
      }
      // Walked back to where it began, and out the other side. Nothing has to
      // be built here: the pictures in hand are ALREADY the pair this new
      // travel needs — the still of the page it starts from is the same one,
      // and the picture being brought in is live, so pointing the router at the
      // other neighbour is enough for it to show that one instead. The travel
      // turns around where it stands, on the same transition and under the same
      // hand, and there is no gap at all.
      const fromIndex = routes.indexOf(travel.fromRoute);
      const route =
        direction === "back" ? routes[fromIndex - 1] : routes[fromIndex + 1];
      if (fromIndex === -1 || !route) {
        return false;
      }
      turnTravelAround(travel, route, direction);
      onTravel({ route, cause: "drag" });
      return {
        size: boxSizeOnAxis(),
        travelBack: sign > 0,
        travelOn: sign < 0,
      };
    },
    onEnd: ({ travels }) => {
      gestureRef.current = null;
      caughtAtPressRef.current = null;
      const travel = travelRef.current;
      if (!travel) {
        // The travel this gesture was holding ended under it. Nothing left to
        // decide, but the hold is this gesture's own doing and nobody else will
        // take it off — a hold nobody lifts is a page nobody can touch.
        releaseHold();
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
  };

  const onPointerDown = (pointerDownEvent) => {
    if (!travelByDrag || gestureRef.current) {
      return;
    }
    // Touching something that is moving STOPS it, right there, before the
    // gesture has said anything about itself. Waiting for the first pixels that
    // decide an axis would let the pages travel on under a finger that has
    // already landed on them, which is the one moment a hand expects to be
    // obeyed without asking. If the press turns out to be nothing, the travel
    // is let go of again and carries on (see onGiveUp).
    const travelToCatch = travelRef.current;
    if (
      travelToCatch &&
      !travelToCatch.noPicture &&
      !travelToCatch.ended &&
      !travelToCatch.reverting
    ) {
      holdTravel(travelToCatch);
      caughtAtPressRef.current = travelToCatch;
    }
    // A travel already playing is not a reason to refuse the press: a hand
    // reaching for a page that is still sliding is reaching for THAT page, and
    // the gesture takes it over (see onStart).
    if (currentIndex === -1) {
      return;
    }
    const gesture = startDragTravel(pointerDownEvent, {
      element: elementRef.current,
      axes: axis,
      // Caught in flight: the hand is already in the gesture (see above), so it
      // is answered from its first pixel, on the axis the pages travel.
      immediate: caughtAtPressRef.current ? axis : false,
      ...travelHandlers,
      onGiveUp: () => {
        gestureRef.current = null;
        // A press that never became a gesture: whatever it stopped goes on its
        // way, from where the finger caught it.
        const caught = caughtAtPressRef.current;
        caughtAtPressRef.current = null;
        if (caught && !caught.ended) {
          releaseHold(caught);
        }
      },
    });
    gestureRef.current = gesture;
  };

  // A press that lands ON the box while a travel is playing does not reach it:
  // the browser's transition covers the page and the press is delivered to the
  // document root instead, whatever the pictures are told about pointer events.
  // So while a travel plays, the press is caught at the document and handed to
  // the box when it fell inside it — which is where the hand thinks it pressed.
  pointerDownRef.current = onPointerDown;
  useLayoutEffect(() => {
    const onDocumentPointerDown = (pointerDownEvent) => {
      if (!travelRef.current) {
        return;
      }
      const boxElement = elementRef.current;
      if (!boxElement || boxElement.contains(pointerDownEvent.target)) {
        // It got there on its own.
        return;
      }
      const { left, right, top, bottom } = boxElement.getBoundingClientRect();
      const { clientX, clientY } = pointerDownEvent;
      if (
        clientX < left ||
        clientX > right ||
        clientY < top ||
        clientY > bottom
      ) {
        return;
      }
      pointerDownRef.current(pointerDownEvent);
    };
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    };
  }, []);

  // A wheel pushing the box sideways asks for a PAGE, not for a place between
  // two: one push, one neighbour — the same thing a tab pressed asks for, and
  // it plays at its own pace rather than under a hand (see watchWheelTravel).
  const travelOneStep = (sign) => {
    const travelInFlight = travelRef.current;
    if (travelInFlight?.scrub) {
      // A hand is holding the pages. They are its until it lets go.
      return;
    }
    // Where the box is going, which is not where it is: a step asked for while
    // a travel plays is the page after the one on its way.
    const fromRoute = travelInFlight
      ? travelInFlight.route
      : routes[currentIndex];
    const fromIndex = routes.indexOf(fromRoute);
    if (fromIndex === -1) {
      return;
    }
    const route = sign > 0 ? routes[fromIndex - 1] : routes[fromIndex + 1];
    if (!route) {
      return;
    }
    if (travelInFlight) {
      // Finished where it stands before the next one sets off: what ends it is
      // that transition starting, and a picture dropped short of its end is a
      // page seen jumping the last few pixels.
      scrubTravel(travelInFlight, 1);
      travelInFlight.ratio = 1;
    }
    beginTravel({
      route,
      fromRoute,
      direction: sign > 0 ? "back" : "forward",
      scrub: false,
      change: () => onTravel({ route, cause: "wheel" }),
    });
  };

  // Reached through a ref, and the watcher is never rebuilt for it: a travel
  // CHANGES the current page, so anything listening on `currentIndex` would be
  // torn down halfway through the very gesture that is moving it.
  travelHandlersRef.current = travelHandlers;
  const travelOneStepRef = useRef(null);
  travelOneStepRef.current = travelOneStep;
  useLayoutEffect(() => {
    if (!travelByDrag) {
      return undefined;
    }
    return watchWheelTravel(elementRef.current, {
      axes: axis,
      onStep: ({ sign }) => travelOneStepRef.current(sign),
    });
  }, [travelByDrag, axis]);

  return (
    <div
      {...rest}
      ref={elementRef}
      className={
        className ? `navi_route_travel ${className}` : "navi_route_travel"
      }
      data-axis={axis}
      // What travels here, and on which axis: read by the shared gesture
      // stylesheet, which keeps this box's scrolling from spilling onto the
      // page (see drag_travel.js).
      data-drag-travel={travelByDrag ? axis : undefined}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  );
};

// Nobody holds the pictures anymore: whatever they were told (a time to stand
// at, a direction to run in) is what they carry on from.
// Which travel is keeping the pictures still, if any. The hold belongs to the
// travel that took it and only that one may give it back: a travel ending after
// another has taken over must not lift a hold it no longer owns, and — the way
// this went wrong — a travel whose end comes once something else has replaced
// it must still lift its OWN. A hold left behind is a page frozen under
// pictures nobody is holding.
let travelHoldingPictures = null;
const holdPictures = (travel) => {
  travelHoldingPictures = travel;
  document.documentElement.setAttribute(HOLD_ATTRIBUTE, "");
};
const releaseHold = (travel) => {
  if (travel && travelHoldingPictures !== travel) {
    return;
  }
  travelHoldingPictures = null;
  document.documentElement.removeAttribute(HOLD_ATTRIBUTE);
};

// The browser does not take the picture of the page being left when a
// transition is ASKED for — it takes it at the next frame, just before running
// the update callback. Preact renders sooner than that, in a microtask: so a
// change nobody here asked for (a tab pressed, the back button) has already
// reached the DOM when the picture is taken, and the picture is of the page
// ARRIVING. Both sides of the travel then show it, and one watches a page slide
// onto itself.
//
// So what Preact has queued waits until the update callback, which is the
// moment the API is built around — the change belongs inside it. The whole
// document is held, for the one frame the browser needs: it is about to be
// frozen under a picture anyway.
let renderingHold = null;
// The hold a navigation took on its way in, until a travel takes it over or the
// navigation turns out to be one nobody here animates.
let renderingHeldForRouting = null;
const holdRendering = () => {
  if (renderingHold) {
    return renderingHold.release;
  }
  const debounceRenderingBefore = options.debounceRendering;
  const hold = {
    render: null,
    release: () => {
      // Only the hold that is still standing may be given back: a travel
      // ending after another has taken over must not let go of what it does
      // not hold.
      if (renderingHold !== hold) {
        return;
      }
      renderingHold = null;
      options.debounceRendering = debounceRenderingBefore;
      const { render } = hold;
      hold.render = null;
      if (render) {
        render();
      }
    },
  };
  renderingHold = hold;
  options.debounceRendering = (render) => {
    hold.render = render;
  };
  return hold.release;
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

// How far a travel has come, read off the pictures themselves rather than off
// what the last gesture wrote: one let go of is still moving, and a hand
// reaching for it must find it where it IS.
const ratioOfTravel = (travel) => {
  const animations = travelAnimations(travel);
  // The pages' own animation, not the first that comes: everything the travel
  // carries along is animated too (a trait under a tab row, the page behind),
  // each with a duration of its own. A time read on one of those and turned
  // into a fraction of ANOTHER lands anywhere — over 1 more often than not,
  // which reads as a travel already over and jumps the pictures to their end.
  const animation =
    animations.find((candidate) =>
      candidate.effect?.pseudoElement?.includes("navi-route-travel"),
    ) || animations[0];
  if (!animation) {
    return travel.ratio;
  }
  const timing = animation.effect.getComputedTiming();
  const duration = timing.delay + timing.activeDuration;
  if (!duration) {
    return travel.ratio;
  }
  return animation.currentTime / duration;
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

// A route change, carried out and then waited for until the page it selects is
// really on screen. The container doing the swapping is the only one who knows
// when that is (observeRouteRender): a route matching is a signal changing, and
// how many passes Preact takes to answer it is its own business.
//
// Nothing is waited for when the change did not take — a route refused, a
// redirect somewhere else. There is no page on its way then, and this runs
// inside the callback of a view transition: the browser has stopped rendering
// and is waiting on this very promise to take its picture, so a wait that never
// ends is a page frozen under a transition that never became ready.
const whileRouteRenders = async (route, change) => {
  let stopListening;
  const rendered = new Promise((resolve) => {
    // Listened for before the change, or a render landing while the change is
    // being awaited is a render nobody heard.
    stopListening = observeRouteRender(resolve);
  });
  try {
    await change();
    if (route.matchingSignal.peek()) {
      await rendered;
    }
  } finally {
    stopListening();
  }
};

// A transition skipped by another one starting is an outcome, not a failure.
const ignoreSkipped = () => {};
