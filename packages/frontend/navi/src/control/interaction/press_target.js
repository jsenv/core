/**
 * Where a press really landed, for an element reading a gesture out of it.
 *
 * A popup is painted OVER the page and stays a DOM descendant of whatever it
 * was written in — a dialog inside the card that opens it, a callout beside the
 * button it belongs to. Its pointer events therefore bubble through boxes it
 * covers, and a box reading a gesture off one of them answers for something
 * nobody aimed at it: a finger held in a sheet opening the card underneath the
 * sheet, a card the sheet is drawn from and that the finger cannot even reach.
 *
 * The same list, read for the same reason, as the drag sources in @jsenv/dom
 * (see DRAG_IGNORED_SELECTOR in drag_to.js) and as the selection rule in
 * interaction_press.js: a layer over the element (`[popover]`, `dialog`), and
 * something saying its press is its own business (`data-drag-ignore`, which is
 * what a popup outside the top layer says for itself).
 */

const LAYER_OVER_SELECTOR = "[data-drag-ignore],[popover],dialog";

/**
 * The nearest word wins: a layer INSIDE the element takes the press away from
 * it, one AROUND it does not — an element that IS the dialog, or that sits in
 * one, goes on answering its own presses.
 *
 * @param {EventTarget} target Where the event says the press landed.
 * @param {Element} element The element reading a gesture out of that press.
 * @returns {boolean}
 */
export const isPressOnLayerOver = (target, element) => {
  if (!target || typeof target.closest !== "function") {
    return false;
  }
  const layer = target.closest(LAYER_OVER_SELECTOR);
  return Boolean(layer) && !layer.contains(element);
};
