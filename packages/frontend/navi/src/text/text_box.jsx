import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";

const css = /* css */ `
  .navi_text_box {
    display: inline-flex;
    min-width: 0;
    flex-direction: row;
    align-items: flex-start;
  }

  .navi_text_box_content {
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .navi_text_box[data-single-line] .navi_text_box_content {
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: normal;
    overflow: hidden;
    overflow-wrap: normal;
  }
`;

/**
 * A text container that:
 * - Displays optional icon(s) before and/or after the text
 * - Shrinks its width to fit the longest rendered text line (no trailing blank space)
 * - Wraps long text by default (overflow-wrap: anywhere)
 * - Shows ellipsis for a single overflowing unwrappable line
 *
 * Props:
 *   iconBefore — element shown to the left of the text
 *   iconAfter  — element shown to the right of the text (stays on the same line)
 *   maxHeight  — CSS max-height string; when set, content that cannot wrap gets ellipsis
 *   children   — the text content
 */
export const TextBox = ({
  iconBefore,
  iconAfter,
  maxHeight,
  singleLine,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const boxRef = useRef(null);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    const boxEl = boxRef.current;
    const contentEl = contentRef.current;
    if (!boxEl || !contentEl) {
      return;
    }
    if (maxHeight) {
      boxEl.style.maxHeight = maxHeight;
      boxEl.style.overflow = "hidden";
    } else {
      boxEl.style.maxHeight = "";
      boxEl.style.overflow = "";
    }
    if (!singleLine) {
      adjustWidth(boxEl, contentEl);
    }
  });

  return (
    <Box
      ref={boxRef}
      flex
      inline
      {...rest}
      baseClassName="navi_text_box"
      data-single-line={singleLine ? "" : undefined}
    >
      {iconBefore}
      <span ref={contentRef} className="navi_text_box_content">
        {children}
      </span>
      {iconAfter}
    </Box>
  );
};

const adjustWidth = (boxEl, contentEl) => {
  // Reset any previously forced width so we measure the natural size
  boxEl.style.width = "";
  contentEl.style.width = "";
  contentEl.removeAttribute("data-overflow-ellipsis");

  const optimalWidth = measureOptimalContentWidth(contentEl);
  if (optimalWidth === null) {
    return;
  }

  contentEl.style.width = `${Math.ceil(optimalWidth)}px`;
};

// Returns the width of the longest rendered text line inside el,
// or null when there is only one line (no optimisation needed).
const measureOptimalContentWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  let lineCount = 0;
  let longestLineWidth = 0;
  for (const r of range.getClientRects()) {
    if (r.width === 0) {
      continue;
    }
    lineCount++;
    if (r.width > longestLineWidth) {
      longestLineWidth = r.width;
    }
  }
  if (lineCount <= 1) {
    return null;
  }
  return longestLineWidth;
};
