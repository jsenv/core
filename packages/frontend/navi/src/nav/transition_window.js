/**
 * The window two pages are seen through while one replaces the other, measured
 * at the one moment both exist and published for the length of the movement.
 *
 * Both ways of moving from one route to another need the same numbers, so they
 * are written under the same names and read by the same CSS formulas —
 * `route_travel.jsx` for a row a finger pushes, `route_transition.jsx` for a
 * relation between two pages. Only one of them ever plays at a time (there is
 * one view transition per document), which is what lets them share the names.
 *
 * What the numbers are for:
 *
 * - **the box the movement happens in**, in the WINDOW's coordinates. The
 *   pictures of a transition are drawn in the top layer, above everything, so
 *   no overflow of the document reaches them: where to cut them can only be
 *   said from outside the document, and this is where that outside is known.
 * - **the box is the two states TOGETHER**, not either one of them. The
 *   browser puts the group where the arriving state stands and animates it
 *   from where the state being left stood; both are wrong for the same reason
 *   — a window that is one of the two states cuts the other. Held at the
 *   rectangle that contains both, nothing either picture holds is ever cut by
 *   a box it never had, and the user never watches the window get anywhere.
 * - **where each state WAS**, which is not where the window stands: the two
 *   states are at the same place in the layout without being at the same place
 *   in the window — one page is scrolled and the other is not, one has a top
 *   bar over it and the other has the screen. Each picture is placed at its
 *   own corner inside the window.
 * - **where the arriving state IS, frame after frame.** The browser places the
 *   group from the live arriving element on every frame of the movement — that
 *   is what makes a picture pair follow an element that moves — and the
 *   formula that moves the group back to the window's corner cancels that
 *   placement with this corner. Read once, the two stop cancelling the moment
 *   anything scrolls the document under the movement (a slice landing and
 *   putting a row back, a list placing its default row, a height growing under
 *   a restored offset): the window drifts by as much, and both pictures with
 *   it — the photograph of the page being left included. So this corner alone
 *   is kept live, as often as the browser reads its side of it. It is also
 *   the arriving picture's own corner, which then stays where the page really
 *   is and lands with no jump when the pictures are dropped.
 * - **what moves the BOX, as opposed to what moves a page in it.** Two things
 *   move the box in the window and they mean opposite things. The scroller
 *   the pages scroll in — the document, for a row of tabs that is the screen;
 *   a frame with an overflow, for a row inside a card or a panel — moving is
 *   a page being scrolled: the arriving one follows it and the picture of the
 *   one leaving stays where that page stood. Everything ABOVE that scroller
 *   moving — the document under a card, a panel around a box — carries the
 *   box whole, with both pictures in it: nothing inside the box changed. So
 *   the window and the corner of the state being left are shifted by exactly
 *   that outer offset, at the hold (the two states may have been measured
 *   under different offsets, a navigation scrolls the document) and on every
 *   frame after (a wheel over a travel scrolls the document, the box being
 *   unpointable). Left at their window coordinates, the pictures stand where
 *   the box WAS: a white band opens at its top and they hang out of its
 *   bottom, over whatever is drawn there.
 * - **the band the state being left kept free**, next to the one the arriving
 *   state keeps free. A band is furniture — a fixed bar, a sticky row — and
 *   the pictures are cut at it so they are not watched painting over it. Read
 *   live it describes the arriving state alone, and a piece of furniture that
 *   belongs to only ONE of the two states is then treated as the frame of
 *   both: the page being left is cut at a bar it never had. Photographed here
 *   at the one moment the state being left still exists, the cut can be taken
 *   at what is furniture on BOTH sides (see the clip formulas).
 *
 * Only the measuring needs JS, and apart from the arriving corner and the
 * outer offset it happens at the one moment both states exist: the page
 * arriving is in the DOM and the transition has not started playing. The
 * window, the corner of the state being left and its band describe a state
 * that no longer exists, and measuring them again is what must never happen
 * — they are only ever carried along with the box.
 * Everything DERIVED from these numbers — the band a fixed bar covers, how far
 * a page travels — is derived in CSS, so the application's own numbers (the
 * room its bars give back, see layout/safe_area.js; what covers the box from
 * inside the document, --navi-transition-cover-* below) take part in it.
 */

