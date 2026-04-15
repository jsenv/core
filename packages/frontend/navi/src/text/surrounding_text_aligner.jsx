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
  const [anchorAscent, anchorDescent] = anchorMetrics;
  const [childAscent, childDescent] = childMetrics;
  const anchorH = anchorAscent + anchorDescent;
  const childH = childAscent + childDescent;

  // After browser layout, compute the difference between anchor top and child top.
  // This depends on which vertical-align the browser applied to both elements.
  // (y axis: positive = downward, baseline = 0)
  //   baseline: anchor top = -anchorAscent, child top = -childAscent
  //   middle:   both midpoints at same midline M → deltaTop = (childH - anchorH) / 2
  //   top:      both tops at same line top       → deltaTop = 0
  //   bottom:   both bottoms at same line bottom  → deltaTop = childH - anchorH
  let deltaTop = 0;
  if (verticalAlign === "baseline" || verticalAlign === "") {
    deltaTop = childAscent - anchorAscent;
  } else if (verticalAlign === "middle") {
    deltaTop = (childH - anchorH) / 2;
  } else if (verticalAlign === "top" || verticalAlign === "text-top") {
    deltaTop = 0;
  } else if (verticalAlign === "bottom" || verticalAlign === "text-bottom") {
    deltaTop = childH - anchorH;
  }

  // offsetFactor determines where along the anchor's height range we target:
  //   0   → align tops   (start)
  //   0.5 → align centers (center)
  //   1   → align bottoms (end)
  let offsetFactor = 0;
  if (align === "center") {
    offsetFactor = 0.5;
  } else if (align === "end") {
    offsetFactor = 1;
  }

  return deltaTop + offsetFactor * (anchorH - childH);
};

const canvas = document.createElement("canvas");
const measureFontAscDesc = (text, computedStyle) => {
  const ctx = canvas.getContext("2d");
  ctx.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
  const metrics = ctx.measureText(text);
  return [metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent];
};
