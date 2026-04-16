import { useLayoutEffect, useRef } from "preact/hooks";

// # TextLineAligner — how it works
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
// After layout, we read:
//   1. The anchor's bounding rect + canvas `fontBoundingBoxDescent` to derive the baseline Y.
//      (For any inline span, the font cell bottom always coincides with rect.bottom, so
//       baseline = rect.bottom - fontBoundingBoxDescent — this holds for all vertical-align values.)
//   2. The anchor's `actualBoundingBox` ascent/descent via canvas to get the ink height.
//   3. The child's bounding rect (minus any previously applied top correction) to get its
//      natural rendered top, without triggering a style reset + reflow.
//
// We then compute `desiredChildTopY` based on the `align` intention:
//   "center" → child midpoint aligns with anchor ink midpoint
//   "top"    → child top aligns with anchor ink top
//   "bottom" → child bottom aligns with anchor ink bottom
//
// `topOffset = desiredChildTopY - childNaturalTop` is applied as `position:relative; top:`.
//
// This works for any child display type (inline, inline-block, inline-flex…) because
// we measure the actual rendered box height via getBoundingClientRect

const css = /* css */ `
  .navi_text_line_anchor {
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
 * the child so that its visual position matches the requested `lineAlign` value — regardless of
 * font-size, display type (inline, inline-block, inline-flex…), or the active `vertical-align`.
 *
 * @param {"center"|"baseline"|"top"|"bottom"} [lineAlign="baseline"]
 *   - `"center"`   — child is vertically centered on the surrounding text's ink bounds
 *   - `"baseline"` — no correction applied; child sits wherever the browser places it (default)
 *   - `"top"`      — child top aligns with the surrounding text's ink top
 *   - `"bottom"`   — child bottom aligns with the surrounding text's ink bottom
 * @param {{ size?: number, verticalAlign?: string }} [lineLayout]
 *   Describes the surrounding line context. Used as layout-effect dependencies so the correction
 *   reruns when the surrounding text's font-size or vertical-align changes.
 * @param {import("preact").RefObject} childRef — ref on the child element to reposition
 */
export const TextLineAligner = ({
  children,
  lineAlign = "baseline",
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
      lineAlign,
    });
    if (topOffset) {
      childEl.style.position = "relative";
      childEl.style.top = `${topOffset}px`;
    } else {
      childEl.style.position = "";
      childEl.style.top = "";
    }
  }, [size, lineAlign, lineLayout?.size, lineLayout?.verticalAlign]);

  return (
    <>
      {children}
      <span ref={anchorRef} className="navi_text_line_anchor">
        &#8203;
      </span>
    </>
  );
};

const computeTopOffset = ({ anchorEl, childEl, lineAlign }) => {
  if (lineAlign === "baseline") {
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

  const anchorStyle = getComputedStyle(anchorEl);
  const anchorMetrics = measureFontAscDesc("M", anchorStyle);
  const [anchorABA, anchorABD] = anchorMetrics.actual;
  const anchorActH = anchorABA + anchorABD;
  const [, anchorFBBD] = anchorMetrics.font;

  // Estimate the baseline Y from the anchor's bounding rect.
  // For an inline span, the font cell bottom is always at the element's bottom edge
  // (regardless of vertical-align), so baseline = rect.bottom - fontBoundingBoxDescent.
  const anchorRect = anchorEl.getBoundingClientRect();
  const baselineY = anchorRect.bottom - anchorFBBD;
  const anchorInkTopY = baselineY - anchorABA;

  // Measure the child's current rect, then subtract any previously applied top correction
  // to recover its natural position — avoiding a style reset + reflow.
  const childRect = childEl.getBoundingClientRect();
  const childH = childRect.height;
  const previousTop = parseFloat(childEl.style.top) || 0;
  const childNaturalTop = childRect.top - previousTop;

  // Compute desired child top Y based on align intention.
  let desiredChildTopY = 0;
  if (lineAlign === "center") {
    const anchorInkCenterY = anchorInkTopY + anchorActH / 2;
    desiredChildTopY = anchorInkCenterY - childH / 2;
  } else if (lineAlign === "top") {
    desiredChildTopY = anchorInkTopY;
  } else if (lineAlign === "bottom") {
    desiredChildTopY = anchorInkTopY + anchorActH - childH;
  }

  return desiredChildTopY - childNaturalTop;
};

const canvas = document.createElement("canvas");
const measureFontAscDesc = (text, computedStyle) => {
  const ctx = canvas.getContext("2d");
  ctx.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
  const metrics = ctx.measureText(text);
  return {
    actual: [metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent],
    font: [metrics.fontBoundingBoxAscent, metrics.fontBoundingBoxDescent],
  };
};