/**
 * What covers the box from INSIDE the document: a sticky row of tabs above the
 * pages, a header pinned to the top of a scroller. Declared at zero and
 * written by whoever covers it, exactly as a fixed bar publishes the room it
 * gives back (layout/safe_area.js).
 *
 * A slot rather than a measurement, and a slot navi cannot fill itself: the
 * safe area answers for what is pinned to the WINDOW's edges, and a sticky row
 * is none of those — it lives in the document, below the bars, and covers the
 * top of the box exactly as a fixed bar covers the top of the screen. The
 * pictures of a transition are drawn in the top layer, where no z-index of the
 * document reaches them, so what the document paints over the box has to be
 * counted here or it is the pictures that paint over it.
 *
 * Each one is a distance inward from the band the safe area already leaves
 * free, so a row states its own height and nothing else: what the bars above
 * it take is already counted.
 *
 * Registered as lengths for the same reason the safe area is (safe_area.js):
 * the band has to be readable in pixels at the moment a page leaves.
 */
import { getScrollContainer } from "@jsenv/dom";

const TRANSITION_WINDOW_CSS = /* css */ `
  @property --navi-transition-cover-top {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-transition-cover-right {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-transition-cover-bottom {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-transition-cover-left {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }

  @layer navi {
    :root {
      --navi-transition-cover-top: 0px;
      --navi-transition-cover-right: 0px;
      --navi-transition-cover-bottom: 0px;
      --navi-transition-cover-left: 0px;
    }
  }
`;

// Called from the render of whatever needs the window, never at module scope:
// a page that never travels between routes must not carry this sheet, and a
// build that sees no caller drops the css with the function.
export const installTransitionWindowCss = () => {
  import.meta.css = TRANSITION_WINDOW_CSS;
};

const WINDOW_TOP_PROPERTY = "--navi-transition-window-top";
const WINDOW_LEFT_PROPERTY = "--navi-transition-window-left";
const WINDOW_WIDTH_PROPERTY = "--navi-transition-window-width";
const WINDOW_HEIGHT_PROPERTY = "--navi-transition-window-height";
const WINDOW_OLD_TOP_PROPERTY = "--navi-transition-window-old-top";
const WINDOW_OLD_LEFT_PROPERTY = "--navi-transition-window-old-left";
const WINDOW_NEW_TOP_PROPERTY = "--navi-transition-window-new-top";
const WINDOW_NEW_LEFT_PROPERTY = "--navi-transition-window-new-left";
const OLD_BAND_TOP_PROPERTY = "--navi-transition-old-band-top";
const OLD_BAND_RIGHT_PROPERTY = "--navi-transition-old-band-right";
const OLD_BAND_BOTTOM_PROPERTY = "--navi-transition-old-band-bottom";
const OLD_BAND_LEFT_PROPERTY = "--navi-transition-old-band-left";
const WINDOW_PROPERTIES = [
  WINDOW_TOP_PROPERTY,
  WINDOW_LEFT_PROPERTY,
  WINDOW_WIDTH_PROPERTY,
  WINDOW_HEIGHT_PROPERTY,
  WINDOW_OLD_TOP_PROPERTY,
  WINDOW_OLD_LEFT_PROPERTY,
  WINDOW_NEW_TOP_PROPERTY,
  WINDOW_NEW_LEFT_PROPERTY,
  OLD_BAND_TOP_PROPERTY,
  OLD_BAND_RIGHT_PROPERTY,
  OLD_BAND_BOTTOM_PROPERTY,
  OLD_BAND_LEFT_PROPERTY,
];

// Whose numbers are currently published. The window belongs to the movement
// that measured it, and only that one may take it down: a movement ending
// after another has replaced it must not wipe numbers the new one is standing
// on.
let windowOwner = null;
// Stops re-reading the arriving state's corner, when a movement is on.
let unfollowArrivingState = null;

/**
 * The state being left, taken while rendering is held — the page arriving is
 * not in the DOM yet, so this is still the one going away. Where its box
 * stands and what its furniture left free, which the arriving state answers
 * for differently and which nothing can be read back from once it is gone.
 */
export const measureTransitionWindowState = (element) => {
  return {
    rect: element.getBoundingClientRect(),
    band: readBand(),
    outerScroll: readOuterScroll(element),
  };
};

