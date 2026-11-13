/**
 * Pushing from one route to the next, when the tabs of a page are URLs.
 *
 * A hand is the browser's: the box holds a row it scrolls, with one snap point per
 * page, so a touch, a trackpad and a wheel are followed on the compositor and read
 * by what knows what a page cannot be told. What is left to do here is read where
 * the row stands and when it has come to rest, and keep the address in step.
 *
 * The router mounts the branch that matches the URL and nothing else, which is
 * what makes a page shareable and reloadable. A row shows two pages at once, so
 * something has to give, and what it is depends on what the row is made of:
 *
 *   <Route> children   one pane per route. A page is built when its route first
 *                      matches, since a route's actions only ask while it does, and
 *                      stays once built (RouteRowContainer in route.jsx): a hand
 *                      brings back the page itself. Before that its pane holds only
 *                      what `renderNeighbour` says, if anything, so the address
 *                      moves as soon as the hand has really pulled towards it, and
 *                      the page fills in under the finger. A pane already built
 *                      waits for the hand to let go, or for the landing of a hand
 *                      no browser says has let go (a trackpad).
 *   `routes` prop      a window over something longer, where several pages are often
 *                      one route with other params: the same component, so there
 *                      can only be one. It stands in the pane of the address, and
 *                      what the hand leaves behind is a PICTURE of it, a clone in
 *                      the pane it was in. The address moves as soon as the hand
 *                      has really pulled, as above. Until then the pane of a
 *                      neighbour holds what `renderNeighbour` says, if anything.
 *
 * Either way a page the hand brings is built under the finger. What it reads can be
 * asked for before (`prefetch`); the page itself cannot be built before: its state
 * reads the address, and a second one built ahead would read the page on screen.
 *
 * What reads the URL may therefore read where the hand is heading. Where the reader
 * still is, is routeTravelSettledPageSignal (route_travel_hold.js), which a link
 * reads by itself.
 *
 * The document goes on scrolling when that is what the page does. A horizontal
 * scroller cannot let the other axis through (overflow-x: auto makes overflow-y
 * something else than visible), so the row is a scroll container that never moves
 * vertically and grows with the page on screen. A page brought in stands where the
 * reader is looking (see pinning below). The price: `position: sticky` inside the
 * row sticks to the row, which never scrolls, so it never sticks. A row with fewer
 * than two pages is not a scroller at all, for that reason.
 *
 * A travel nobody's hand is on (a tab pressed, the back button) is one box long
 * however far the page is (travelRowTo), in `duration` on SlideContainer's curve,
 * the scroll position written at every frame (playTravel), after ending a snap a
 * hand has left running (takeRowFromHand). Whatever else follows, the trait under a
 * tab bar first, follows the row through route_row_follow.js.
 */

import { useLayoutEffect, useMemo, useReducer, useRef } from "preact/hooks";

import { getScrollContainer } from "@jsenv/dom";
import { observeBeforeRouting } from "./browser_integration/before_routing.js";
import {
  arriveAtScrollPosition,
  suspendScrollRecording,
} from "./browser_integration/scroll_restoration.js";
import {
  collectRoutePages,
  RouteRowContext,
  RouteRowNeighbour,
} from "./route.jsx";
import { notePageChange } from "./page_change.js";
import { whenPageReadsAnswered } from "./route_action.js";
import { pageIsAt, pageIsCurrent } from "./route_page.js";
import { publishRouteRowMove } from "./route_row_follow.js";
import {
  followPageOnScreen,
  holdPage,
  releaseHeldPage,
} from "./route_travel_hold.js";
import {
  pageAtRest,
  readRowStretch,
  restsOn,
  watchRowScroll,
} from "../layout/native_row_scroll.js";
import { afterPaint } from "../utils/after_paint.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import {
  CSS_EASE,
  CSS_EASE_OUT,
  durationToMs,
  easedProgress,
} from "../utils/css_timing.js";

