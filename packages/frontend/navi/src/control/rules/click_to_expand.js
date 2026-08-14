/**
 * A control placed inside a region that expands on click — a `<summary>`, an
 * accordion header carrying `aria-expanded` — has its click read twice: once by
 * the control it was aimed at, once by the region around it. The second reading
 * is never wanted; a menu opened from a collapsed row should not also unfold the
 * row.
 *
 * Cancelling the click is the only way to stop the region: a `<summary>` runs
 * its default action after the propagation, so `stopPropagation` does not reach
 * it. And it can only be done once the control has taken the click for itself —
 * navi refuses an interaction on an already-cancelled event (see
 * `onRequestInteraction`), so cancelling any earlier silences the control
 * instead of the region.
 *
 * That moment — right after an interaction was allowed — only exists inside
 * navi, which is why the cancellation lives here rather than in application code.
 */

const CLICK_TO_EXPAND_SELECTOR = "summary, [aria-expanded]";
// A popup is written inside whatever opened it, but it is not part of it on
// screen: a control inside a popup must not be read as a click on the region
// the popup happens to be nested in.
const POPUP_SELECTOR = "[navi-control='popover'], [navi-control='dialog']";

/**
 * Cancels `event` when the control consumed a click that a surrounding
 * click-to-expand region would otherwise read as "unfold me".
 *
 * Does nothing when cancelling the click would also cancel what the control
 * itself does with it (a link navigating, a checkbox toggling): there, the two
 * behaviours cannot be separated and the control's own comes first.
 */
export const preventClickToExpand = (element, event) => {
  if (!event || event.type !== "click") {
    return;
  }
  if (event.defaultPrevented) {
    return;
  }
  if (!clickDefaultActionIsInert(element, event)) {
    return;
  }
  const parentElement = element.parentElement;
  if (!parentElement) {
    return;
  }
  // From the parent: a control that opens something carries its own
  // `aria-expanded` and would find itself.
  const clickToExpandRegion = findClickToExpandRegion(parentElement);
  if (!clickToExpandRegion) {
    return;
  }
  event.preventDefault();
};

const findClickToExpandRegion = (element) => {
  let ancestor = element;
  while (ancestor) {
    // Tested first: a popup carries `aria-expanded` of its own, so it would
    // otherwise pass for the region containing its own content.
    if (ancestor.matches(POPUP_SELECTOR)) {
      return null;
    }
    if (ancestor.matches(CLICK_TO_EXPAND_SELECTOR)) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
};

const clickDefaultActionIsInert = (element, event) => {
  if (!isInertOnClick(element)) {
    return false;
  }
  // The activation belongs to what was clicked, which can be deeper than the
  // control host (a button inside it) or above it (a label wrapping it).
  const { target } = event;
  if (target && target !== element && target.nodeType === 1) {
    let ancestor = target;
    while (ancestor) {
      if (!isInertOnClick(ancestor)) {
        return false;
      }
      ancestor = ancestor.parentElement;
    }
  }
  return true;
};

const NON_INERT_INPUT_TYPE_SET = new Set([
  "checkbox",
  "radio",
  "submit",
  "reset",
  "image",
  "file",
]);

const isInertOnClick = (element) => {
  const { tagName } = element;
  if (tagName === "A" || tagName === "AREA") {
    return !element.hasAttribute("href");
  }
  if (tagName === "LABEL") {
    // A label forwards the click to its control, whose activation would be
    // cancelled along with the click.
    return false;
  }
  if (tagName === "INPUT") {
    return !NON_INERT_INPUT_TYPE_SET.has(element.type);
  }
  if (tagName === "BUTTON") {
    return element.type === "button";
  }
  if (tagName === "SELECT") {
    // The click opens the option list; cancelling it leaves the select shut.
    return false;
  }
  return true;
};
