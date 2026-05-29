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
 * ## Implementation note — bounding extent, not sum of widths
 *
 * `range.getClientRects()` returns one rect per layout box intersecting the
 * range. Nested elements (e.g. `<span><span>text</span></span>`) produce
 * multiple overlapping rects for the exact same pixels on the same line.
 * Summing their `width` values therefore over-counts the true line width.
 *
 * Instead we compute the bounding extent per line: track the minimum `left`
 * and maximum `right` across all rects sharing the same rounded `top`, then
 * use `right - left` as the line width. This is correct regardless of nesting
 * depth and works well for regular inline text content.
 *
 * Limitation: rects are grouped by `Math.round(r.top)`, so elements on the
 * same visual line but with slightly different baselines (e.g. an icon taller
 * than surrounding text) could be counted as separate lines. This is unlikely
 * to matter in practice for normal text rendering.
 *
 * @param {Element} el - The element whose text content should be measured.
 * @returns {number|null} Width in pixels of the longest visual line,
 *   or `null` if there is only one visual line.
 */
export const measureLongestVisualLineWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);

  const lineBoundsByTop = new Map();
  for (const r of range.getClientRects()) {
    if (r.width === 0) {
      continue;
    }
    const top = Math.round(r.top);
    const existing = lineBoundsByTop.get(top);
    if (existing === undefined) {
      lineBoundsByTop.set(top, { left: r.left, right: r.right });
    } else {
      if (r.left < existing.left) {
        existing.left = r.left;
      }
      if (r.right > existing.right) {
        existing.right = r.right;
      }
    }
  }

  if (lineBoundsByTop.size <= 1) {
    return null;
  }

  let longestLineWidth = 0;
  for (const { left, right } of lineBoundsByTop.values()) {
    const w = right - left;
    if (w > longestLineWidth) {
      longestLineWidth = w;
    }
  }
  return longestLineWidth;
};
