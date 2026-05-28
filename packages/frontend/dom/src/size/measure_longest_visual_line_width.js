/**
 * Measures the width of the longest rendered visual line inside an element.
 *
 * Useful for solving the CSS "shrinkwrap" problem: when multi-line text sits
 * inside a `max-width` container, CSS expands the element to fill all
 * available space, leaving trailing whitespace to the right of the text.
 * Setting an explicit width equal to the longest line eliminates that gap.
 * See shrinkwrap_demo.html for a visual explanation.
 *
 * Returns `null` when all content fits on a single visual line (nothing to
 * optimize). Returns the pixel width of the widest line when text wraps to
 * two or more lines.
 *
 * @param {Element} el - The element whose text content should be measured.
 * @returns {number|null} Width in pixels of the longest visual line,
 *   or `null` if there is only one visual line.
 */
export const measureLongestVisualLineWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);

  const lineWidthByTop = new Map();
  for (const r of range.getClientRects()) {
    if (r.width === 0) {
      continue;
    }
    const top = Math.round(r.top);
    lineWidthByTop.set(top, (lineWidthByTop.get(top) || 0) + r.width);
  }

  if (lineWidthByTop.size <= 1) {
    return null;
  }

  let longestLineWidth = 0;
  for (const w of lineWidthByTop.values()) {
    if (w > longestLineWidth) {
      longestLineWidth = w;
    }
  }
  return longestLineWidth;
};
