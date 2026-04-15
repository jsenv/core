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
    // Reset any previous correction so getBoundingClientRect reflects natural position.
    childEl.style.top = "";
    childEl.style.position = "";
    const topOffset = computeTopOffset({
      anchorEl,
      childEl,
      align,
    });
    if (topOffset) {
      childEl.style.position = "relative";
      childEl.style.top = `${topOffset}px`;
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
  const [anchorABA, anchorABD] = anchorMetrics.actual;
  const anchorActH = anchorABA + anchorABD;
  const [, anchorFBBD] = anchorMetrics.font;

  // Estimate the baseline Y from the anchor's bounding rect.
  // For an inline span, the font cell bottom is always at the element's bottom edge
  // (regardless of vertical-align), so baseline = rect.bottom - fontBoundingBoxDescent.
  const anchorRect = anchorEl.getBoundingClientRect();
  const baselineY = anchorRect.bottom - anchorFBBD;
  const anchorInkTopY = baselineY - anchorABA;

  // Measure the child's natural top (reset was done before calling this function).
  const childRect = childEl.getBoundingClientRect();
  const childH = childRect.height;

  // Compute desired child top Y based on align intention.
  let desiredChildTopY = 0;
  if (align === "center") {
    const anchorInkCenterY = anchorInkTopY + anchorActH / 2;
    desiredChildTopY = anchorInkCenterY - childH / 2;
  } else if (align === "start") {
    desiredChildTopY = anchorInkTopY;
  } else if (align === "end") {
    desiredChildTopY = anchorInkTopY + anchorActH - childH;
  }

  return desiredChildTopY - childRect.top;
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
