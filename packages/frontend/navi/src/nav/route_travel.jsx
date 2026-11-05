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
 *                      brings back the page itself. Its pane is empty before that,
 *                      so the address moves as soon as the hand has really pulled
 *                      towards it, and the page fills in under the finger. A pane
 *                      already built waits for the landing.
 *   `routes` prop      a window over something longer, where several pages are often
 *                      one route with other params: the same component, so there
 *                      can only be one. It stands in the pane of the address, and
 *                      what the hand leaves behind is a PICTURE of it, a clone in
 *                      the pane it was in. The address moves as soon as the hand
 *                      has really pulled, as above.
 *
 * What reads the URL may therefore read where the hand is heading. Where the reader
 * still is, is routeTravelSettledPageSignal.
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
 * smooth scroll. Whatever else follows, the trait under a tab bar first, follows the
 * row through route_row_follow.js.
 */

import { useLayoutEffect, useMemo, useReducer, useRef } from "preact/hooks";
import { signal } from "@preact/signals";

import { getScrollContainer } from "@jsenv/dom";
import { observeBeforeRouting } from "./browser_integration/before_routing.js";
import {
  arriveAtScrollPosition,
  suspendScrollRecording,
} from "./browser_integration/scroll_restoration.js";
import { collectRoutePages, RouteRowContext } from "./route.jsx";
import { notePageChange } from "./page_change.js";
import { pageIsCurrent } from "./route_page.js";
import { publishRouteRowMove } from "./route_row_follow.js";
import {
  pageAtRest,
  readRowStretch,
  restsOn,
  watchRowScroll,
} from "../layout/native_row_scroll.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

const css = /* css */ `
  .navi_route_travel {
    position: relative;
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

/**
 * What the URL says while a hand holds the row is where it is heading, for a page
 * not built yet: it builds by the address moving. A counter, a title or a
 * breadcrumb around the box must not move for a pull that is let go of: it reads
 * this first. The page the reader is still on while that lasts, and `null` when
 * the row has come to rest, which is when `scrollsnapchange` fires and a pager's
 * `settledPage` changes. A travel no hand set off holds nothing: it goes where it
 * goes.
 *
 * One for the document. `route` says which row, for a page holding several boxes.
 */
export const routeTravelSettledPageSignal = signal(null);

/**
 * @type {import("preact").FunctionComponent<{
 *   routes?: Array<object|{route: object, params?: object}>,
 *   travelByDrag?: boolean,
 *   onTravel?: (detail: {route: object, params: object|undefined, cause: string}) => void|Promise<void>,
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
  className,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const rowRef = useRef();
  const liveRef = useRef();
  const picturesRef = useRef();
  const windowed = Boolean(routesProp);
  const [, render] = useReducer((count) => count + 1, 0);

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
      scrollsDocument:
        getScrollContainer(row.parentElement, { includeHidden: true }) ===
        document.documentElement,
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

  const sayRowMoves = () => {
    const row = rowRef.current;
    const panes = panesOf(row);
    if (panes.length < 2) {
      return;
    }
    const { pages } = latestRef.current;
    const { base, toward, fraction } = readRowStretch(row, panes, panes[0]);
    publishRouteRowMove({
      basePath: pathOf(pages[panes.indexOf(base)]),
      towardPath: toward ? pathOf(pages[panes.indexOf(toward)]) : null,
      progress: -fraction,
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
    row.removeAttribute("data-moving");
    publishRouteRowMove(null);
    routeTravelSettledPageSignal.value = null;
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
      if (pane && !movementRef.current && !restsOn(row, pane)) {
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
      if (movementRef.current?.landed && restsOn(row, pane)) {
        Promise.resolve().then(endMovement);
      }
      return;
    }
    if (!answered || restsOn(row, pane)) {
      if (!restsOn(row, pane)) {
        row.scrollTo({ left: pane.offsetLeft, behavior: "instant" });
      }
      return;
    }
    beginMovement({ travelling: true });
    row.scrollTo({ left: pane.offsetLeft, behavior: "smooth" });
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
    const onScroll = () => {
      const { pages, currentIndex, travelByDrag } = latestRef.current;
      const panes = panesOf(row);
      if (panes.length < 2) {
        return;
      }
      const moving = movementRef.current;
      const pane = panes[currentIndex];
      if (!moving && pane && restsOn(row, pane)) {
        // Written by this box, at rest: nobody is moving anything.
        return;
      }
      const movement = moving || beginMovement({});
      sayRowMoves();
      if (movement.travelling || !travelByDrag || !pane) {
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
      if (routeTravelSettledPageSignal.peek() === null) {
        routeTravelSettledPageSignal.value = pages[currentIndex];
      }
      askFor(page);
    };
    const onLand = () => {
      const movement = movementRef.current;
      if (!movement) {
        return;
      }
      const panes = panesOf(row);
      const pane = pageAtRest(row, panes);
      if (!pane) {
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
      if (windowed && !movement.pictures.has(panes.indexOf(pane))) {
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
          row.scrollTo({ left: paneCurrent.offsetLeft, behavior: "smooth" });
        }
      });
    };
    const stopWatching = watchRowScroll(row, { onScroll, onLand });
    return () => {
      stopWatching();
      movementRef.current?.resumeScrollRecording?.();
      movementRef.current = null;
      publishRouteRowMove(null);
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
    if (pane && restsOn(rowRef.current, pane)) {
      Promise.resolve().then(endMovement);
    }
  }, [currentIndex]);

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
            {pages.map((page, index) => (
              <div
                key={index}
                data-route-row-pane=""
                style={{ gridColumn: index + 1 }}
              />
            ))}
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
          <RouteRowContext.Provider value={true}>
            {children}
          </RouteRowContext.Provider>
        )}
      </div>
    </div>
  );
};

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
