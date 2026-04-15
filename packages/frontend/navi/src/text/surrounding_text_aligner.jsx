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

    // After baseline alignment, positions are relative to the shared baseline.
    // Anchor text top is at -anchorMetrics.ascent, bottom at +anchorMetrics.descent.
    // Child  text top is at -childMetrics.ascent,  bottom at +childMetrics.descent.
    let topOffset = 0;
    if (align === "center") {
      // midpoint from baseline: (descent - ascent) / 2
      const anchorMid = (anchorMetrics.descent - anchorMetrics.ascent) / 2;
      const childMid = (childMetrics.descent - childMetrics.ascent) / 2;
      topOffset = anchorMid - childMid;
    } else if (align === "start") {
      // align tops: child needs to move by (childAscent - anchorAscent)
      topOffset = childMetrics.ascent - anchorMetrics.ascent;
    } else if (align === "end") {
      // align bottoms: child needs to move by (anchorDescent - childDescent)
      topOffset = anchorMetrics.descent - childMetrics.descent;
    }

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
