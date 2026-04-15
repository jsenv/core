import { useLayoutEffect, useRef } from "preact/hooks";

// SurroundingTextAligner aligns its children vertically relative to the surrounding
// text — independently of the children's own font-size.
//
// Problem: when you place inline content (e.g. a badge, an icon) next to text at a
// different font-size, the browser aligns it using the child's own font metrics, which
// shifts it up or down relative to the surrounding text.
//
// Solution: a zero-width space (&#8203;) is rendered at the *surrounding* text's font-size
// before the children. It participates in the inline line box and gives a stable
// vertical reference at the surrounding text's baseline — regardless of the children's
// font-size. Canvas measureText is used to get actual typographic ascent/descent metrics
// (unaffected by line-height or padding) to compute the exact offset needed.
//
// The `align` prop controls how children are positioned against the surrounding text:
//   "center"   (default) — visual midpoint of children matches visual midpoint of surrounding text
//   "baseline"           — children sit on the surrounding text baseline (no offset)
//   "start"              — top of children's text aligns with top of surrounding text
//   "end"                — bottom of children's text aligns with bottom of surrounding text
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