export const holdTransitionWindow = (owner, element, stateBefore) => {
  const bandBefore = stateBefore.band;
  const rectAfter = element.getBoundingClientRect();
  const bandAfter = readBand();
  const outerScroll = readOuterScroll(element);
  // The state being left, at where its box stands under the offset the box
  // is measured under NOW: what scrolled outside the box between the two
  // measures moved the box, not a page in it (see the top of the file).
  const rectBefore = shiftRect(
    stateBefore.rect,
    stateBefore.outerScroll.top - outerScroll.top,
    stateBefore.outerScroll.left - outerScroll.left,
  );
  // The rectangle that contains both states. It cannot be measured from one
  // side alone: a page arriving shorter than the one it replaces would cut the
  // one leaving, a page arriving taller would be cut itself, and either one
  // standing higher up than the other would be cut across.
  const top = rectBefore.top < rectAfter.top ? rectBefore.top : rectAfter.top;
  const left =
    rectBefore.left < rectAfter.left ? rectBefore.left : rectAfter.left;
  const bottom =
    rectBefore.bottom > rectAfter.bottom ? rectBefore.bottom : rectAfter.bottom;
  const right =
    rectBefore.right > rectAfter.right ? rectBefore.right : rectAfter.right;
  windowOwner = owner;
  const { style } = document.documentElement;
  style.setProperty(WINDOW_TOP_PROPERTY, `${top}px`);
  style.setProperty(WINDOW_LEFT_PROPERTY, `${left}px`);
  style.setProperty(WINDOW_WIDTH_PROPERTY, `${right - left}px`);
  style.setProperty(WINDOW_HEIGHT_PROPERTY, `${bottom - top}px`);
  style.setProperty(WINDOW_OLD_TOP_PROPERTY, `${rectBefore.top}px`);
  style.setProperty(WINDOW_OLD_LEFT_PROPERTY, `${rectBefore.left}px`);
  style.setProperty(WINDOW_NEW_TOP_PROPERTY, `${rectAfter.top}px`);
  style.setProperty(WINDOW_NEW_LEFT_PROPERTY, `${rectAfter.left}px`);
  const oldBand = bandTheCutMayBeRelaxedTo(bandBefore, bandAfter, rectAfter);
  style.setProperty(OLD_BAND_TOP_PROPERTY, `${oldBand.top}px`);
  style.setProperty(OLD_BAND_RIGHT_PROPERTY, `${oldBand.right}px`);
  style.setProperty(OLD_BAND_BOTTOM_PROPERTY, `${oldBand.bottom}px`);
  style.setProperty(OLD_BAND_LEFT_PROPERTY, `${oldBand.left}px`);
  followArrivingState(element, rectAfter, {
    outerScroll,
    windowTop: top,
    windowLeft: left,
    oldTop: rectBefore.top,
    oldLeft: rectBefore.left,
  });
};

// The live layout takes the box back. A discontinuity by construction — the
// window stands at the held height, the box is at its own — and an invisible
// one: the page arriving is fully in place, and the strip below it that the
// window still covers shows the page leaving only while it is still on screen.
export const releaseTransitionWindow = (owner) => {
  if (owner !== windowOwner) {
    return;
  }
  windowOwner = null;
  if (unfollowArrivingState) {
    unfollowArrivingState();
  }
  const { style } = document.documentElement;
  for (const property of WINDOW_PROPERTIES) {
    style.removeProperty(property);
  }
};

// The arriving state's corner, re-read every frame — as often as the browser
// refreshes the group's placement from the same element (see the top of the
// file) — and with it the offset outside the box, which carries the window
// and the corner of the state being left along. Requested, never awaited: the
// first call runs inside the update callback, where a frame cannot come.
// Written only when it moved: a custom property set on the root recomputes
// the style of the whole document.
const followArrivingState = (element, rectAtHold, heldAt) => {
  if (unfollowArrivingState) {
    unfollowArrivingState();
  }
  const { style } = document.documentElement;
  let top = rectAtHold.top;
  let left = rectAtHold.left;
  let outerTop = heldAt.outerScroll.top;
  let outerLeft = heldAt.outerScroll.left;
  let frame = requestAnimationFrame(function read() {
    const rect = element.getBoundingClientRect();
    if (rect.top !== top) {
      top = rect.top;
      style.setProperty(WINDOW_NEW_TOP_PROPERTY, `${top}px`);
    }
    if (rect.left !== left) {
      left = rect.left;
      style.setProperty(WINDOW_NEW_LEFT_PROPERTY, `${left}px`);
    }
    const outerScroll = readOuterScroll(element);
    if (outerScroll.top !== outerTop) {
      outerTop = outerScroll.top;
      const shift = heldAt.outerScroll.top - outerTop;
      style.setProperty(WINDOW_TOP_PROPERTY, `${heldAt.windowTop + shift}px`);
      style.setProperty(WINDOW_OLD_TOP_PROPERTY, `${heldAt.oldTop + shift}px`);
    }
    if (outerScroll.left !== outerLeft) {
      outerLeft = outerScroll.left;
      const shift = heldAt.outerScroll.left - outerLeft;
      style.setProperty(WINDOW_LEFT_PROPERTY, `${heldAt.windowLeft + shift}px`);
      style.setProperty(
        WINDOW_OLD_LEFT_PROPERTY,
        `${heldAt.oldLeft + shift}px`,
      );
    }
    frame = requestAnimationFrame(read);
  });
  unfollowArrivingState = () => {
    unfollowArrivingState = null;
    cancelAnimationFrame(frame);
  };
};