const css = /* css */ `
  /* Written on what reads them (pinPanes, holdRowAt), not on the row: inherited,
     they would restyle every element of the pages as a movement begins. */
  @property --navi-route-row-pin {
    syntax: "*";
    inherits: false;
  }
  @property --navi-route-row-stand {
    syntax: "*";
    inherits: false;
  }

  /* A column: the height given to the box reaches the row. */
  .navi_route_travel {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  /* A scroller of its own, inside the box: a box may be told what it is by the
     application around it, which must not decide which way the panes run. */
  [data-route-travel-row] {
    position: relative;
    display: grid;
    min-width: 0;
    min-height: 0;
    flex: 1 1 auto;
    grid-auto-columns: 100%;
    grid-auto-flow: column;
    grid-template-rows: minmax(0, 1fr);
    overflow-x: auto;
    overflow-y: hidden;
    overflow-anchor: none;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
    /* Nobody's hand: it still scrolls when told to, by a tab pressed. */
    &[data-route-travel-row="code"] {
      overflow-x: hidden;
    }
    /* One page: nothing to scroll between, and no reason to catch what sticks. */
    &[data-route-travel-row="still"] {
      overflow: visible;
    }
    /* A travel asked for plays (playTravel): a scroll position written at every frame
       is snapped by the browser, and the places on the way are no places to stop. */
    &[data-route-row-travelling] {
      scroll-snap-type: none;
    }
    /* A tab pressed over a row a hand has left moving (see takeRowFromHand): no
       scroller for the two frames the compositor takes to hear it, which is what
       ends a snap in Chrome, and the picture held where the scroll position had it.
       Offsets, for the same reason as the pin below: a transform would capture what a
       page holds in position: fixed. */
    &[data-route-row-taken] {
      overflow: clip;

      > [data-route-row-pane],
      > [data-route-row-live],
      > [data-route-row-pictures] > * {
        position: relative;
        left: var(--navi-route-row-stand);
      }
    }

    > [data-route-row-pane] {
      display: flex;
      min-width: 0;
      min-height: 0;
      flex-direction: column;
      grid-row: 1;
      scroll-snap-align: start;
      /* One stroke does not skip a page it can stop on. */
      scroll-snap-stop: always;
    }
    /* A pane brought in stands where the reader is looking, and does not make the
       document taller than the page on screen does, when the document is what
       scrolls. Nothing changes for a row that fits a box of its own.
       It paints at rest, as the placeholder below does: the compositor moves the
       row before any scroll event reaches us, and a page waiting for one to show
       comes in a few frames late, behind an empty strip. contain: what it holds in
       position: fixed is held in its pane, and rides in with it, rather than
       standing over the page shown.
       The page on screen is the address's at rest. A movement keeps the one the row
       rested on as it began (data-route-row-held) until the row rests again, wherever
       the address goes meanwhile: a hand's or a travel asked for, the page arriving
       rides in with what it holds, and the layout changes once, at rest.
       The row says it holds one (data-route-row-holding): a :has() over its panes
       would restyle every element of the row each time the held pane changes. */
    > [data-route-row-pane][inert]:not([data-route-row-held]),
    &[data-route-row-holding]
      > [data-route-row-pane]:not([data-route-row-held]) {
      position: relative;
      top: var(--navi-route-row-pin, 0);
      contain: paint;
      max-height: 100dvh;
      overflow: clip;
    }
    /* What stands in the pane of a neighbour until its page does. Out of flow: the
       height of the row stays the page's. */
    > [data-route-row-pane] > [data-route-row-neighbour] {
      position: absolute;
      inset: 0;
      display: flex;
      contain: layout paint;
      flex-direction: column;
    }

    /* The page of a window over something longer, in the pane of the address: a
       pane only gives the row a place to stop. */
    > [data-route-row-live] {
      position: relative;
      display: flex;
      min-width: 0;
      min-height: 0;
      flex-direction: column;
      grid-row: 1;
    }
    > [data-route-row-pictures] {
      display: contents;
    }
    /* What it left behind. contain: what it holds in position: fixed is its own,
       and does not stand over the page. */
    > [data-route-row-pictures] > * {
      contain: layout paint;
      min-width: 0;
      grid-row: 1;
      pointer-events: none;
    }
  }
`;

// How far a hand must have pulled before the address moves for a page that is not
// there yet: past what a hand that only shook covers, so that a shake costs
// neither a navigation nor the requests of a page.
const SET_OFF_PULL = 16;
// A row of routes is one line, whatever `offsetTop` its pinned panes read (see the pin
// above): they are on it all the same.
const ROW_READING = { sideways: true };
// How far a scroll position written can read back from what was written: rounded to
// the device's pixels.
const WRITE_ROUNDING = 1;
// The most one frame of a travel plays: a frame of a 30fps screen, which is what a
// browser saving power gives (an iPhone in Low Power Mode, Chrome's Energy Saver).
// A frame later than that is a main thread busy elsewhere (the page arriving builds,
// a list fills its budget), and the travel takes longer rather than jump by it. Not a
// frame of a 60Hz screen: that would play every travel in slow motion at 30fps.
const TRAVEL_FRAME_MAX_MS = 1000 / 30;

/**
 * @type {import("preact").FunctionComponent<{
 *   routes?: Array<object|{route: object, params?: object}>,
 *   travelByDrag?: boolean,
 *   onTravel?: (detail: {route: object, params: object|undefined, cause: string}) => void|Promise<void>,
 *   renderNeighbour?: (page: {route: object, params: object|undefined}) => import("preact").ComponentChildren,
 *   prefetch?: boolean,
 *   duration?: string,
 * }>}
 * @param {Array<object|{route: object, params?: object}>} [props.routes] - a window
 *   over something longer, in order. Read from the <Route> children by default,
 *   in the order they are written. Given here, the children are one page rendered
 *   once, whatever the address, and may be anything: use it when the pages are one
 *   route with other params, or not children of this box. An entry is a route, or
 *   `{ route, params }`.
 * @param {boolean} [props.travelByDrag=true] - whether a hand travels. Off where the
 *   gesture belongs to the content; a tab pressed still does.
 * @param {(detail: {route: object, params: object|undefined, cause: "drag"}) => void|Promise<void>} [props.onTravel]
 *   - how to go to a page a hand has brought in. The default REPLACES the current
 *   history entry rather than pushing one: a swipe is how one browses a page, not a
 *   place one aimed at, and three swipes back and forth must not bury the way out
 *   of the page under six entries. A tab pressed goes the way its <Link> says —
 *   `<Link replace>` for a row of tabs, so a press and a swipe towards the same
 *   neighbour write the same history.
 * @param {(page: {route: object, params: object|undefined}) => import("preact").ComponentChildren} [props.renderNeighbour]
 *   - what stands in the pane of a page next to the one on screen, until the hand
 *   has pulled far enough to bring that page: its background, its skeleton, what the
 *   list already knows. A `<Route>` page already built shows itself. Receives
 *   `{ route, params }`, or the entry of `routes` as it was given, and is a column
 *   the height of the row, as the page is. Its route does not match while it stands
 *   there: what it reads is not asked for.
 * @param {boolean} [props.prefetch=false] - whether the pages on each side of the one
 *   on screen have their reads asked for ahead of the hand: at rest, once the page on
 *   screen has its answers and has painted them, the next page first, each with
 *   `route.preload(params)`. A swipe then builds a page whose answers are already
 *   there, with no wait to show. Off by default: every page one stops on costs the
 *   reads of two more.
 * @param {string} [props.duration="300ms"] - how long a travel asked for takes: a
 *   tab pressed, the back button. One box, on the curve a SlideContainer plays, so
 *   two rows of tabs in one app move alike. A hand goes at its own pace.
 *
 * Every other prop lands on the box itself (`id`, `data-testid`, `className`, …).
 * The box has to outlive every page of its row: around those <Route>s, or around
 * one <Route> whose params are the tabs, never inside one of the pages.
 */
