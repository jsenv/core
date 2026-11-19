/**
 * A box showing one of its parts at a time — a SlideContainer's slides, the
 * panes of a RouteTravel row — hands the keyboard from the part it leaves to the
 * part it arrives on, the way a popup opening does, and only then puts the
 * other parts out of reach. The two boxes are the same thing for whoever uses
 * them, so they hand over through the same steps:
 *
 * 1. Whether there is anything to hand over is read before anything is marked
 *    (focusIsLoose): `inert` takes the focus off an element on its own, and
 *    afterwards nothing tells whether it was inside.
 * 2. What the part being left holds is written down on it before it goes
 *    (markAutofocusRestore in focus_transfer.js), so coming back to it comes
 *    back to where one was.
 * 3. The interaction asking for the change is read while it is in hand
 *    (prepareFocusTransfer): which element a press landed on, whether the
 *    keyboard is the modality.
 * 4. The landing waits for the renders the change sets off (afterRendersSettle),
 *    and transfers into the part on screen (transferFocus), which reads that
 *    part's own marks again.
 * 5. Out of reach last (markOutOfReach), once the keyboard has moved on.
 */

/**
 * Whether the focus is the part being left's to hand over: on nothing, on the
 * box itself, or inside that part. Held anywhere else — a tab bar above the
 * box, a field beside it — it stays where it is.
 *
 * @param {Element} leavingElement
 * @param {Element} [boxElement]
 */
export const focusIsLoose = (leavingElement, boxElement) => {
  const focusedElement = document.activeElement;
  return (
    !focusedElement ||
    focusedElement === document.body ||
    (boxElement !== undefined && focusedElement === boxElement) ||
    leavingElement.contains(focusedElement)
  );
};

/**
 * Calls back once the renders a change sets off are over. Preact drains its
 * render queue in one go, the renders it cascades into included, so a microtask
 * queued from the commit runs after all of them: a part that a value re-renders
 * in a commit of its own, a screen keyed by it replacing its whole subtree, are
 * final by then. Nor can a part say when it is done from its own layout effect:
 * rendered in the same pass as the box, its effects run before the box has made
 * it the one on screen.
 *
 * @param {() => void} callback
 */
export const afterRendersSettle = (callback) => {
  queueMicrotask(callback);
};

/**
 * Every part but the one on screen out of reach — of the keyboard and of
 * assistive technology alike. Last of the steps: a browser takes the focus off
 * an element the moment it becomes inert, and done before the landing it would
 * drop the keyboard on document.body.
 *
 * @param {Element[]} partElements
 * @param {Element|null} currentElement
 */
export const markOutOfReach = (partElements, currentElement) => {
  for (const partElement of partElements) {
    partElement.toggleAttribute("inert", partElement !== currentElement);
  }
};
