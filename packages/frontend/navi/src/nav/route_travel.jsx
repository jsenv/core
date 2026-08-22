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

import { useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { computed } from "@preact/signals";

import {
  scrollRoomTowards,
  startDragToTravel,
  watchWheelTravel,
} from "@jsenv/dom";
import {
  observeAfterRouting,
  observeBeforeRouting,
} from "./browser_integration/before_routing.js";
import {
  holdRenderingForRouting,
  releaseRoutingRenderingHold,
  takeoverRoutingRenderingHold,
} from "./rendering_hold.js";
import {
  collectRoutePages,
  freezeRouteRender,
  observeRouteRender,
} from "./route.jsx";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
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
// Which way the pages move, said on the document: the pictures of a transition
// hang off the root, not off the box that travels, so the box's own `axis` has
// to be lent to the document for the length of the travel.
const TRAVEL_AXIS_ATTRIBUTE = "data-navi-route-travel-axis";
// While a finger holds the travel: the pictures stand still and go exactly
// where it says (see the CSS, and scrubTravel).
const HOLD_ATTRIBUTE = "data-navi-route-travel-held";
// A travel a finger set off, for its whole life — including what plays out
// after the finger is gone. It moves by another law than one asked for by a
// press (see the CSS).
const DRAGGED_ATTRIBUTE = "data-navi-route-travel-dragged";
// A travel that changed its mind about where it was going (see
// redirectTravel). Only the pages can be aimed somewhere else: everything the
// transition carries was measured once, at the start, against a destination
// this travel is no longer going to.
const TURNED_ATTRIBUTE = "data-navi-route-travel-turned";
// The name the box wears while it travels, and only then (see nameForTravel).
const TRAVEL_NAME = "navi-route-travel";
// Where the two boxes of a travel stand in the window, published for the
// length of it. Measurements only: what is DERIVED from them — where a picture
// goes, what a bar covers — is derived in the CSS below, so the app's own
// numbers (the room its fixed bars take) can take part in it. Only the
// measuring needs JS, and only for the one moment both boxes exist (see
// holdTravelGeometry).
const TRAVEL_TOP_PROPERTY = "--navi-route-travel-top";
const TRAVEL_LEFT_PROPERTY = "--navi-route-travel-left";
const TRAVEL_WIDTH_PROPERTY = "--navi-route-travel-width";
const TRAVEL_HEIGHT_PROPERTY = "--navi-route-travel-height";
const TRAVEL_OLD_TOP_PROPERTY = "--navi-route-travel-old-top";
const TRAVEL_OLD_LEFT_PROPERTY = "--navi-route-travel-old-left";
const TRAVEL_GEOMETRY_PROPERTIES = [
  TRAVEL_TOP_PROPERTY,
  TRAVEL_LEFT_PROPERTY,
  TRAVEL_WIDTH_PROPERTY,
  TRAVEL_HEIGHT_PROPERTY,
  TRAVEL_OLD_TOP_PROPERTY,
  TRAVEL_OLD_LEFT_PROPERTY,
];

const css = /* css */ `
  /* The name that makes the page inside this box a picture of its own during a
     transition — rather than part of the one big picture the document takes, so
     the two pages can move past each other while everything else stays where it
     is — is not written here: it is worn only for the length of a travel (see
     nameForTravel). A name belongs to ONE element at a time, and a page can hold
     several of these boxes at once — a section of the url and a search param of
     the root route are two rows of tabs, both live, and only one of them is ever
     travelling. */
  .navi_route_travel {
    position: relative;

    /* What a touch may do here — only where a touch travels at all
       (data-travel-by-drag, set from travelByDrag): the axis the pages travel
       on is taken, the other one is left to the page, so a list still scrolls
       under the same finger. A box that takes no gesture takes no axis either:
       it is a plain box around the page, and everything in it scrolls as it
       would anywhere else. Same reading as SlideContainer's own. */
    &[data-travel-by-drag="x"] {
      touch-action: pan-y;
    }
    &[data-travel-by-drag="y"] {
      touch-action: pan-x;
    }
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
      /* Each picture at the size it was taken at: a page is not resized by the
         page it crosses. Told to fill a box whose height is being animated, a
         picture is STRETCHED with it — the page leaving is then seen squashing
         upwards, or zooming, over the length of the travel, when all it is
         doing is walking off the edge. */
      height: auto;
      object-fit: none;
      object-position: top left;
      /* The default cross-fade, dropped: two pages sliding past each other are
         two solid things, and seeing through one to the other says they are the
         same page changing its mind. */
      mix-blend-mode: normal;
    }
    &::view-transition-old(navi-route-travel) {
      /* Where the page being left WAS on screen, which is not where the group
         stands: the group is at the arriving box (its position animation is
         dropped along with its height one, below), and the two boxes are at the
         same place in the layout without being at the same place in the window
         — one page is scrolled and the other is not, so the box being left
         starts higher up. Left at the group's own corner the page being left
         would be seen jumping back to its top before it even begins to leave.
         Offset here rather than by \`translate\`, which the movement itself uses,
         and at its own size rather than the group's so that nothing is cut off
         the far side of the shift (see holdTravelGeometry). */
      top: calc(var(${TRAVEL_OLD_TOP_PROPERTY}) - var(${TRAVEL_TOP_PROPERTY}));
      left: calc(
        var(${TRAVEL_OLD_LEFT_PROPERTY}) - var(${TRAVEL_LEFT_PROPERTY})
      );
      width: auto;
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
      /* The window the two pictures are seen through, held still for the whole
         travel at the taller of the two boxes (see holdTravelGeometry): the group
         is what CLIPS, and the browser animates its height from the box being
         left to the box arriving — so the window shrinks under the pictures and
         cuts the page leaving from the bottom, progressively. The box does end
         up at the arriving page's height, and that is right; what must not
         happen is the user watching it get there.

         The height is held by dropping the group's animation rather than by
         winning against it with !important — which also drops its position
         animation, fine while a travel box stands in the same place from one
         route to the next. */
      height: var(${TRAVEL_HEIGHT_PROPERTY});

      /* Cut at the safe area, on top of being cut at the box. The pictures are
         drawn in the top layer, so they cover a fixed bar as easily as anything
         else — and the box they travel in runs UNDER the bars by design: that
         is what a fixed bar is for, and what the room it gives back is for. A
         box scrolled by so much as a pixel therefore starts above the top bar
         and ends below the bottom one, and the travel would be watched painting
         over both for its whole length.

         The band left free is the app's own safe area (see layout/safe_area.js)
         — every kind of furniture at once, not the bars alone, and read rather
         than asked for, so one that grows, shrinks or unmounts mid-travel is
         followed without anything being told. What the group cannot know is
         only where it itself stands, and that is the measured half. */
      --navi-route-travel-clip-top: max(
        0px,
        var(--navi-safe-area-inset-top) - var(${TRAVEL_TOP_PROPERTY})
      );
      --navi-route-travel-clip-left: max(
        0px,
        var(--navi-safe-area-inset-left) - var(${TRAVEL_LEFT_PROPERTY})
      );
      --navi-route-travel-clip-bottom: max(
        0px,
        var(${TRAVEL_TOP_PROPERTY}) + var(${TRAVEL_HEIGHT_PROPERTY}) +
          var(--navi-safe-area-inset-bottom) - 100dvh
      );
      --navi-route-travel-clip-right: max(
        0px,
        var(${TRAVEL_LEFT_PROPERTY}) + var(${TRAVEL_WIDTH_PROPERTY}) +
          var(--navi-safe-area-inset-right) - 100dvw
      );
      clip-path: inset(
        var(--navi-route-travel-clip-top) var(--navi-route-travel-clip-right)
          var(--navi-route-travel-clip-bottom)
          var(--navi-route-travel-clip-left)
      );
      animation-duration: var(--navi-route-travel-duration, 300ms);
      animation-name: none;
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

  /* The same four movements, along the axis the pages are laid out on: the
     start of a column is its top, so going forward there is the page rising and
     the next one coming up from below. */
  :root[${TRAVEL_AXIS_ATTRIBUTE}="y"] {
    &[${TRAVEL_ATTRIBUTE}="forward"] {
      &::view-transition-old(navi-route-travel) {
        animation-name: navi-route-travel-leave-towards-top;
      }
      &::view-transition-new(navi-route-travel) {
        animation-name: navi-route-travel-enter-from-bottom;
      }
    }
    &[${TRAVEL_ATTRIBUTE}="back"] {
      &::view-transition-old(navi-route-travel) {
        animation-name: navi-route-travel-leave-towards-bottom;
      }
      &::view-transition-new(navi-route-travel) {
        animation-name: navi-route-travel-enter-from-top;
      }
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
  @keyframes navi-route-travel-leave-towards-top {
    from {
      translate: 0 0;
    }
    to {
      translate: 0 -100%;
    }
  }
  @keyframes navi-route-travel-enter-from-bottom {
    from {
      translate: 0 100%;
    }
    to {
      translate: 0 0;
    }
  }
  @keyframes navi-route-travel-leave-towards-bottom {
    from {
      translate: 0 0;
    }
    to {
      translate: 0 100%;
    }
  }
  @keyframes navi-route-travel-enter-from-top {
    from {
      translate: 0 -100%;
    }
    to {
      translate: 0 0;
    }
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   routes?: Array<object|{route: object, params?: object}>,
 *   axis?: "x"|"y",
 *   travelByDrag?: boolean,
 *   onTravel?: (detail: {route: object, params: object|undefined, cause: string}) => void|Promise<void>,
 * }>}
 * @param {Array<object|{route: object, params?: object}>} [props.routes] - the
 *   tabs, in the order they are shown. Read from the <Route> children by
 *   default, in the order they are written: the router already holds that list,
 *   and asking a caller to write it twice is asking for the two to disagree.
 *   Pass it to say another order, when the pages are not children of this box,
 *   or to name a tab the children cannot — the section a <Route fallback> shows
 *   is a tab like the others, and only its params say which one.
 *
 *   An entry is a route, or `{ route, params }` when the tabs of the row are a
 *   PARAM of one route rather than routes of their own (the form
 *   `<Route routeParams>` selects a branch on, and the form that lets a link
 *   with no params reopen the section one was looking at). Written as bare
 *   routes, three tabs of one route are the same object three times: there is
 *   then one tab, and nowhere to travel.
 * @param {"x"|"y"} [props.axis="x"] - which way the pages are laid out.
 * @param {boolean} [props.travelByDrag=true] - whether a pointer dragging the
 *   page travels. Off where the gesture belongs to the content.
 * @param {(detail: {route: object, params: object|undefined, cause: "drag"|"wheel"|"revert"}) => void|Promise<void>} [props.onTravel]
 *   - how to go to a tab. The default REPLACES the current history entry
 *   rather than pushing one: a swipe is how one browses a page, not a place one
 *   aimed at, and three swipes back and forth must not bury the way out of the
 *   page under six entries. A tab pressed is the other case and pushes, which
 *   is what its <Link> already does.
 *
 * Every other prop lands on the box itself (`id`, `data-testid`, `className`,
 * …), which is how one of these is named: a page can hold several — a row of
 * sections inside the box the whole application travels in — and the class they
 * share plus their axis are not enough to tell them apart from the outside.
 *
 * The pages are cut at the edge of this box while they travel, and at the app's
 * safe area the box runs under, which is written on the transition's own
 * pseudo-elements — no overflow of the document reaches pictures drawn in the
 * top layer. It needs nothing of the browser beyond view
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
  onTravel = ({ route, params }) => route.redirectTo(params),
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
  // The page this box has ASKED for and is still waiting to see arrive.
  // Routing is asynchronous: a travel's own navigation lands well after the
  // travel decided anything about it — sometimes after the travel was undone —
  // and read back as "the page changed" it would start a second travel nobody
  // asked for, over pictures that are already showing something else.
  const pageAskedForRef = useRef(null);
  // What a press stopped in flight, until the gesture says what it is about.
  const caughtAtPressRef = useRef(null);
  // The latest way to answer a gesture, for a watcher that outlives every
  // render (see the wheel effect below).
  const travelHandlersRef = useRef(null);
  const pointerDownRef = useRef(null);

  const pagesFromChildren = useMemo(
    () => collectRoutePages(children),
    [children],
  );
  const pagesFromProp = useMemo(
    () => routesProp && routesProp.map(normalizePage),
    [routesProp],
  );
  const pages = pagesFromProp || pagesFromChildren;

  // Which page is on screen, read from the pages themselves: every one of them
  // is read, so this re-renders when any of them starts or stops matching — and
  // for a row whose tabs are params of one route, when the params move from one
  // tab to the next (see pageIsCurrent).
  const currentIndex = currentPageIndex(pages);
  // The page that was on screen when the change now happening was asked for:
  // a travel is between two of them, and by the time anything renders the first
  // one is already gone. Written after each render (below), so a subscriber
  // reading it — they all run before Preact flushes — reads the one being left.
  const currentIndexRef = useRef(currentIndex);

  // Where a page is asked for, whoever asks: a page is a route AND the params
  // that say which of its tabs, and a caller told only the route would send the
  // row back to whichever tab the URL already says (see redirectTo).
  const travelTo = (page, cause) =>
    onTravel({ route: page.route, params: page.params, cause });

  // One travel, whoever asked for it: a finger, a tab pressed, the browser's
  // own back button. What differs is only who moves it — the finger drives it
  // frame by frame (`scrub`), everything else lets it play.
  const beginTravel = ({ page, fromPage, direction, scrub, change }) => {
    const travel = {
      page,
      // The page this set off from, kept rather than looked up again: the URL
      // changes at the first pixel, so a moment later nothing on screen
      // remembers where it started.
      fromPage,
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
    // Taken before the picture is: the browser reads the name off the DOM as it
    // stands when the transition starts, and this box is only a picture of its
    // own for as long as it is the one travelling.
    nameForTravel(elementRef.current);
    document.documentElement.setAttribute(TRAVEL_ATTRIBUTE, direction);
    document.documentElement.setAttribute(TRAVEL_AXIS_ATTRIBUTE, axis);
    if (scrub) {
      holdPictures(travel);
      document.documentElement.setAttribute(DRAGGED_ATTRIBUTE, "");
    }
    pageAskedForRef.current = page;
    // The box as it stands before anything moves: rendering is held, so this is
    // still the page being left (see holdTravelGeometry).
    const rectBefore = elementRef.current.getBoundingClientRect();
    // The hold a navigation already took, if this travel is the answer to one:
    // taking another would be taking a hold on a page that is holding still.
    const releaseRendering = takeoverRoutingRenderingHold();
    // The picture the browser is about to take must be of the page that was
    // asked for, and a route matching is not yet a page rendered. Watched from
    // here rather than from inside the callback below: the browser calls that
    // callback a frame later, and a navigation that has already been decided
    // (what follows a send, a command) renders its page in between. A wait
    // armed then waits for something that has already happened — until the
    // browser gives up on the transition, leaving the page it was leaving on
    // screen and an error nobody asked for.
    const renderWait = armRouteRenderWait();
    const viewTransition = startViewTransition(async () => {
      // Whatever is awaited here must be able to resolve without the page being
      // rendered: the document is frozen for the whole of this callback, and a
      // frame never comes — waiting for one waits until the browser gives up on
      // the transition. And it stays frozen exactly this long, so this is also
      // the shortest thing there is to keep short.
      await whilePageRenders(
        page,
        async () => {
          releaseRendering();
          if (change) {
            await change();
          }
        },
        renderWait,
      );
      // The page arriving is in the DOM and the transition has not started
      // playing: the one moment both boxes can be known.
      holdTravelGeometry(elementRef.current, rectBefore);
    });
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
      renderWait.stop();
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
  // The transition is started from what the router SAYS rather than from a
  // render, because a render is one flush too late — by then the DOM holds the
  // new page and the picture of the old one cannot be taken anymore.
  //
  // Watched as a position in the row rather than route by route. A route
  // announces its own status, and the row's tabs can all be one route: the
  // announcement then says a section changed without saying which is on screen,
  // and it says it about things this row does not move for (a route that has
  // now been visited, a param of its own that is not a tab of this row). Worse,
  // a status is published from inside the routing and the params it carries are
  // the ones known at that instant — a section that lands as a signal settles
  // is announced late, or not at all. The signals ARE the position, so the
  // position is read from them: one computed over the whole row, notified once
  // per move, whichever route moved and whether by matching or by params.
  useLayoutEffect(() => {
    const currentIndexSignal = computed(() => currentPageIndex(pages));
    const onRowMove = (index) => {
      if (index === -1) {
        return;
      }
      if (index === currentIndexRef.current) {
        // Where the row already was — the first reading of all, and any move
        // this box has already taken note of (a render writes it too). What it
        // was still waiting for is here nonetheless, so the wait is called off.
        if (samePage(pageAskedForRef.current, pages[index])) {
          pageAskedForRef.current = null;
        }
        return;
      }
      const page = pages[index];
      // A page this box asked for itself — a travel's own navigation, or one
      // it had given up waiting on: what arrives here is the answer to a
      // question already answered, not somebody going somewhere.
      if (samePage(pageAskedForRef.current, page)) {
        pageAskedForRef.current = null;
        currentIndexRef.current = index;
        return;
      }
      // Somewhere else arrived first: whatever this box was still waiting for
      // is not coming, or no longer means anything. Forgotten here rather
      // than kept, or the next press on that very tab would be taken for the
      // late answer to a question nobody remembers asking.
      pageAskedForRef.current = null;
      // Asked for a page while one was already on its way: the travel in
      // flight is the answer, aimed somewhere else. Starting a second one on
      // top would leave this one's pictures to be dropped mid-slide.
      if (travelRef.current) {
        currentIndexRef.current = index;
        retargetTravel(travelRef.current, page);
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
        page,
        fromPage: pages[fromIndex],
        direction: index > fromIndex ? "forward" : "back",
        scrub: false,
      });
    };
    // `subscribe` rather than `effect`: it hands the value to a callback that
    // is NOT being tracked, and what this one does — navigate, ask the router
    // for another page — reads and writes the very signals the row is watched
    // through.
    return currentIndexSignal.subscribe(onRowMove);
  }, [pages]);

  // Rendering is held for the length of a navigation, so that whatever picture
  // this box is about to take is of the page being LEFT (see
  // rendering_hold.js).
  useLayoutEffect(() => {
    const stopWatchingStart = observeBeforeRouting(holdRenderingForRouting);
    // Nobody may have had a picture to take: this navigation is not always one
    // this box travels. Whoever wanted the hold took it over (beginTravel)
    // while the change was being applied, and left nothing here.
    const stopWatchingEnd = observeAfterRouting(releaseRoutingRenderingHold);
    return () => {
      stopWatchingStart();
      stopWatchingEnd();
    };
  }, []);

  // What the next announcement will compare itself against: written after the
  // render that shows it, so it is always the page one is looking at.
  useLayoutEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Let go of far enough: the movement carries on from under the finger, at its
  // own pace, to the end.
  const finishTravel = (travel) => {
    // Nobody is driving it anymore. `scrub` is who MOVES the pictures, not what
    // set them off: left standing after the release, this travel would go on
    // claiming a hand that is no longer there — and everything that asks
    // "is somebody holding this?" before touching it (a press on the tab one
    // came from, a wheel push) would be answered yes and do nothing, while the
    // pages carry on to a page the router has already left.
    travel.scrub = false;
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
    // A revert somebody ASKED for — a press on the tab this travel came from —
    // has a problem the others do not: that page is already back, and the
    // picture being brought in is LIVE, so it shows the page one is going back
    // to. Both sides then show the same thing and the way back is invisible:
    // one presses, and one is simply there.
    //
    // So the pages are held where they are until the pictures have finished
    // going back. Only the pages: unlike the hold a navigation takes to have
    // its picture taken, nothing is being photographed here — everything else
    // may go on rendering, and a tab row beside the box keeps answering.
    const releaseRendering = freezeRouteRender();
    const animations = travelAnimations(travel);
    // The way back is paid for in DISTANCE, not in time. The way in is eased:
    // at half of its TIME the pictures have covered ~80% of their distance, so
    // a travel caught "half-way" by the eye has barely begun by the clock.
    // Rewound at -1 it plays those few milliseconds back through the steep end
    // of the curve — nearly the whole visible distance collapses into two
    // frames, and what one sees is a snap, not a return. So the pictures are
    // walked home over `how far they LOOK from home`, at the travel's own
    // pace, each animation at the rate that gets it there in that time.
    const wallTime = revertWalkTime(animations);
    for (const animation of animations) {
      const timeLeft = animation.currentTime;
      const rate = wallTime > 17 && timeLeft > 0 ? -(timeLeft / wallTime) : -1;
      // updatePlaybackRate, never the playbackRate setter: these animations
      // run on the compositor, and the setter is a non-seamless change there —
      // on screen the pictures jump straight to their end state while the
      // Animation object ticks backwards unseen. What one sees then is the
      // travel SNAPPING home instead of returning, and no reading of
      // getAnimations() will say so: only the compositor knows, and
      // updatePlaybackRate is how a new rate is handed to it in flight.
      animation.updatePlaybackRate(rate);
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
        pageAskedForRef.current = travel.fromPage;
        // The page that was left is put back UNDER the picture before the
        // picture is dropped, so the two are the same thing at the moment they
        // are swapped: that only holds once the page is really back.
        if (pageIsCurrent(travel.fromPage)) {
          // It never left: the press that set this revert off put it back
          // there, and the pages have been held where they were until now.
          // Nothing to ask for, and nothing to wait for — waiting anyway is a
          // render that never comes and a page frozen under its own pictures.
          releaseRendering();
        } else {
          await whilePageRenders(travel.fromPage, () =>
            onTravel({
              route: travel.fromPage.route,
              params: travel.fromPage.params,
              cause: "revert",
            }),
          );
        }
        travel.viewTransition.skipTransition();
      } finally {
        releaseRendering();
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

  // The same travel, aimed at another page. The still it starts from does not
  // change — only what is being brought in against it, and that one is LIVE:
  // pointing the router elsewhere is all it takes for the picture to show that
  // page instead.
  const redirectTravel = (travel, page, direction) => {
    travel.page = page;
    // Everything the transition carries that is NOT the pages was measured
    // against a destination this travel is no longer going to (see the CSS).
    document.documentElement.setAttribute(TURNED_ATTRIBUTE, "");
    if (direction === travel.direction) {
      // Same way, another page: the pictures in hand are already the right
      // pair, and nothing has to move.
      return;
    }
    travel.direction = direction;
    travel.ratio = 0;
    // The other way round is another pair of keyframes, and naming another
    // animation builds another Animation: whatever was collected answers to
    // nobody now. They start again from the beginning, which is where a travel
    // that turns around is.
    travel.animations = null;
    document.documentElement.setAttribute(TRAVEL_ATTRIBUTE, direction);
  };

  // Somebody asked for a page while one was on its way. Where they asked for
  // decides what that means.
  const retargetTravel = (travel, page) => {
    if (travel.scrub || travel.reverting || travel.ended || travel.noPicture) {
      // A hand is holding the pages, or they are already on their way back:
      // either way this travel's end is decided by somebody else.
      return;
    }
    if (samePage(page, travel.page)) {
      // Already on its way there.
      return;
    }
    if (samePage(page, travel.fromPage)) {
      // Back where it set off from: that is not another travel, it is this one
      // undone — the same pictures, run backwards.
      revertTravel(travel);
      return;
    }
    const fromIndex = pageIndexOf(pages, travel.fromPage);
    const toIndex = pageIndexOf(pages, page);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    redirectTravel(travel, page, toIndex > fromIndex ? "forward" : "back");
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
      // Given back, so another box may wear it: kept, two of them on a page
      // would both answer to it and the browser refuses the whole transition
      // rather than pick.
      unnameAfterTravel(elementRef.current);
      document.documentElement.removeAttribute(TRAVEL_ATTRIBUTE);
      document.documentElement.removeAttribute(TRAVEL_AXIS_ATTRIBUTE);
      document.documentElement.removeAttribute(DRAGGED_ATTRIBUTE);
      document.documentElement.removeAttribute(TURNED_ATTRIBUTE);
      releaseTravelGeometry();
    }
  };

  // What a gesture is about, whichever hand made it: a thumb dragging the page
  // and two fingers pushing it sideways on a trackpad ask for the same travel,
  // so they are answered by the same three callbacks and only the reading of
  // the input differs (see drag_to_travel.js).
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
      const page = sign > 0 ? pages[currentIndex - 1] : pages[currentIndex + 1];
      if (
        !page ||
        !size ||
        scrollRoomTowards(target, elementRef.current, axis, sign)
      ) {
        return false;
      }
      if (CAN_KEEP_PICTURE) {
        beginTravel({
          page,
          fromPage: pages[currentIndex],
          direction: sign > 0 ? "back" : "forward",
          scrub: true,
          change: () => travelTo(page, "drag"),
        });
      } else {
        travelRef.current = { page, noPicture: true, ended: false };
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
        const fromIndex = pageIndexOf(pages, travel.page);
        const page =
          direction === "back" ? pages[fromIndex - 1] : pages[fromIndex + 1];
        if (fromIndex === -1 || !page) {
          return false;
        }
        // At their very end before they are let go of: what ends the travel in
        // hand is the next transition starting (there is one per document, and
        // the funnel skips ours), and a picture skipped short of its end is a
        // page seen jumping the last few pixels.
        scrubTravel(travel, 1);
        travel.ratio = 1;
        beginTravel({
          page,
          fromPage: travel.page,
          direction,
          scrub: true,
          change: () => travelTo(page, "drag"),
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
      const fromIndex = pageIndexOf(pages, travel.fromPage);
      const page =
        direction === "back" ? pages[fromIndex - 1] : pages[fromIndex + 1];
      if (fromIndex === -1 || !page) {
        return false;
      }
      redirectTravel(travel, page, direction);
      pageAskedForRef.current = page;
      travelTo(page, "drag");
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
          travelTo(travel.page, "drag");
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
    // A press that never became a gesture: whatever it stopped goes on its way,
    // from where the finger caught it.
    const giveUp = () => {
      gestureRef.current = null;
      const caught = caughtAtPressRef.current;
      caughtAtPressRef.current = null;
      if (caught && !caught.ended) {
        releaseHold(caught);
      }
    };
    const gesture = startDragToTravel(pointerDownEvent, {
      element: elementRef.current,
      axes: axis,
      // Caught in flight: the hand is already in the gesture (see above), so it
      // is answered from its first pixel, on the axis the pages travel.
      immediate: caughtAtPressRef.current ? axis : false,
      ...travelHandlers,
      onGiveUp: giveUp,
    });
    if (!gesture) {
      // Not a press this box can be about — something that reads the pointer
      // itself, a box below it that travels the same way.
      giveUp();
      return;
    }
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
    const fromPage = travelInFlight ? travelInFlight.page : pages[currentIndex];
    const fromIndex = pageIndexOf(pages, fromPage);
    if (fromIndex === -1) {
      return;
    }
    const page = sign > 0 ? pages[fromIndex - 1] : pages[fromIndex + 1];
    if (!page) {
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
      page,
      fromPage,
      direction: sign > 0 ? "back" : "forward",
      scrub: false,
      change: () => travelTo(page, "wheel"),
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
      // page (see drag_to_travel.js).
      data-drag-travel={travelByDrag ? axis : undefined}
      // The same fact said once per gesture, and for the other question the
      // DOM answers: a box that travels INSIDE this one — a row of slides in a
      // page — takes the axis it walks, and these are what it reads to know
      // this box walks it too.
      data-travel-by-drag={travelByDrag ? axis : undefined}
      data-travel-by-wheel={travelByDrag ? axis : undefined}
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

// The two boxes of a travel, measured at the one moment both exist: the
// arriving page is in the DOM and the transition has not started playing.
//
// The group stands at the ARRIVING box — its own animation is dropped, so it
// takes the geometry the browser declared for it and holds it for the whole
// travel. That is why both rectangles have to be published: a group that does
// not move says nothing about where the page being left was, and its rectangle
// in the window is the only thing CSS cannot work out on its own.
const holdTravelGeometry = (element, rectBefore) => {
  const rectAfter = element.getBoundingClientRect();
  // The height it is held at is the taller of the two boxes, so neither picture
  // is ever cut. It cannot be measured from one side alone: a page arriving
  // shorter than the one it replaces would cut the one leaving, a page arriving
  // taller would be cut itself.
  const height =
    rectBefore.height > rectAfter.height ? rectBefore.height : rectAfter.height;
  const { style } = document.documentElement;
  style.setProperty(TRAVEL_TOP_PROPERTY, `${rectAfter.top}px`);
  style.setProperty(TRAVEL_LEFT_PROPERTY, `${rectAfter.left}px`);
  style.setProperty(TRAVEL_WIDTH_PROPERTY, `${rectAfter.width}px`);
  style.setProperty(TRAVEL_HEIGHT_PROPERTY, `${height}px`);
  style.setProperty(TRAVEL_OLD_TOP_PROPERTY, `${rectBefore.top}px`);
  style.setProperty(TRAVEL_OLD_LEFT_PROPERTY, `${rectBefore.left}px`);
};
// The live layout takes the box back. A discontinuity by construction — the
// group stands at the held height, the box is at the new one — and an invisible
// one: the page arriving is fully in place, and the strip below it that the
// group still covers shows the page leaving only while it is still on screen.
const releaseTravelGeometry = () => {
  const { style } = document.documentElement;
  for (const property of TRAVEL_GEOMETRY_PROPERTIES) {
    style.removeProperty(property);
  }
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

// CSS `ease`, evaluated: time in, distance out. Solved numerically because
// the curve is parametric — two cubics sharing a parameter, with no closed
// form for one against the other. Twenty halvings put the answer well under
// a pixel of a screen-wide travel.
const CSS_EASE = [0.25, 0.1, 0.25, 1];
const bezierAxis = (s, a, b) =>
  3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
const easedProgress = (x, [x1, y1, x2, y2]) => {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (bezierAxis(mid, x1, x2) < x) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return bezierAxis((low + high) / 2, y1, y2);
};

// How long the way back should take: the distance the pictures visibly are
// from home, converted to time at the travel's own pace. The distance is
// computed from the clock THROUGH the easing curve, never read off the
// pseudo-elements: getComputedStyle on them answers with the un-animated
// value — the animated one lives on the compositor, where no reading from
// here reaches (the same trap as the playbackRate setter above).
const revertWalkTime = (animations) => {
  const animation = animations.find((candidate) =>
    candidate.effect?.pseudoElement?.includes("navi-route-travel"),
  );
  if (!animation) {
    return 0;
  }
  const timing = animation.effect.getComputedTiming();
  const duration = timing.delay + timing.activeDuration;
  if (!duration) {
    return 0;
  }
  const temporal = animation.currentTime / duration;
  // The easing sits on the keyframes, where a CSS animation's
  // animation-timing-function ends up. "ease" is what our travels play;
  // anything else (linear under a finger, see the DRAGGED attribute) maps
  // time to distance one for one.
  const easing = animation.effect.getKeyframes()[0]?.easing;
  const visibleRatio =
    easing === "ease" ? easedProgress(temporal, CSS_EASE) : temporal;
  return visibleRatio * duration;
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

// A page change, carried out and then waited for until the page it selects is
// really on screen. The container doing the swapping is the only one who knows
// when that is (observeRouteRender): a route matching is a signal changing, and
// how many passes Preact takes to answer it is its own business.
//
// Nothing is waited for when the change did not take — a route refused, a
// redirect somewhere else. There is no page on its way then, and this runs
// inside the callback of a view transition: the browser has stopped rendering
// and is waiting on this very promise to take its picture, so a wait that never
// ends is a page frozen under a transition that never became ready.
// Listening starts before the change, or a render landing while the change is
// being awaited is a render nobody heard. Armed apart from the wait itself
// because the two do not always happen at the same moment: a view transition
// calls its update callback a frame after it is started, and the render can
// land in that gap — see beginTravel, which arms this the moment the travel is
// decided and hands it over.
const armRouteRenderWait = () => {
  let stopListening;
  const rendered = new Promise((resolve) => {
    stopListening = observeRouteRender(resolve);
  });
  return { rendered, stop: () => stopListening() };
};

const whilePageRenders = async (page, change, wait = armRouteRenderWait()) => {
  try {
    await change();
    if (pageIsCurrent(page)) {
      await wait.rendered;
    }
  } finally {
    wait.stop();
  }
};

// A page of the row: a route, and the params that say which of its tabs when
// several of them share it. Written as a bare route by a caller whose tabs are
// routes of their own — which is the same page with nothing to tell apart.
const normalizePage = (page) =>
  page.isRoute ? { route: page, params: undefined } : page;

// Two pages are the same page when they select the same thing, not when they
// were written by the same hand: the params of a tab are a literal in JSX, so
// every render builds another object for what is plainly the same tab.
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

// Whether this page is the one on screen. `matchesParams` reads paramsSignal,
// so a caller reading this during a render is subscribed to the param changes
// that walk from one tab to the next — matchingSignal alone never moves there,
// and a row whose tabs are params of one route would never re-render.
//
// The params are read only for a route that matches, and that is not a signal
// left unread: a reader wakes on anything it read last time, so what matters is
// that everything able to make this answer change is among them.
// matchingSignal is read whatever happens, and it is a NECESSARY condition —
// while it is false no param of that route can put this page on screen, and the
// day one could, matchingSignal itself has to turn true to say so, which is the
// read that brings the params back in. (Asking anyway would be worse than
// useless: the params of a route that does not match are not params.)
const pageIsCurrent = ({ route, params }) => {
  if (!route.matchingSignal.value) {
    return false;
  }
  return params ? route.matchesParams(params) : true;
};
// The FIRST page that answers, as with the branches of a <Route>: several
// routes match at once — a literal one and the parameterized one it is a case of
// ("/games/new" is also a "/games/:gameId"), a section and the page inside it —
// and the row has to be on the page the router is showing, which is the first
// one written that matches.
//
// Every page is read all the same, never only up to the one that answers yes: a
// page that is not the current one today is the one that must wake the reader
// tomorrow.
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

// A transition skipped by another one starting is an outcome, not a failure.
const ignoreSkipped = () => {};

// The name is lent to the box that is travelling and taken back afterwards.
// There is one transition in a document at a time, so one box wears it at a
// time — and the others, unnamed, are simply not captured: they stay live
// under the pictures rather than being frozen with the page.
const nameForTravel = (element) => {
  element.style.viewTransitionName = TRAVEL_NAME;
};
const unnameAfterTravel = (element) => {
  element.style.viewTransitionName = "";
};
