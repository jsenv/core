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
  ...props
}) => {
  const anchorRef = useRef();
  const childrenWrapperRef = useRef();

  useLayoutEffect(() => {
    const anchorEl = anchorRef.current;
    const childEl = childrenWrapperRef.current;
    if (!anchorEl || !childEl) {
      return;
    }

    const anchorStyle = getComputedStyle(anchorEl);
    const firstChild = childEl.firstElementChild || childEl;
    const childStyle = getComputedStyle(firstChild);
    const anchorFontSize = parseFloat(anchorStyle.fontSize);
    const childFontSize = parseFloat(childStyle.fontSize);

    if (anchorFontSize === childFontSize || align === "baseline") {
      childEl.style.position = "";
      childEl.style.top = "";
      return;
    }

    const anchorMetrics = measureTextMetrics("M", anchorStyle);
    const childMetrics = measureTextMetrics("M", childStyle);
    const verticalAlign = anchorStyle.verticalAlign;

    // Both anchor and child are placed by the browser using the same verticalAlign rule
    // (inherited from the parent). Since both are shifted by the same amount, relative
    // typographic positions between them stay consistent regardless of verticalAlign.
    // We compute the offset needed to satisfy `align` in typographic space (y=0 at baseline,
    // positive downward), then apply it as position:relative top on the child wrapper.
    //
    // Each verticalAlign changes where the "anchor reference point" sits, which in turn
    // changes what offset is needed to position the child at the intended `align`.
    let anchorRef_y = 0; // y of the anchor's "reference point" from baseline
    if (verticalAlign === "baseline" || verticalAlign === "") {
      anchorRef_y = 0; // anchor baseline = line box baseline
    } else if (verticalAlign === "middle") {
      // browser aligns anchor midpoint to parent's x-height / 2 above baseline
      // We approximate: anchor midpoint from baseline = -(ascent - descent) / 2
      anchorRef_y = (anchorMetrics.ascent - anchorMetrics.descent) / 2;
    } else if (verticalAlign === "top" || verticalAlign === "text-top") {
      anchorRef_y = -anchorMetrics.ascent; // anchor top at -ascent
    } else if (verticalAlign === "bottom" || verticalAlign === "text-bottom") {
      anchorRef_y = anchorMetrics.descent; // anchor bottom at +descent
    }

    // Desired position of child's reference point (same verticalAlign shift applies to child too)
    let desiredChild_y = 0;
    if (align === "center") {
      // child midpoint should match anchor midpoint
      const anchorMid =
        anchorRef_y - (anchorMetrics.ascent - anchorMetrics.descent) / 2;
      desiredChild_y =
        anchorMid + (childMetrics.ascent - childMetrics.descent) / 2;
    } else if (align === "start") {
      // child top should match anchor top
      const anchorTop = anchorRef_y - anchorMetrics.ascent;
      desiredChild_y = anchorTop + childMetrics.ascent;
    } else if (align === "end") {
      // child bottom should match anchor bottom
      const anchorBottom = anchorRef_y + anchorMetrics.descent;
      desiredChild_y = anchorBottom - childMetrics.descent;
    }

    // Child's natural baseline position without correction
    const childNatural_y = 0;
    const topOffset = desiredChild_y - childNatural_y;

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
      <span ref={childrenWrapperRef} {...props}>
        {children}
      </span>
    </>
  );
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
