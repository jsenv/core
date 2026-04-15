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
 * @param {"center"|"baseline"|"start"|"end"} [align="center"]
 *   - `"center"`   — visual midpoint of children matches visual midpoint of surrounding text (default)
 *   - `"baseline"` — children sit on the surrounding text baseline, no offset applied
 *   - `"start"`    — top of children's text aligns with top of surrounding text
 *   - `"end"`      — bottom of children's text aligns with bottom of surrounding text
 */

export const SurroundingTextAligner = ({
  children,
  align = "center",
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
        style={{ width: 0, userSelect: "none", overflow: "hidden" }}
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
  const anchorMetrics = measureTextMetrics("M", anchorStyle);
  const childMetrics = measureTextMetrics("M", childStyle);
  const verticalAlign = anchorStyle.verticalAlign;

  // Step 1: compute the desired offset assuming baseline alignment (y=0 at baseline, positive downward).
  // This is how much we need to shift the child so that `align` is respected
  // when both elements share the same baseline.
  let topOffset = 0;
  if (align === "center") {
    const anchorMid = (anchorMetrics.descent - anchorMetrics.ascent) / 2;
    const childMid = (childMetrics.descent - childMetrics.ascent) / 2;
    topOffset = anchorMid - childMid;
  } else if (align === "start") {
    topOffset = childMetrics.ascent - anchorMetrics.ascent;
  } else if (align === "end") {
    topOffset = anchorMetrics.descent - childMetrics.descent;
  }

  // Step 2: if the parent uses a non-baseline vertical-align, the browser has already
  // shifted the anchor away from the baseline. The child wrapper inherits the same shift,
  // so we need to subtract it from our offset to avoid double-counting it.
  if (verticalAlign === "middle") {
    const anchorShift = (anchorMetrics.ascent - anchorMetrics.descent) / 2;
    const childShift = (childMetrics.ascent - childMetrics.descent) / 2;
    topOffset -= anchorShift - childShift;
  } else if (verticalAlign === "top" || verticalAlign === "text-top") {
    topOffset -= childMetrics.ascent - anchorMetrics.ascent;
  } else if (verticalAlign === "bottom" || verticalAlign === "text-bottom") {
    topOffset -= anchorMetrics.descent - childMetrics.descent;
  }

  return topOffset;
};

const canvas = document.createElement("canvas");
const measureTextMetrics = (text, computedStyle) => {
  const ctx = canvas.getContext("2d");
  ctx.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
  const metrics = ctx.measureText(text);
  return {
    ascent: metrics.actualBoundingBoxAscent,
    descent: metrics.actualBoundingBoxDescent,
  };
};