export const RouteTravel = ({
  routes: routesProp,
  travelByDrag = true,
  onTravel = ({ route, params }) =>
    route.navTo(params, { replace: true, routeTransition: "none" }),
  renderNeighbour,
  prefetch = false,
  duration = "300ms",
  className,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const rowRef = useRef();
  const liveRef = useRef();
  const picturesRef = useRef();
  const windowed = Boolean(routesProp);
  // Counts the movements ended: endMovement renders through it.
  const [restCount, render] = useReducer((count) => count + 1, 0);

  const pagesFromChildren = useMemo(
    () => collectRoutePages(children),
    [children],
  );
  const pagesFromProp = useMemo(
    () => routesProp && routesProp.map(normalizePage),
    [routesProp],
  );
  // Held while the row moves: a window recentred under a hand would move the very
  // panes it is pushing. It is taken as soon as the row has stopped.
  const pagesAsked = pagesFromProp || pagesFromChildren;
  const movementRef = useRef(null);
  const pagesRef = useRef(pagesAsked);
  if (!movementRef.current) {
    pagesRef.current = pagesAsked;
  }
  const pages = pagesRef.current;
  const currentIndex = currentPageIndex(pages);
  // Where the page of a window stands: the address, or where it last was for an
  // address the row has no place for, while the row still has that column.
  const liveIndexRef = useRef(0);
  if (currentIndex !== -1) {
    liveIndexRef.current = currentIndex;
  } else if (liveIndexRef.current >= pages.length) {
    // Past the row's end the page stands in a column of its own, off screen: a
    // still row does not scroll, and nothing scrolls a row to an address it lacks.
    liveIndexRef.current = pages.length === 0 ? 0 : pages.length - 1;
  }
  const liveIndex = liveIndexRef.current;
  const latestRef = useRef(null);
  latestRef.current = {
    pages,
    currentIndex,
    liveIndex,
    onTravel,
    travelByDrag,
    durationMs: durationToMs(duration),
  };

  // The page this box asked for: routing lands later, and read back as somebody
  // changing the address it would send the row where the hand already is.
  const askedPageRef = useRef(null);

  const panesOf = (row) =>
    Array.from(row.children).filter((child) =>
      child.hasAttribute("data-route-row-pane"),
    );
  const pathOf = ({ route, params }) =>
    new URL(route.buildUrl(params), window.location.href).pathname;

  // The pane laid out as the page on screen for the length of a movement, let go of
  // when the row rests. Not what readers are told the page held is
  // (route_travel_hold.js): that follows the hand, and goes at its lift.
  const heldPaneRef = useRef(null);
  const releasePaneAtRest = (row) => {
    const heldPane = heldPaneRef.current;
    if (heldPane) {
      heldPaneRef.current = null;
      heldPane.removeAttribute("data-route-row-held");
      row.removeAttribute("data-route-row-holding");
    }
  };

  // How far down the reader is looking, on every pane, for those the CSS pins.
  const pinPanes = (row) => {
    const pin = `${pinOf(row)}px`;
    for (const pane of panesOf(row)) {
      pane.style.setProperty("--navi-route-row-pin", pin);
    }
  };
  const unpinPanes = (row) => {
    for (const pane of panesOf(row)) {
      pane.style.removeProperty("--navi-route-row-pin");
    }
  };

  // One movement, whoever set it off, from the first thing that moves to the row
  // at rest. Null when nothing moves. `paneAtRest` is the pane the row rests on as it
  // begins: laid out as the page on screen until the row rests again, wherever the
  // address goes meanwhile (see the CSS).
  const beginMovement = (fields, paneAtRest) => {
    const row = rowRef.current;
    if (movementRef.current) {
      Object.assign(movementRef.current, fields);
      return movementRef.current;
    }
    const movement = {
      travelling: false,
      playing: null,
      pictures: new Map(),
      resumeScrollRecording: null,
      scrollsDocument: rowFollowsDocument(row),
      ...fields,
    };
    movementRef.current = movement;
    // In a window the page is a picture, contained with what it holds.
    if (!windowed && paneAtRest) {
      heldPaneRef.current = paneAtRest;
      paneAtRest.setAttribute("data-route-row-held", "");
      row.setAttribute("data-route-row-holding", "");
    }
    if (movement.scrollsDocument) {
      // Whatever the browser does with the offset meanwhile (clamping it to a page
      // shorter than the trip) is not the reader scrolling, and the address it
      // would be written against may already be another page's.
      movement.resumeScrollRecording = suspendScrollRecording();
      pinPanes(row);
    }
    return movement;
  };

  // A clone of the page in the pane it stands in, before anything changes it. In
  // that pane and the same height: the row keeps its size, so the document its
  // offset, and the page one looked at is where it was.
  const leavePictureOfLive = (movement) => {
    const live = liveRef.current;
    const index = latestRef.current.liveIndex;
    const picture = live.cloneNode(true);
    picture.removeAttribute("data-route-row-live");
    picture.setAttribute("inert", "");
    picture.setAttribute("aria-hidden", "true");
    picture.style.gridColumn = String(index + 1);
    picture.style.top = "";
    movement.pictures.get(index)?.remove();
    movement.pictures.set(index, picture);
    // After the live page in the document: an id it holds still finds the page.
    picturesRef.current.append(picture);
    copyScrollPositions(live, picture);
    if (movement.scrollsDocument) {
      live.style.top = `${pinOf(rowRef.current)}px`;
    }
  };

  const askFor = (page) => {
    const { onTravel } = latestRef.current;
    askedPageRef.current = page;
    notePageChange();
    return onTravel({ route: page.route, params: page.params, cause: "drag" });
  };

  // The page the row goes to, once nothing is left to the hand.
  const askForPageOfRow = (index, movement) => {
    const row = rowRef.current;
    const page = latestRef.current.pages[index];
    if (windowed && !movement.pictures.has(index)) {
      leavePictureOfLive(movement);
    }
    Promise.resolve(askFor(page)).then(() => {
      if (pageIsCurrent(page)) {
        return;
      }
      // Refused, or sent elsewhere: the row says where the address is.
      askedPageRef.current = null;
      const { currentIndex } = latestRef.current;
      const paneCurrent = panesOf(row)[currentIndex];
      if (paneCurrent) {
        movement.travelling = true;
        travelRowTo(currentIndex, movement);
      }
    });
  };

  const sayRowMoves = () => {
    const row = rowRef.current;
    const panes = panesOf(row);
    if (panes.length < 2) {
      return;
    }
    const { pages } = latestRef.current;
    const { base, toward, fraction } = readRowFrame(row, panes);
    publishRouteRowMove({
      basePath: pathOf(pages[panes.indexOf(base)]),
      towardPath: toward ? pathOf(pages[panes.indexOf(toward)]) : null,
      progress: -fraction,
    });
  };

  // A travel no hand set off is one box long however far the page is, as in a
  // SlideContainer: a scroll to where the page stands would fly past every page in
  // between. So the page asked for takes the column next to what is in the frame, on
  // the side it already stands, which moves nothing on screen, and endMovement puts
  // the columns back. Columns rather than offsets: every page stays a place to snap
  // to, and none has to be hidden.
  const travelRowTo = (index, movement) => {
    const row = rowRef.current;
    const panes = panesOf(row);
    const pane = panes[index];
    if (!pane) {
      return;
    }
    const { base, toward, fraction } = readRowFrame(row, panes);
    const inFrame = toward && fraction > 0 ? [base, toward] : [base];
    if (!inFrame.includes(pane)) {
      // In a window, what the window put in a column moves with its pane.
      const standingIn = (paneIndex) => {
        const standing = [panes[paneIndex]];
        if (windowed) {
          const picture = movement.pictures.get(paneIndex);
          if (picture) {
            standing.push(picture);
          }
          if (paneIndex === latestRef.current.liveIndex) {
            standing.push(liveRef.current);
          }
        }
        return standing;
      };
      const columns = [...panes].sort((a, b) => a.offsetLeft - b.offsetLeft);
      const first = columns.indexOf(inFrame[0]);
      const last = columns.indexOf(inFrame[inFrame.length - 1]);
      const from = columns.indexOf(pane);
      columns.splice(from, 1);
      columns.splice(from < first ? first - 1 : last + 1, 0, pane);
      movement.placed ||= new Map();
      columns.forEach((eachPane, column) => {
        for (const element of standingIn(panes.indexOf(eachPane))) {
          if (!movement.placed.has(element)) {
            movement.placed.set(element, element.style.gridColumn);
          }
          element.style.gridColumn = String(column + 1);
        }
      });
    }
    playTravel(pane, movement);
  };

  // A travel asked for, in `duration`, on SlideContainer's curve. Not the browser's
  // smooth scroll, which has no duration to ask for and a curve of its own (Chrome's
  // hesitates, then peaks at 1.65 times this one's speed): two rows of tabs in one
  // app would not move alike. The scroll position is written at every frame, so the
  // row stays a scroller all the way: what follows it (a Nav's bar) reads it as it
  // reads a hand, and a finger landing finds it where it is. That is played on the
  // main thread: a transform on the panes would play on the compositor, but it would
  // capture what the page on screen holds in position: fixed. Hence a clock of its
  // own, which a busy main thread slows down rather than makes jump.
  const playTravel = (pane, movement) => {
    const row = rowRef.current;
    // Already moving, so there is no ease-in to play: it would stall the row for an
    // instant right where the eye is following it.
    const replaced = movement.playing;
    const inFlight = Boolean(replaced) || Boolean(movement.rowTaken);
    // Before the row is read: let go of for an instant, it would be snapped to the
    // nearest page by that read, and the travel would start from there.
    row.setAttribute("data-route-row-travelling", "");
    if (replaced) {
      replaced.cancel();
      movement.playing = null;
    }
    const from = row.scrollLeft;
    const { durationMs } = latestRef.current;
    // One box in `duration` is the pace: what is left of a travel picked up on the
    // way takes what is left of the time. Never slower: two boxes are not made to drag.
    const boxes = Math.abs(pane.offsetLeft - from) / row.clientWidth;
    const travelMs = boxes < 1 ? durationMs * boxes : durationMs;
    if (!travelMs) {
      row.scrollLeft = pane.offsetLeft;
      letRowGo(movement);
      // A write that changes nothing is followed by no scroll event to say the row
      // stopped. After the commit that asked, which goes on to say the row moves.
      Promise.resolve().then(landRow);
      return;
    }
    const curve = inFlight ? CSS_EASE_OUT : CSS_EASE;
    let frame = null;
    // How much of the travel has played, frame by frame. A travel setting off plays
    // nothing at its first frame, which may have begun while the press was still being
    // handled: that is no travel. One taking over goes on from the last frame of the
    // one it replaces, or the row would stand still for a frame where the eye follows it.
    let played = 0;
    const playing = {
      // Where this travel put the row, for a scroll event to tell it from a hand.
      written: from,
      lastFrame: replaced ? replaced.lastFrame : null,
      cancel: () => {
        cancelAnimationFrame(frame);
      },
    };
    const step = (now) => {
      if (playing.lastFrame !== null) {
        const gap = now - playing.lastFrame;
        if (gap > TRAVEL_FRAME_MAX_MS) {
          played += TRAVEL_FRAME_MAX_MS;
        } else if (gap > 0) {
          played += gap;
        }
      }
      playing.lastFrame = now;
      const elapsed = played / travelMs;
      // Read at every frame: the layout may move under the travel (a scrollbar
      // coming in narrows the row), and it goes where the page stands.
      const to = pane.offsetLeft;
      const arrived = elapsed >= 1;
      playing.written = arrived
        ? to
        : from + (to - from) * easedProgress(elapsed, curve);
      row.scrollLeft = playing.written;
      // In the frame it is written: the scroll event saying so comes a frame later,
      // and what follows the row would be drawn a frame behind it.
      sayRowMoves();
      if (!arrived) {
        frame = requestAnimationFrame(step);
        return;
      }
      letRowGo(movement);
      // Said here rather than waited for: the last frames of a curve can move the row
      // by less than a pixel, and nothing then says it has stopped.
      landRow();
    };
    movement.playing = playing;
    frame = requestAnimationFrame(step);
  };

  // The row given back to the browser: no travel writes it any more, and it snaps
  // again. A travel replacing another keeps it (playTravel).
  const letRowGo = (movement) => {
    if (movement.playing) {
      movement.playing.cancel();
      movement.playing = null;
    }
    rowRef.current.removeAttribute("data-route-row-travelling");
  };

  // Every column back where the map says, and the row on the page of the address, in
  // one go: that page stands at the same place on screen either way.
  const putRowBack = (movement) => {
    const row = rowRef.current;
    if (movement.placed) {
      for (const [element, column] of movement.placed) {
        element.style.gridColumn = column;
      }
      movement.placed = null;
    }
    const pane = panesOf(row)[latestRef.current.currentIndex];
    if (pane && !restsOn(row, pane, ROW_READING)) {
      row.scrollTo({ left: pane.offsetLeft, behavior: "instant" });
    }
  };

  // A tab pressed over a row a hand has left moving, which the browser plays on and
  // overwrites a travel with once that travel is over: the snap is ended first. Given
  // back, the row stands where it stood. The travel a frame later, because until then
  // WebKit still has the row where a box that is no scroller stood, at 0.
  const takeRowFromHand = (movement) => {
    const row = rowRef.current;
    const position = row.scrollLeft;
    movement.rowTaken = true;
    // A travel no hand set off holds nothing: it goes where it goes.
    releaseHeldPage();
    holdRowAt(row, position);
    afterFrames(2, () => {
      if (movementRef.current !== movement) {
        return;
      }
      // A scroller again, standing where no page does: not snapped meanwhile.
      row.setAttribute("data-route-row-travelling", "");
      releaseTakenRow(row);
      afterFrames(1, () => {
        if (movementRef.current === movement) {
          travelRowTo(latestRef.current.currentIndex, movement);
        }
      });
    });
  };

  // The row has stopped, on the page of the address: everything held for the
  // movement is let go of in one go, before anything paints.
  const endMovement = () => {
    const row = rowRef.current;
    const movement = movementRef.current;
    if (!movement) {
      return;
    }
    movementRef.current = null;
    letRowGo(movement);
    putRowBack(movement);
    releaseTakenRow(row);
    publishRouteRowMove(null);
    releaseHeldPage();
    releasePaneAtRest(row);
    if (liveRef.current) {
      liveRef.current.style.top = "";
    }
    for (const picture of movement.pictures.values()) {
      picture.remove();
    }
    if (movement.scrollsDocument) {
      unpinPanes(row);
      const { pages, currentIndex } = latestRef.current;
      if (currentIndex !== -1) {
        const { route, params } = pages[currentIndex];
        arriveAtScrollPosition(route.buildUrl(params));
      }
      movement.resumeScrollRecording();
    }
    // A window recentred meanwhile is taken now.
    render();
  };

  // The row may have stopped: on the page of the address, the movement is over; on
  // another, a hand put it there and the address follows.
  const landRow = () => {
    const row = rowRef.current;
    const movement = movementRef.current;
    // A travel playing says itself when it is over.
    if (!movement || movement.playing || isRowTaken(row)) {
      return;
    }
    const panes = panesOf(row);
    const pane = pageAtRest(row, panes, ROW_READING);
    if (!pane) {
      // A travel a hand took over (a trackpad, a wheel) and left between two pages:
      // sent again, the row then rests.
      const { currentIndex } = latestRef.current;
      if (movement.travelling && panes[currentIndex]) {
        travelRowTo(currentIndex, movement);
      }
      return;
    }
    movement.landed = true;
    const { pages } = latestRef.current;
    const page = pages[panes.indexOf(pane)];
    if (!page || pageIsCurrent(page)) {
      if (!askedPageRef.current || samePage(askedPageRef.current, page)) {
        endMovement();
      }
      return;
    }
    if (samePage(askedPageRef.current, page)) {
      return;
    }
    askForPageOfRow(panes.indexOf(pane), movement);
  };

  // The address and the row, in step. The opening and a row given again around the
  // page on screen have nothing to show for it; somebody else moving the address
  // (a tab pressed, the back button) is a travel.
  const answeredPageRef = useRef(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const page = currentIndex === -1 ? null : pages[currentIndex];
    const pane = panesOf(row)[currentIndex];
    const answered = answeredPageRef.current;
    if (samePage(answered, page)) {
      if (pane && !movementRef.current && !restsOn(row, pane, ROW_READING)) {
        row.scrollTo({ left: pane.offsetLeft, behavior: "instant" });
      }
      return;
    }
    answeredPageRef.current = page;
    if (!page || !pane) {
      // The address left the row while a travel nobody's hand is on was playing (a
      // link to a page off the row): there is nothing left to travel to, and the
      // landing would send the address back to the page the row rests on.
      const movement = movementRef.current;
      if (!page && movement?.travelling && !movement.byHand) {
        Promise.resolve().then(endMovement);
      }
      return;
    }
    const asked = askedPageRef.current;
    if (asked && samePage(asked, page)) {
      askedPageRef.current = null;
      // The hand landed before the address did.
      if (movementRef.current?.landed && restsOn(row, pane, ROW_READING)) {
        Promise.resolve().then(endMovement);
      }
      return;
    }
    if (!answered || restsOn(row, pane, ROW_READING)) {
      if (!restsOn(row, pane, ROW_READING)) {
        row.scrollTo({ left: pane.offsetLeft, behavior: "instant" });
      }
      return;
    }
    const movementBefore = movementRef.current;
    // The row still rests on the page answered before. Held in the commit that made
    // its pane inert, so no frame paints it contained.
    const movement = beginMovement(
      { travelling: true },
      panesOf(row)[pages.findIndex((each) => samePage(each, answered))],
    );
    if (movementBefore?.byHand && !movementBefore.rowTaken) {
      sayRowMoves();
      takeRowFromHand(movement);
      return;
    }
    if (!row.hasAttribute("data-route-row-taken")) {
      travelRowTo(currentIndex, movement);
    }
    // In this very commit: the tab pressed already wears its bar, and the first
    // scroll event is a frame away.
    sayRowMoves();
  });

  // Somebody else is about to move the address to another page of a window: its
  // picture has to be taken now, while it still shows the page being left.
  useLayoutEffect(() => {
    if (!windowed) {
      return undefined;
    }
    return observeBeforeRouting(({ url }) => {
      const { pages, currentIndex } = latestRef.current;
      const asked = askedPageRef.current;
      if (asked || currentIndex === -1) {
        return;
      }
      if (
        pageIsAt(pages[currentIndex], url) ||
        !pages.some((page) => pageIsAt(page, url))
      ) {
        return;
      }
      const movement = beginMovement({ travelling: true });
      leavePictureOfLive(movement);
    });
  }, [windowed]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const onScroll = ({ finger, lifted }) => {
      const { pages, currentIndex, travelByDrag } = latestRef.current;
      const panes = panesOf(row);
      if (panes.length < 2 || isRowTaken(row)) {
        return;
      }
      const moving = movementRef.current;
      // Not where the travel put it: a hand has taken the row (a trackpad, a wheel),
      // and the travel lets it go, snapping included, as the browser's own scroll does.
      if (
        moving?.playing &&
        Math.abs(row.scrollLeft - moving.playing.written) > WRITE_ROUNDING
      ) {
        letRowGo(moving);
      }
      const pane = panes[currentIndex];
      if (!moving && pane && restsOn(row, pane, ROW_READING)) {
        // Written by this box, at rest: nobody is moving anything.
        return;
      }
      const movement = moving || beginMovement({ byHand: true }, pane);
      sayRowMoves();
      if (movement.travelling || !travelByDrag || !pane) {
        return;
      }
      // Nothing will say when a trackpad's fingers leave, and a long stroke would keep
      // the first tab lit for the whole trip: the nearest page answers. A finger has a
      // lift to wait for (onLeftToSnap), and until then the page held stands.
      if (!finger) {
        const { base, toward, fraction } = readRowFrame(row, panes);
        followPageOnScreen(
          pages[panes.indexOf(fraction >= 0.5 && toward ? toward : base)],
          askedPageRef.current || pages[currentIndex],
        );
      }
      // The pull is read from the pane of the address. Once the finger has lifted,
      // the address is where the snap goes (onLeftToSnap), and what still lies
      // between is the snap playing out, not a hand pulling towards the neighbour.
      if (lifted) {
        return;
      }
      const pulled = row.scrollLeft - pane.offsetLeft;
      if (Math.abs(pulled) < SET_OFF_PULL) {
        return;
      }
      const index = pulled > 0 ? currentIndex + 1 : currentIndex - 1;
      const paneTowards = panes[index];
      const page = pages[index];
      if (!paneTowards || samePage(askedPageRef.current, page)) {
        return;
      }
      if (windowed) {
        if (movement.pictures.has(index)) {
          return;
        }
        leavePictureOfLive(movement);
      } else if (paneTowards.hasAttribute("data-built")) {
        return;
      }
      holdPage(pages[currentIndex], page);
      askFor(page);
    };
    // The address, the tabs and what reads the held page all move here, the way they
    // do for a tab pressed. If the row ends up elsewhere after all, onLand corrects
    // the address when it rests.
    const onLeftToSnap = (forward) => {
      const movement = movementRef.current;
      const { pages, travelByDrag } = latestRef.current;
      if (!movement || movement.travelling || !travelByDrag) {
        return;
      }
      const panes = panesOf(row);
      const { base, toward } = readRowFrame(row, panes);
      const index = panes.indexOf(forward && toward ? toward : base);
      const page = pages[index];
      if (!page) {
        return;
      }
      if (!pageIsCurrent(page) && !samePage(askedPageRef.current, page)) {
        askForPageOfRow(index, movement);
      }
      // After the address: a pull coming back to its page must not light the tab the
      // address ran ahead to, even for a render. Only what readers are told: the
      // panes keep their layout until the row rests.
      releaseHeldPage();
    };
    const stopWatching = watchRowScroll(row, {
      onScroll,
      onLand: landRow,
      onLeftToSnap,
    });
    // A finger on a travel still playing: the row is the finger's from here, and it
    // stands where the travel was going, as in a SlideContainer. Not a wheel: a page
    // scrolled vertically over the row is no hand on it, and one scrolling it sideways
    // is told apart by the travel itself (onScroll).
    const onTouchOnTravel = () => {
      if (movementRef.current?.travelling && !isRowTaken(row)) {
        endMovement();
      }
    };
    // A press for the page the address is already on changes nothing the router can
    // tell, and a stroke no lift ends leaves the address where it was: it is heard here,
    // the way a tab says which page it is through its address.
    const onPress = (clickEvent) => {
      const movement = movementRef.current;
      if (!movement?.byHand || movement.rowTaken) {
        return;
      }
      const link = clickEvent.target.closest?.("a[href]");
      const { pages, currentIndex } = latestRef.current;
      const page = pages[currentIndex];
      if (!link || !page || !pageIsAt(page, link.href)) {
        return;
      }
      movement.travelling = true;
      takeRowFromHand(movement);
    };
    row.addEventListener("touchstart", onTouchOnTravel, { passive: true });
    document.addEventListener("click", onPress, { capture: true });
    return () => {
      stopWatching();
      row.removeEventListener("touchstart", onTouchOnTravel);
      document.removeEventListener("click", onPress, { capture: true });
      const movement = movementRef.current;
      if (movement) {
        movement.playing?.cancel();
        movement.resumeScrollRecording?.();
      }
      row.removeAttribute("data-route-row-travelling");
      movementRef.current = null;
      publishRouteRowMove(null);
      releaseHeldPage();
      releasePaneAtRest(row);
    };
  }, [windowed]);

  // A window's page lands on a pane as soon as the address does. The row has come
  // to rest on it or will: when it already has, nothing else will say so.
  useLayoutEffect(() => {
    const movement = movementRef.current;
    if (!movement?.landed || currentIndex === -1) {
      return;
    }
    const pane = panesOf(rowRef.current)[currentIndex];
    if (pane && restsOn(rowRef.current, pane, ROW_READING)) {
      Promise.resolve().then(endMovement);
    }
  }, [currentIndex]);

  // What a hand can bring is asked for at rest, the next page first: never before
  // the page on screen has its answers and has painted them. A row in movement is
  // not at rest; the render that ends the movement asks again. Read as pages, not as
  // entries: the pages of <Route> children are collected again at every render.
  const neighboursRef = useRef([null, null]);
  const nextPage = currentIndex === -1 ? null : pages[currentIndex + 1] || null;
  const previousPage =
    currentIndex === -1 ? null : pages[currentIndex - 1] || null;
  if (
    !samePage(neighboursRef.current[0], nextPage) ||
    !samePage(neighboursRef.current[1], previousPage)
  ) {
    neighboursRef.current = [nextPage, previousPage];
  }
  const neighbours = neighboursRef.current;
  useLayoutEffect(() => {
    if (!prefetch || movementRef.current) {
      return undefined;
    }
    if (!neighbours[0] && !neighbours[1]) {
      return undefined;
    }
    let cancelPaint = null;
    const cancelWait = whenPageReadsAnswered(() => {
      cancelPaint = afterPaint(() => {
        if (movementRef.current) {
          return;
        }
        for (const page of neighbours) {
          if (page) {
            page.route.preload(page.params || {});
          }
        }
      });
    });
    return () => {
      cancelWait();
      if (cancelPaint) {
        cancelPaint();
      }
    };
  }, [prefetch, neighbours, restCount]);

  // A neighbour shows from the first frame the compositor moves the row, before
  // any scroll event, so it has to stand where the reader is looking by then: a
  // finger landing is the last word before that. A trackpad says nothing first, and
  // the pin comes with its first scroll event (beginMovement).
  useLayoutEffect(() => {
    const row = rowRef.current;
    const onTouchStart = () => {
      if (!movementRef.current && rowFollowsDocument(row)) {
        pinPanes(row);
      }
    };
    row.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      row.removeEventListener("touchstart", onTouchStart);
    };
  }, []);
  const paintsNeighbours = Boolean(renderNeighbour);

  const rowContext = useMemo(() => ({ renderNeighbour }), [renderNeighbour]);
  const rowKind =
    pages.length < 2 && windowed ? "still" : travelByDrag ? "" : "code";
  return (
    <div
      {...rest}
      className={
        className ? `navi_route_travel ${className}` : "navi_route_travel"
      }
    >
      <div
        ref={rowRef}
        data-route-travel-row={rowKind}
        // What a box around this one and a control acting on the press read: this
        // axis is taken here (see drag_to_travel.js).
        data-travel-by-drag={
          travelByDrag && rowKind !== "still" ? "x" : undefined
        }
      >
        {windowed ? (
          <>
            {pages.map((page, index) => {
              const holdsNeighbour =
                paintsNeighbours &&
                isNeighbourPane(index, liveIndex, movementRef.current);
              return (
                <div
                  key={index}
                  data-route-row-pane=""
                  inert={holdsNeighbour}
                  style={{ gridColumn: index + 1 }}
                >
                  {holdsNeighbour && (
                    <RouteRowNeighbour
                      renderNeighbour={renderNeighbour}
                      page={page}
                    />
                  )}
                </div>
              );
            })}
            <div
              ref={liveRef}
              data-route-row-live=""
              style={{ gridColumn: liveIndex + 1 }}
            >
              {children}
            </div>
            <div ref={picturesRef} data-route-row-pictures="" />
          </>
        ) : (
          <RouteRowContext.Provider value={rowContext}>
            {children}
          </RouteRowContext.Provider>
        )}
      </div>
    </div>
  );
};

