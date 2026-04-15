import { useLayoutEffect, useRef } from "preact/hooks";

/**
 * Aligns children vertically relative to the surrounding text, regardless of font-size differences.
 *
 * When inline content (e.g. a badge, an icon) has a different font-size than the surrounding text,
 * the browser aligns it using the child's own font metrics, which shifts it up or down visually.
 *
 * This component fixes that by:
 * 1. Rendering a zero-width space (&#8203;) that inherits the surrounding text's font-size,
 *    anchoring the baseline to the surrounding text context.
 * 2. Using canvas `measureText` to read actual typographic ascent/descent metrics from the DOM
 *    (unaffected by line-height or padding) and computing the exact `top` offset needed.
 *
 * The child's font-size is read from its first element child, so the badge/icon can declare
 * its own font-size directly without passing it as a prop.
 *
 * Two inputs determine the final offset:
 * - `align` prop (intention): where to position children relative to the surrounding text
 * - `vertical-align` CSS on the anchor (situation): how the browser currently places the anchor
 *   in the line box. Reading this lets us compute the correction needed to satisfy `align`,
 *   regardless of which `vertical-align` is active on the parent.
 *
 * @param {"center"|"baseline"|"start"|"end"} [align="baseline"]
 *   - `"center"`   — visual midpoint of children matches visual midpoint of surrounding text
 *   - `"baseline"` — children sit on the surrounding text baseline, no offset applied (default)
 *   - `"start"`    — top of children's text aligns with top of surrounding text
 *   - `"end"`      — bottom of children's text aligns with bottom of surrounding text
 */

export const SurroundingTextAligner = ({
  children,
  align = "baseline",
  childRef,
}) => {
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
      align,
    });
    if (topOffset) {
      childEl.style.position = "relative";
      childEl.style.top = `${topOffset}px`;
    } else {
      childEl.style.position = "";
      childEl.style.top = "";
    }
  });

  return (
    <>
      <span
        ref={anchorRef}
        style="width: 0; user-select: none; overflow: hidden; vertical-align: inherit"
      >
        &#8203;
      </span>
      {children}
    </>
  );
};

const computeTopOffset = ({ anchorEl, childEl, align }) => {
  const anchorStyle = getComputedStyle(anchorEl);
  const childStyle = getComputedStyle(childEl);
  const anchorFontSize = parseFloat(anchorStyle.fontSize);
  const childFontSize = parseFloat(childStyle.fontSize);
  if (anchorFontSize === childFontSize || align === "baseline") {
    return 0;
  }
  const anchorMetrics = measureFontAscDesc("M", anchorStyle);
  const childMetrics = measureFontAscDesc("M", childStyle);
  const verticalAlign = anchorStyle.verticalAlign;
  const [anchorABA, anchorABD] = anchorMetrics.actual;
  const [anchorFBBA, anchorFBBD] = anchorMetrics.font;
  const [childABA, childABD] = childMetrics.actual;
  const [childFBBA, childFBBD] = childMetrics.font;
  const anchorActH = anchorABA + anchorABD;
  const childActH = childABA + childABD;

  // Compute deltaTop = how far the child ink midpoint is below the anchor ink midpoint
  // after browser layout (positive = child mid is lower on screen).
  //
  // The browser positions elements using fontBoundingBox metrics (the full font cell),
  // not actualBoundingBox (ink bounds). We use FBBA/FBBD for deltaTop so our model
  // matches what the browser actually does, then use actual ink metrics for centering.
  //
  // Derivation for each vertical-align (ink mid from shared reference, then diff):
  //   baseline → both at shared baseline: ink mids differ by (childABA - anchorABA)
  //   bottom   → both bottoms at line bottom: ink mid = lineBottom - FBBD - ABA + actH/2
  //   top      → both tops at line top: ink mid = lineTop + FBBA - ABA + actH/2
  //   middle   → both mids at ~x-height/2: ink mid ≈ (FBBA+FBBD)/2 - ABA + actH/2 from baseline
  let deltaTop = 0;
  if (verticalAlign === "baseline" || verticalAlign === "") {
    deltaTop = childABA - anchorABA;
  } else if (verticalAlign === "middle") {
    deltaTop =
      (anchorFBBA + anchorFBBD) / 2 -
      (childFBBA + childFBBD) / 2 +
      childABA -
      anchorABA;
  } else if (verticalAlign === "top" || verticalAlign === "text-top") {
    deltaTop = anchorFBBA - anchorABA - (childFBBA - childABA);
  } else if (verticalAlign === "bottom" || verticalAlign === "text-bottom") {
    deltaTop = childFBBD + childABA - anchorFBBD - anchorABA;
  }

  // offsetFactor determines where along the anchor's actual ink height we target:
  //   0   → align ink tops   (start)
  //   0.5 → align ink centers (center)
  //   1   → align ink bottoms (end)
  let offsetFactor = 0;
  if (align === "center") {
    offsetFactor = 0.5;
  } else if (align === "end") {
    offsetFactor = 1;
  }

  return deltaTop + offsetFactor * (anchorActH - childActH);
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
