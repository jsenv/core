/**
 * The room a fixed bar takes from the content, published so whatever scrolls
 * under it can give that room back.
 *
 * There are TWO rooms to give back, and forgetting the second one is the
 * classic bug:
 *
 * - **padding**, so the end of the content can be scrolled out from under the
 *   bar. Without it the last screenful stays covered, unreachable.
 * - **scroll-padding**, so anything the browser scrolls TO lands in front of
 *   the bar rather than under it. An anchor link, `scrollIntoView()`, a focused
 *   field brought into view, restoring a scroll position — all of them align
 *   the target with the edge of the scrollport, which is behind the bar. The
 *   padding above does not help here: it moves the content, not the place the
 *   browser scrolls the target to.
 *
 * Published on <html> as CSS variables rather than applied to some element:
 * which element scrolls is the app's business, and an app with more than one
 * would have to fight a component that picked for it. The app either marks its
 * scrolling area with `data-navi-fixed-bar-space` (the rules below) or reads
 * the variables itself. `:root` gets the scroll-padding unconditionally,
 * because the document is the scrollport in the common case and an anchor
 * landing under a bar is never what anyone wants.
 *
 * The variables hold the measured size of the bars on that edge — see the
 * comment where FixedBar sets them.
 */

export const FIXED_BAR_SPACE_CSS = /* css */ `
  :root {
    --navi-fixed-bar-space-top: 0px;
    --navi-fixed-bar-space-bottom: 0px;
    --navi-fixed-bar-space-left: 0px;
    --navi-fixed-bar-space-right: 0px;

    scroll-padding-top: var(--navi-fixed-bar-space-top);
    scroll-padding-right: var(--navi-fixed-bar-space-right);
    scroll-padding-bottom: var(--navi-fixed-bar-space-bottom);
    scroll-padding-left: var(--navi-fixed-bar-space-left);
  }

  /* Put this on whatever scrolls under the bars. */
  [data-navi-fixed-bar-space] {
    padding-top: var(--navi-fixed-bar-space-top);
    padding-right: var(--navi-fixed-bar-space-right);
    padding-bottom: var(--navi-fixed-bar-space-bottom);
    padding-left: var(--navi-fixed-bar-space-left);

    scroll-padding-top: var(--navi-fixed-bar-space-top);
    scroll-padding-right: var(--navi-fixed-bar-space-right);
    scroll-padding-bottom: var(--navi-fixed-bar-space-bottom);
    scroll-padding-left: var(--navi-fixed-bar-space-left);
  }
`;

// Several bars can share an edge — during a page transition the outgoing and
// the incoming one are both mounted. They are all pinned to that same edge, so
// they overlap: the room to give back is the largest of them, not their sum,
// and one leaving must leave the others' room in place.
const sizeMapByArea = new Map();
// What is currently on <html> for each area (absent = the variable is not set).
// Writing the value that is already there would invalidate layout for nothing,
// and several bars sharing an edge means most calls compute the same largest
// size again — the ones for the smaller bars, and the second half of a page
// transition.
const writtenValueByArea = new Map();

// A size that must land before the next paint: a render changed the bar, so
// the room it takes is given back in that same commit and the content is never
// painted under it.
/**
 * @param {"top"|"bottom"|"left"|"right"} area
 * @param {Element} barElement - Which bar this size belongs to.
 * @param {number|null} size - In px; `null` gives that bar's room back to the
 *   content.
 */
export const setFixedBarSpace = (area, barElement, size) => {
  dropPendingSize(area, barElement);
  storeSize(area, barElement, size);
  writeSpace(area);
};

// A size nothing asked for, coming from a ResizeObserver. Writing the variable
// resizes an ANCESTOR of the bars — the scroll container takes its padding
// from it — and mutating layout from inside a resize callback is what makes
// the browser report "ResizeObserver loop completed with undelivered
// notifications". So the write waits for the frame that resize produced.
// Queued here rather than deferred by each bar on its own, so the bars sharing
// an edge resolve to a single write instead of one per bar.
/**
 * @param {"top"|"bottom"|"left"|"right"} area
 * @param {Element} barElement - Which bar this size belongs to.
 * @param {number} size - In px.
 */
export const requestFixedBarSpace = (area, barElement, size) => {
  let pendingSizeMap = pendingSizeMapByArea.get(area);
  if (!pendingSizeMap) {
    pendingSizeMap = new Map();
    pendingSizeMapByArea.set(area, pendingSizeMap);
  }
  pendingSizeMap.set(barElement, size);
  if (flushFrame !== null) {
    return;
  }
  flushFrame = requestAnimationFrame(flushPendingSizes);
};

const pendingSizeMapByArea = new Map();
let flushFrame = null;

const flushPendingSizes = () => {
  flushFrame = null;
  for (const [area, pendingSizeMap] of pendingSizeMapByArea) {
    for (const [barElement, size] of pendingSizeMap) {
      storeSize(area, barElement, size);
    }
    writeSpace(area);
  }
  pendingSizeMapByArea.clear();
};

// What the bar itself just said wins over what its observer had queued about
// it: a bar unmounting gives its room back, and a size queued for it before
// that must not put it back.
const dropPendingSize = (area, barElement) => {
  const pendingSizeMap = pendingSizeMapByArea.get(area);
  if (!pendingSizeMap) {
    return;
  }
  pendingSizeMap.delete(barElement);
  if (pendingSizeMap.size === 0) {
    pendingSizeMapByArea.delete(area);
  }
};

const storeSize = (area, barElement, size) => {
  let sizeMap = sizeMapByArea.get(area);
  if (!sizeMap) {
    sizeMap = new Map();
    sizeMapByArea.set(area, sizeMap);
  }
  if (size === null) {
    sizeMap.delete(barElement);
  } else {
    sizeMap.set(barElement, size);
  }
};

const writeSpace = (area) => {
  const sizeMap = sizeMapByArea.get(area);
  let largestSize = 0;
  for (const barSize of sizeMap.values()) {
    if (barSize > largestSize) {
      largestSize = barSize;
    }
  }
  const property = `--navi-fixed-bar-space-${area}`;
  const { style } = document.documentElement;
  if (sizeMap.size === 0) {
    if (writtenValueByArea.has(area)) {
      writtenValueByArea.delete(area);
      style.removeProperty(property);
    }
    return;
  }
  const value = `${largestSize}px`;
  if (writtenValueByArea.get(area) === value) {
    return;
  }
  writtenValueByArea.set(area, value);
  style.setProperty(property, value);
};
