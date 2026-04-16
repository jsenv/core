import { useLayoutEffect, useRef } from "preact/hooks";

// # TextAnchor — how it works
//
// ## Problem
//
// When an inline element (badge, icon, …) has a different font-size than the surrounding text,
// the browser aligns it using its own font metrics. This shifts it up or down relative to the
// surrounding text in a way that looks visually wrong, and that CSS `vertical-align` alone
// cannot fully compensate for.
//
// ## Solution
//
// We render a zero-width space (&#8203;) — the "anchor" — directly before the child.
// The anchor inherits the surrounding text's font-size and sits at baseline, so the browser
// places it exactly where a character of the surrounding text would sit.
// Using vertical-align: baseline (not inherit) is intentional: when the surrounding text has no
// explicit vertical-align it sits at baseline of the line box. If we used inherit and a parent span
// had vertical-align: middle/super/sub, the anchor would shift away from the text, making the
// measurements wrong.
//
// After layout, we read the anchor's bounding rect (top/bottom = the line box bounds) and
// for char-top we also use canvas to measure the ink ascent of the surrounding font.
// The child's rect (minus any previously applied correction) gives its natural position.
//
// `topOffset = desiredChildTopY - childNaturalTop` is applied as `position:relative; top:`.

const css = /* css */ `
  .navi_text_anchor {
    vertical-align: baseline;
    user-select: none;
    overflow: hidden;
  }
`;

/**
 * Positions children vertically relative to the surrounding text, correcting for font-size differences.
 *
 * Place this component around any inline element whose font-size differs from the surrounding text.
 * It renders an invisible anchor that inherits the surrounding text's font metrics, then shifts
 * the child so that its visual position matches the requested `textAnchor` value — regardless of
 * font-size, display type (inline, inline-block, inline-flex…), or the active `vertical-align`.
 *
 * @param {"line-top"|"char-top"|"center"|"char-bottom"|"line-bottom"} [textAnchor="char-bottom"]
 *   - `"line-top"`    — child top aligns with the top of the surrounding line box
 *   - `"char-top"`    — child top aligns with the top of visible characters (ink ascent)
 *   - `"center"`      — child is vertically centered on the surrounding line box
 *   - `"char-bottom"` — child bottom aligns to the text baseline (no correction, browser default)
 *   - `"line-bottom"` — child bottom aligns with the bottom of the surrounding line box
 * @param {{ size?: number, verticalAlign?: string }} [lineLayout]
 *   Describes the surrounding line context. Used as layout-effect dependencies so the correction
 *   reruns when the surrounding text's font-size or vertical-align changes.
 * @param {import("preact").RefObject} childRef — ref on the child element to reposition
 */
export const TextAnchor = ({
  children,
  textAnchor = "char-bottom",
  childRef,
  lineLayout,
  size,
}) => {
  import.meta.css = css;

  const anchorRef = useRef();

  useLayoutEffect(() => {
    const anchorEl = anchorRef.current;
    const childEl = childRef.current;
    if (!anchorEl || !childEl) {
      return;
    }
    const topOffset = computeTopOffset({
      anchorEl,
      childEl,
      textAnchor,
    });
    if (topOffset) {
      childEl.style.position = "relative";
      childEl.style.top = `${topOffset}px`;
    } else {
      childEl.style.position = "";
      childEl.style.top = "";
    }
  }, [size, textAnchor, lineLayout?.size, lineLayout?.verticalAlign]);

  return (
    <>
      {children}
      <span ref={anchorRef} className="navi_text_anchor">
        &#8203;
      </span>
    </>
  );
};

const computeTopOffset = ({ anchorEl, childEl, textAnchor }) => {
  if (textAnchor === "char-bottom") {
    // The browser's natural CSS baseline alignment already places the element correctly:
    // the element's own baseline aligns to the line's baseline. No correction needed.
    return 0;
  }
  // Only correct when the anchor lives in an inline formatting context.
  // If the parent is a flex/grid container, inline layout rules don't apply
  // and our font-metrics model is invalid.
  const parentDisplay = getComputedStyle(anchorEl.parentElement).display;
  if (
    parentDisplay !== "inline" &&
    parentDisplay !== "inline-block" &&
    parentDisplay !== "block"
  ) {
    return 0;
  }

  // The anchor's rendered rect corresponds to the surrounding text's line box:
  // top and bottom are the visual bounds of the line (including line-height).
  const anchorRect = anchorEl.getBoundingClientRect();

  // Measure the child's current rect, then subtract any previously applied top correction
  // to recover its natural position — avoiding a style reset + reflow.
  const childRect = childEl.getBoundingClientRect();
  const childH = childRect.height;
  const previousTop = parseFloat(childEl.style.top) || 0;
  const childNaturalTop = childRect.top - previousTop;

  // Compute desired child top Y based on textAnchor intention.
  let desiredChildTopY = 0;
  if (textAnchor === "line-top") {
    desiredChildTopY = anchorRect.top;
  } else if (textAnchor === "char-top") {
    const anchorStyle = getComputedStyle(anchorEl);
    const ctx = charTopCanvas.getContext("2d");
    ctx.font = `${anchorStyle.fontWeight} ${anchorStyle.fontSize} ${anchorStyle.fontFamily}`;
    const m = ctx.measureText("M");
    const baselineY = anchorRect.bottom - m.fontBoundingBoxDescent;
    desiredChildTopY = baselineY - m.actualBoundingBoxAscent;
  } else if (textAnchor === "center") {
    const anchorCenterY = (anchorRect.top + anchorRect.bottom) / 2;
    desiredChildTopY = anchorCenterY - childH / 2;
  } else if (textAnchor === "char-bottom") {
    // Already handled above (early return 0), but guard here for completeness.
    return 0;
  } else if (textAnchor === "line-bottom") {
    desiredChildTopY = anchorRect.bottom - childH;
  }

  return desiredChildTopY - childNaturalTop;
};

const charTopCanvas = document.createElement("canvas");
