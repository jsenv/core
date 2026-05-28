/**
 * Measures the width of the longest rendered visual line inside an element.
 *
 * Returns `null` when all content fits on a single visual line (no
 * measurement is useful in that case). Returns the width in pixels of the
 * widest line when text wraps to two or more lines.
 *
 * ### Why not just use `element.scrollWidth`?
 * `scrollWidth` gives the total content width, not the width of the longest
 * individual line in a multi-line block.
 *
 * ### Why not `Range.getClientRects()` directly?
 * `getClientRects()` returns one rect **per text node segment**, not per
 * visual line. Multiple adjacent text nodes (e.g. from JSX expressions) that
 * sit on the same visual line each produce their own rect at the same Y
 * position. We group rects by their rounded `top` value so that same-line
 * fragments are summed into a single visual-line width.
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
