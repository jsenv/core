export const getPositionedParent = (element) => {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const position = window.getComputedStyle(parent).position;
    if (
      position === "relative" ||
      position === "absolute" ||
      position === "fixed"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.body;
};

/**
 * Like `getPositionedParent`, but aware of `element` itself being promoted
 * to the top layer: an element with a `popover` attribute, or a `<dialog>`,
 * always uses the initial containing block (the viewport) once shown,
 * regardless of `position` or DOM ancestry — walking up its own parent
 * chain looking for a positioned ancestor (what `getPositionedParent` does)
 * would give the wrong answer for these two specifically, since their real
 * DOM position becomes irrelevant to their own containing block the moment
 * they're actually open.
 *
 * Returns `null` to mean "the viewport" (matching how a real anchor
 * resolves to `null`/no-anchor callers already treat that as a request for
 * viewport-relative positioning) for a popover/dialog element;
 * `getPositionedParent(element)` otherwise.
 */
export const getPositioningContainer = (element) => {
  if (element.hasAttribute("popover") || element.tagName === "DIALOG") {
    return null;
  }
  return getPositionedParent(element);
};
