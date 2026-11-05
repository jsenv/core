/**
 * A row of pages the browser scrolls itself, and what is left to read from it.
 *
 * The hand is not interpreted here: the browser follows it, on its compositor,
 * and it alone knows what the page cannot be told (a notch from a trackpad, the
 * end of a stroke from its momentum, which scroller a stream is latched on). What
 * remains is reading where the row stands and when it has come to rest.
 *
 * Rows are measured off their pages rather than by rank and width: a row that
 * ends early because a page is held leaves what lies beyond out (`data-off-row`),
 * and ranks would then lie about where the others are. An `offsetLeft` is rounded,
 * but by half a pixel at most whatever the rank, which a rank multiplied by a
 * rounded width is not. It also ignores a transform: a row inside a popup still
 * growing into place measures as it will stand.
 *
 * Each scroller must be the offsetParent of its pages.
 */

// What the rest of a scroll is worth while a page sits a rounding away from it.
const AT_REST_DISTANCE = 1;
// How long without a scroll event means the row stopped. The browser's word is
// not enough: Firefox says `scrollend` once, when the wheel goes quiet, some 200ms
// before its snap has finished and never again, and Safari before 26.2 does not
// say it at all.
const STOPPED_SILENCE = 150;

const isOnRow = (page) =>
  page.offsetWidth > 0 && !page.hasAttribute("data-off-row");

export const restsOn = (scroller, page) =>
  Math.abs(page.offsetLeft - scroller.scrollLeft) <= AT_REST_DISTANCE &&
  Math.abs(page.offsetTop - scroller.scrollTop) <= AT_REST_DISTANCE;

/**
 * @returns {Element|undefined} the page the row rests on, nothing while it stands
 *   between two: a hand can pause midway, and an engine may call that the end of
 *   a scroll.
 */
export const pageAtRest = (scroller, pages) =>
  pages.find((page) => isOnRow(page) && restsOn(scroller, page));

/**
 * Where the row stands between two neighbouring pages, on the side it has moved
 * to from `page`: a hand is not limited to the next one, so what it has passed
 * since is walked over. A map moves along one axis at a time, the one it has
 * moved furthest on.
 *
 * @returns {{base: Element, toward: Element|undefined, fraction: number, forward: boolean}}
 *   the last page the row has passed (`page` itself until then), the one after,
 *   and how far between the two from 0 to 1. Nothing `toward` past the last.
 */
export const readRowStretch = (scroller, pages, page) => {
  const alongX =
    Math.abs(scroller.scrollLeft - page.offsetLeft) >=
    Math.abs(scroller.scrollTop - page.offsetTop);
  const position = alongX ? "offsetLeft" : "offsetTop";
  const cross = alongX ? "offsetTop" : "offsetLeft";
  const scrolled = alongX ? scroller.scrollLeft : scroller.scrollTop;
  const forward = scrolled > page[position];
  const step = forward ? 1 : -1;
  const line = pages
    .filter(
      (candidate) => isOnRow(candidate) && candidate[cross] === page[cross],
    )
    .sort((pageA, pageB) => pageA[position] - pageB[position]);
  let index = line.indexOf(page);
  let base = page;
  let toward = line[index + step];
  while (
    toward &&
    (forward ? toward[position] <= scrolled : toward[position] >= scrolled)
  ) {
    index += step;
    base = toward;
    toward = line[index + step];
  }
  const span = toward ? Math.abs(toward[position] - base[position]) : 0;
  const fraction = span ? Math.abs(scrolled - base[position]) / span : 0;
  return { base, toward, fraction, forward };
};

/**
 * @param {Element} scroller
 * @param {object} options
 * @param {() => void} options.onScroll - the row moved.
 * @param {(event: Event|null) => void} options.onLand - the row may have stopped.
 *   Read `pageAtRest` to know whether it stopped on a page. Heard more than once
 *   for one landing, so what it does must find nothing to do the second time.
 * @param {(forward: boolean) => void} [options.onLeftToSnap] - a finger has lifted
 *   and the row moves: snapping plays out what the browser has decided and does not
 *   turn round, so this is where it is going. Heard once per lift, after `onScroll`.
 *   A trackpad has no lift, and never says this.
 * @returns {() => void} stop listening.
 */
export const watchRowScroll = (
  scroller,
  { onScroll, onLand, onLeftToSnap },
) => {
  let stoppedTimeout = null;
  let touching = false;
  let liftedAt = null;
  const landOnSilence = () => {
    liftedAt = null;
    // A finger holding the row still: nothing has stopped.
    if (!touching) {
      onLand(null);
    }
  };
  const armSilence = () => {
    clearTimeout(stoppedTimeout);
    stoppedTimeout = setTimeout(landOnSilence, STOPPED_SILENCE);
  };
  const onScrollEvent = () => {
    onScroll();
    armSilence();
    if (!liftedAt) {
      return;
    }
    // A map moves along one axis at a time, so the two add up to the one it moves on.
    const moved =
      scroller.scrollLeft - liftedAt.left + (scroller.scrollTop - liftedAt.top);
    if (Math.abs(moved) < AT_REST_DISTANCE) {
      return;
    }
    liftedAt = null;
    onLeftToSnap?.(moved > 0);
  };
  const onTouchStart = () => {
    touching = true;
    liftedAt = null;
    clearTimeout(stoppedTimeout);
  };
  const onTouchEnd = (touchEvent) => {
    touching = touchEvent.touches.length > 0;
    if (!touching) {
      liftedAt = { left: scroller.scrollLeft, top: scroller.scrollTop };
      armSilence();
    }
  };
  scroller.addEventListener("scroll", onScrollEvent, { passive: true });
  scroller.addEventListener("scrollend", onLand);
  scroller.addEventListener("touchstart", onTouchStart, { passive: true });
  scroller.addEventListener("touchend", onTouchEnd, { passive: true });
  scroller.addEventListener("touchcancel", onTouchEnd, { passive: true });
  return () => {
    clearTimeout(stoppedTimeout);
    scroller.removeEventListener("scroll", onScrollEvent);
    scroller.removeEventListener("scrollend", onLand);
    scroller.removeEventListener("touchstart", onTouchStart);
    scroller.removeEventListener("touchend", onTouchEnd);
    scroller.removeEventListener("touchcancel", onTouchEnd);
  };
};
