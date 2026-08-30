/**
 * The window two pages are seen through while one replaces the other, measured
 * once and published for the length of the movement.
 *
 * Both ways of moving from one route to another need the same six numbers, so
 * they are written under the same names and read by the same CSS formulas —
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
 * - **the height it is held at**, the taller of the two states. Left to the
 *   browser the window's height animates from one to the other, and a window
 *   that changes size under the pictures cuts the page being left from the
 *   bottom, progressively. It does end up at the arriving height, and that is
 *   right; what must not happen is the user watching it get there.
 * - **where the page being left WAS**, which is not where the window stands:
 *   the two states are at the same place in the layout without being at the
 *   same place in the window — one page is scrolled and the other is not.
 *   Drawn at the window's own corner, the page being left would be seen
 *   jumping to its top before it begins to leave.
 *
 * Only the measuring needs JS, and only for the one moment both states exist:
 * the page arriving is in the DOM and the transition has not started playing.
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
 */
export const TRANSITION_WINDOW_CSS = /* css */ `
  @layer navi {
    :root {
      --navi-transition-cover-top: 0px;
      --navi-transition-cover-right: 0px;
      --navi-transition-cover-bottom: 0px;
      --navi-transition-cover-left: 0px;
    }
  }
`;

const WINDOW_TOP_PROPERTY = "--navi-transition-window-top";
const WINDOW_LEFT_PROPERTY = "--navi-transition-window-left";
const WINDOW_WIDTH_PROPERTY = "--navi-transition-window-width";
const WINDOW_HEIGHT_PROPERTY = "--navi-transition-window-height";
const WINDOW_OLD_TOP_PROPERTY = "--navi-transition-window-old-top";
const WINDOW_OLD_LEFT_PROPERTY = "--navi-transition-window-old-left";
const WINDOW_PROPERTIES = [
  WINDOW_TOP_PROPERTY,
  WINDOW_LEFT_PROPERTY,
  WINDOW_WIDTH_PROPERTY,
  WINDOW_HEIGHT_PROPERTY,
  WINDOW_OLD_TOP_PROPERTY,
  WINDOW_OLD_LEFT_PROPERTY,
];

// Whose numbers are currently published. The window belongs to the movement
// that measured it, and only that one may take it down: a movement ending
// after another has replaced it must not wipe numbers the new one is standing
// on.
let windowOwner = null;

export const holdTransitionWindow = (owner, element, rectBefore) => {
  const rectAfter = element.getBoundingClientRect();
  // It cannot be measured from one side alone: a page arriving shorter than
  // the one it replaces would cut the one leaving, a page arriving taller
  // would be cut itself.
  const height =
    rectBefore.height > rectAfter.height ? rectBefore.height : rectAfter.height;
  windowOwner = owner;
  const { style } = document.documentElement;
  style.setProperty(WINDOW_TOP_PROPERTY, `${rectAfter.top}px`);
  style.setProperty(WINDOW_LEFT_PROPERTY, `${rectAfter.left}px`);
  style.setProperty(WINDOW_WIDTH_PROPERTY, `${rectAfter.width}px`);
  style.setProperty(WINDOW_HEIGHT_PROPERTY, `${height}px`);
  style.setProperty(WINDOW_OLD_TOP_PROPERTY, `${rectBefore.top}px`);
  style.setProperty(WINDOW_OLD_LEFT_PROPERTY, `${rectBefore.left}px`);
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
  const { style } = document.documentElement;
  for (const property of WINDOW_PROPERTIES) {
    style.removeProperty(property);
  }
};