const shiftRect = (rect, byTop, byLeft) => {
  return {
    top: rect.top + byTop,
    bottom: rect.bottom + byTop,
    left: rect.left + byLeft,
    right: rect.right + byLeft,
  };
};

// What has scrolled OUTSIDE the box: the offsets of every scroller above the
// one the pages scroll in, the viewport's included. That nearest scroller is
// the pages' own — an offset there is a page scrolled, and it is not counted;
// a hidden overflow counts as one so that the box asked about is the same the
// travel asks about (see pagesScrollTheDocument in route_travel.jsx). What is
// pinned to the viewport (fixed, in the top layer) is not carried by the
// document's offset, and the walk stops under it.
const readOuterScroll = (element) => {
  let top = 0;
  let left = 0;
  let node = getScrollContainer(element, { includeHidden: true });
  while (node && !isDocumentScroller(node) && !isPinnedToViewport(node)) {
    const above = getScrollContainer(node, { includeHidden: true });
    if (!above) {
      break;
    }
    if (isDocumentScroller(above)) {
      top += window.scrollY;
      left += window.scrollX;
      break;
    }
    top += above.scrollTop;
    left += above.scrollLeft;
    node = above;
  }
  return { top, left };
};

const isDocumentScroller = (node) => {
  return node === document.documentElement || node === document.body;
};

const isPinnedToViewport = (node) => {
  return (
    node.hasAttribute("popover") ||
    (node.tagName === "DIALOG" && node.matches(":modal")) ||
    getComputedStyle(node).position === "fixed"
  );
};

// A band nothing can be wider than, published for an edge nothing is known
// about: taken as the smaller of the two, it leaves the live band standing on
// its own, which is the movement navi played before it knew any of this.
const BAND_UNKNOWN = 1e6;

// What the furniture leaves free on each edge, as a distance inward from that
// edge of the window: the app's safe area (everything pinned to the window's
// edges) plus what covers the box from inside the document.
const readBand = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  const readEdge = (edge) => {
    const safeArea = parseFloat(
      computedStyle.getPropertyValue(`--navi-safe-area-inset-${edge}`),
    );
    const cover = parseFloat(
      computedStyle.getPropertyValue(`--navi-transition-cover-${edge}`),
    );
    // A browser that cannot register a custom property hands back the calc()
    // it was written as rather than what it computes to (see safe_area.js).
    if (!Number.isFinite(safeArea) || !Number.isFinite(cover)) {
      return BAND_UNKNOWN;
    }
    return safeArea + cover;
  };
  return {
    top: readEdge("top"),
    right: readEdge("right"),
    bottom: readEdge("bottom"),
    left: readEdge("left"),
  };
};

// How far the cut may be opened for the picture being left — the band its own
// state kept free, which is the whole point of photographing it: furniture
// present in only one of the two states is not the frame, it is part of what
// changes, and cutting the page being left at a bar it never had shows its
// header being sliced instead of leaving.
//
// Never past what the picture ARRIVING needs, though: the cut is one line for
// both pictures, so opening it for one opens it for the other. A box that runs
// under the furniture it arrives beside — a page scrolled below a top bar —
// would then be watched painting over that bar for the length of the movement,
// which is what the cut exists to prevent. On such an edge the arriving band
// stands, and the page being left is cut as it always was.
const bandTheCutMayBeRelaxedTo = (bandBefore, bandAfter, rectAfter) => {
  return {
    top: rectAfter.top < bandAfter.top ? bandAfter.top : bandBefore.top,
    right:
      rectAfter.right > window.innerWidth - bandAfter.right
        ? bandAfter.right
        : bandBefore.right,
    bottom:
      rectAfter.bottom > window.innerHeight - bandAfter.bottom
        ? bandAfter.bottom
        : bandBefore.bottom,
    left: rectAfter.left < bandAfter.left ? bandAfter.left : bandBefore.left,
  };
};
