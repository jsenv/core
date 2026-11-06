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
 * A travel nobody's hand is on (a tab pressed, the back button) is the browser's
 * smooth scroll, one box long however far the page is (travelRowTo), after ending a
 * snap a hand has left running (takeRowFromHand). Whatever else follows, the trait
 * under a tab bar first, follows the row through route_row_follow.js.
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
import { pageIsCurrent } from "./route_page.js";
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

const css = /* css */ `
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
    /* A tab pressed over a row a hand has left moving (see takeRowFromHand). Snapping
       stays off for the travel: what it plays is not a place to snap back from. */
    &[data-route-row-taken] {
      scroll-snap-type: none;
    }
    /* No scroller for the two frames the compositor takes to hear it, which is what
       ends a snap in Chrome, and the picture held where the scroll position had it.
       Offsets, for the same reason as the pin below: a transform would capture what a
       page holds in position: fixed. */
    &[data-route-row-taken="clip"] {
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
    /* A page not on screen paints nothing at rest: what it holds in position:
       fixed stands over the page shown, whatever scrolls it out of sight. */
    &:not([data-moving]) > [data-route-row-pane][inert] {
      visibility: hidden;
    }
    /* A pane brought in stands where the reader is looking, and does not make the
       document taller than the page on screen does, when the document is what
       scrolls. Nothing changes for a row that fits a box of its own. */
    > [data-route-row-pane][inert] {
      position: relative;
      top: var(--navi-route-row-pin, 0);
      max-height: 100dvh;
      overflow: clip;
    }
    /* What stands in the pane of a neighbour until its page does. It paints at
       rest, unlike the pane around it: the compositor moves the row, and what
       waits for the first scroll event to show comes a frame late. contain: what
       it holds in position: fixed does not stand over the page. Out of flow: the
       height of the row stays the page's. */
    > [data-route-row-pane] > [data-route-row-neighbour] {
      position: absolute;
      inset: 0;
      display: flex;
      contain: layout paint;
      flex-direction: column;
      visibility: visible;
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

/**
 * @type {import("preact").FunctionComponent<{
 *   routes?: Array<object|{route: object, params?: object}>,
 *   travelByDrag?: boolean,
 *   onTravel?: (detail: {route: object, params: object|undefined, cause: string}) => void|Promise<void>,
 *   renderNeighbour?: (page: {route: object, params: object|undefined}) => import("preact").ComponentChildren,
 *   prefetch?: boolean,
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
  // address the row has no place for.
  const liveIndexRef = useRef(0);
  if (currentIndex !== -1) {
    liveIndexRef.current = currentIndex;
  }
  const liveIndex = liveIndexRef.current;
  const latestRef = useRef(null);
  latestRef.current = {
    pages,
    currentIndex,
    liveIndex,
    onTravel,
    travelByDrag,
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

  // One movement, whoever set it off, from the first thing that moves to the row
  // at rest. Null when nothing moves.
  const beginMovement = (fields) => {
    const row = rowRef.current;
    if (movementRef.current) {
      Object.assign(movementRef.current, fields);
      return movementRef.current;
    }
    row.setAttribute("data-moving", "");
    const movement = {
      travelling: false,
      pictures: new Map(),
      resumeScrollRecording: null,
      scrollsDocument: rowFollowsDocument(row),
      ...fields,
    };
    movementRef.current = movement;
    if (movement.scrollsDocument) {
      // Whatever the browser does with the offset meanwhile (clamping it to a page
      // shorter than the trip) is not the reader scrolling, and the address it
      // would be written against may already be another page's.
      movement.resumeScrollRecording = suspendScrollRecording();
      row.style.setProperty("--navi-route-row-pin", `${pinOf(row)}px`);
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
  // SlideContainer: the browser's smooth scroll would fly past every page in between.
  // So the page asked for takes the column next to what is in the frame, on the side
  // it already stands, which moves nothing on screen, and endMovement puts the columns
  // back. Columns rather than offsets: every page stays a place to snap to, and none
  // has to be hidden.
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
    row.scrollTo({ left: pane.offsetLeft, behavior: "smooth" });
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
  // back, the row stands where it stood. A frame later, because until then WebKit still
  // starts from where a box that is no scroller stood: a smooth scroll to the first page
  // sees nothing to do.
  const takeRowFromHand = (movement) => {
    const row = rowRef.current;
    const position = row.scrollLeft;
    movement.rowTaken = true;
    // A travel no hand set off holds nothing: it goes where it goes.
    releaseHeldPage();
    row.style.setProperty("--navi-route-row-stand", `${-position}px`);
    row.setAttribute("data-route-row-taken", "clip");
    afterFrames(2, () => {
      if (movementRef.current !== movement) {
        return;
      }
      row.setAttribute("data-route-row-taken", "");
      row.style.removeProperty("--navi-route-row-stand");
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
    putRowBack(movement);
    row.removeAttribute("data-moving");
    row.removeAttribute("data-route-row-taken");
    publishRouteRowMove(null);
    releaseHeldPage();
    if (liveRef.current) {
      liveRef.current.style.top = "";
    }
    for (const picture of movement.pictures.values()) {
      picture.remove();
    }
    if (movement.scrollsDocument) {
      row.style.removeProperty("--navi-route-row-pin");
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
    const movement = beginMovement({ travelling: true });
    if (movementBefore?.byHand && !movementBefore.rowTaken) {
      sayRowMoves();
      takeRowFromHand(movement);
      return;
    }
    if (row.getAttribute("data-route-row-taken") !== "clip") {
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
      const path = new URL(url, window.location.href).pathname;
      if (
        pathOf(pages[currentIndex]) === path ||
        !pages.some((page) => pathOf(page) === path)
      ) {
        return;
      }
      const movement = beginMovement({ travelling: true });
      leavePictureOfLive(movement);
    });
  }, [windowed]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const isClipped = () => row.getAttribute("data-route-row-taken") === "clip";
    const onScroll = ({ finger, lifted }) => {
      const { pages, currentIndex, travelByDrag } = latestRef.current;
      const panes = panesOf(row);
      if (panes.length < 2 || isClipped()) {
        return;
      }
      const moving = movementRef.current;
      const pane = panes[currentIndex];
      if (!moving && pane && restsOn(row, pane, ROW_READING)) {
        // Written by this box, at rest: nobody is moving anything.
        return;
      }
      const movement = moving || beginMovement({ byHand: true });
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
      // address ran ahead to, even for a render.
      releaseHeldPage();
    };
    const onLand = () => {
      const movement = movementRef.current;
      if (!movement || isClipped()) {
        return;
      }
      const panes = panesOf(row);
      const pane = pageAtRest(row, panes, ROW_READING);
      if (!pane) {
        // A travel stopped short of its page: the layout moved under it (a scrollbar
        // coming in narrows the row), and where it was sent is not where the page
        // stands. Sent again: the row then rests, or does not move and is not heard.
        const target = panes[latestRef.current.currentIndex];
        if (movement.travelling && !isClipped() && target) {
          row.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
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
    const stopWatching = watchRowScroll(row, {
      onScroll,
      onLand,
      onLeftToSnap,
    });
    // A finger on a travel still playing: the row is the finger's from here, and it
    // stands where the travel was going, as in a SlideContainer. A wheel only gives the
    // row its snapping back: a page scrolled vertically over it is no hand on it.
    const onTouchOnTravel = () => {
      if (movementRef.current?.travelling && !isClipped()) {
        endMovement();
      }
    };
    const onWheelOnTravel = () => {
      if (row.getAttribute("data-route-row-taken") === "") {
        row.removeAttribute("data-route-row-taken");
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
      if (!link || !page || new URL(link.href).pathname !== pathOf(page)) {
        return;
      }
      movement.travelling = true;
      takeRowFromHand(movement);
    };
    row.addEventListener("touchstart", onTouchOnTravel, { passive: true });
    row.addEventListener("wheel", onWheelOnTravel, { passive: true });
    document.addEventListener("click", onPress, { capture: true });
    return () => {
      stopWatching();
      row.removeEventListener("touchstart", onTouchOnTravel);
      row.removeEventListener("wheel", onWheelOnTravel);
      document.removeEventListener("click", onPress, { capture: true });
      movementRef.current?.resumeScrollRecording?.();
      movementRef.current = null;
      publishRouteRowMove(null);
      releaseHeldPage();
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
  // any scroll event: a finger landing is the last word before that.
  const paintsNeighbours = Boolean(renderNeighbour);
  useLayoutEffect(() => {
    if (!paintsNeighbours) {
      return undefined;
    }
    const row = rowRef.current;
    const onTouchStart = () => {
      if (!movementRef.current && rowFollowsDocument(row)) {
        row.style.setProperty("--navi-route-row-pin", `${pinOf(row)}px`);
      }
    };
    row.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      row.removeEventListener("touchstart", onTouchStart);
    };
  }, [paintsNeighbours]);

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
