/**
 * How much room the fixed bars take on each edge, published for the safe area
 * to add up (see layout/safe_area.js — it declares the four variables written
 * here, and what reads them reads the sum, never these).
 *
 * Measured rather than declared: a bar's size comes from a prop, a theme
 * variable, its own content or the device's notch, and only the used value
 * knows all four.
 */

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