// The panes on each side of the live page. Not one holding a picture of the page
// left there: a page with no background of its own would show it through.
const isNeighbourPane = (index, liveIndex, movement) => {
  if (index !== liveIndex - 1 && index !== liveIndex + 1) {
    return false;
  }
  return !movement || !movement.pictures.has(index);
};

const rowFollowsDocument = (row) =>
  getScrollContainer(row.parentElement, { includeHidden: true }) ===
  document.documentElement;

// How far down the row the reader is looking, for a page brought in: a page on
// screen scrolls with the document, and one arriving has to start from there.
const pinOf = (row) => {
  const { top } = row.getBoundingClientRect();
  return top < 0 ? -top : 0;
};

// What a clone does not take: where what scrolls inside was left.
const copyScrollPositions = (from, to) => {
  const fromElements = from.querySelectorAll("*");
  const toElements = to.querySelectorAll("*");
  for (let i = 0; i < fromElements.length; i++) {
    const { scrollTop, scrollLeft } = fromElements[i];
    if (scrollTop || scrollLeft) {
      toElements[i].scrollTop = scrollTop;
      toElements[i].scrollLeft = scrollLeft;
    }
  }
};

// A tab pressed over a row a hand has left moving holds it still (takeRowFromHand):
// what the row says meanwhile is not a hand moving it.
const isRowTaken = (row) => row.hasAttribute("data-route-row-taken");

// What the CSS offsets while the row is taken. A picture left meanwhile is a clone
// of the live page, and takes its offset along.
const STANDING_IN_ROW =
  ":scope > [data-route-row-pane], :scope > [data-route-row-live], :scope > [data-route-row-pictures] > *";
const holdRowAt = (row, position) => {
  for (const element of row.querySelectorAll(STANDING_IN_ROW)) {
    element.style.setProperty("--navi-route-row-stand", `${-position}px`);
  }
  row.setAttribute("data-route-row-taken", "");
};
const releaseTakenRow = (row) => {
  row.removeAttribute("data-route-row-taken");
  for (const element of row.querySelectorAll(STANDING_IN_ROW)) {
    element.style.removeProperty("--navi-route-row-stand");
  }
};

const afterFrames = (count, callback) => {
  if (count === 0) {
    callback();
    return;
  }
  requestAnimationFrame(() => {
    afterFrames(count - 1, callback);
  });
};

// The two pages the row stands between.
const readRowFrame = (row, panes) =>
  readRowStretch(row, panes, panes[0], ROW_READING);

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
