/**
 * The element `element` is genuinely `position: absolute`/`fixed` relative
 * to: its own nearest positioned ancestor (walking up the DOM tree), or
 * `document.documentElement` (the viewport) if none is found.
 *
 * Also aware of `element` itself being promoted to the top layer: a
 * `<dialog>` actually shown modally (`showModal()`, matches `:modal` — a
 * `.show()`'d, non-modal dialog does NOT match and is positioned like any
 * other in-flow element instead, walked up normally below) or a `[popover]`
 * element while actually shown (`:popover-open`) always uses the initial
 * containing block (the viewport) regardless of its own `position` or DOM
 * ancestry — walking up its own parent chain (what the rest of this
 * function does) would give the wrong answer for these two specifically,
 * since their real DOM position becomes irrelevant to their own containing
 * block the moment they're actually promoted.
 *
 * `document.documentElement` (not `document.body`, not `null`) is this
 * function's own "no real container — use the viewport" sentinel:
 * `documentElement` is the actual initial containing block, so the walk
 * below stops there without testing its own `position` (there's nothing
 * beyond it to fall back to anyway) — unlike the previous version of this
 * function, which stopped one level too early, at `document.body`, without
 * ever testing *its* `position` either (a `position: relative` body, for
 * instance, would have been silently skipped). Returning `documentElement`
 * instead of `null` also means no special-casing is needed by callers that
 * already compare a resolved container against `document.documentElement`
 * (see e.g. visible_rect.js's own `hasRealContainer` check).
 */
export const getPositionedParent = (element) => {
  const isPromotedToTopLayer =
    (element.tagName === "DIALOG" && element.matches(":modal")) ||
    element.matches(":popover-open");
  if (isPromotedToTopLayer) {
    return document.documentElement;
  }
  let parent = element.parentElement;
  while (parent && parent !== document.documentElement) {
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
  return document.documentElement;
};
