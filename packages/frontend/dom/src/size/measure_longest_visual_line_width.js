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
 * and maximum `right` across all rects of the same line, then use
 * `right - left` as the line width. This is correct regardless of nesting
 * depth and works well for regular inline text content.
 *
 * ## Implementation note — lines are found by vertical overlap
 *
 * Boxes sharing a line do not share a `top`: an inline icon sized to 1em and
 * sitting on the baseline, a superscript, an inline-block, all start a pixel
 * or a fraction of one away from the text beside them (and that fraction
 * moves with a sub-pixel scroll offset). Grouping rects by their rounded
 * `top` would count such a box as a line of its own, and the "longest line"
 * would come out as the text without it — short enough to make it wrap once
 * applied as a width. A rect therefore joins the line it overlaps vertically
 * by more than half the smaller of the two heights: boxes on one line share
 * most of their height, while the text rects of two consecutive lines overlap
 * by a sliver at most (a line-height below the font's content height).
 *
 * Limitation: `range.getClientRects()` returns rects for text nodes and inline
 * boxes as laid out in the flow, ignoring any `overflow: hidden` or `max-width`
 * clipping applied to ancestor elements. If child elements clip their own
 * content (e.g. badges with `overflow: hidden` and `max-width`), the rects
 * will reflect the unclipped text size, producing a width larger than what is
 * visually rendered. In that case prefer `measureWidestChildRow`, which uses
 * each child's own `getBoundingClientRect()` and therefore respects clipping.
 *
 * @param {Element} el - The element whose text content should be measured.
 * @returns {number|null} Width in pixels of the longest visual line,
 *   or `null` if there is only one visual line.
 */
export const measureLongestVisualLineWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);

  const lines = [];
  for (const rect of range.getClientRects()) {
    if (rect.width === 0) {
      continue;
    }
    const line = lines.find((candidate) => sharesLine(candidate, rect));
    if (line === undefined) {
      lines.push({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      });
      continue;
    }
    if (rect.top < line.top) {
      line.top = rect.top;
    }
    if (rect.bottom > line.bottom) {
      line.bottom = rect.bottom;
    }
    if (rect.left < line.left) {
      line.left = rect.left;
    }
    if (rect.right > line.right) {
      line.right = rect.right;
    }
  }

  if (lines.length <= 1) {
    return null;
  }

  let longestLineWidth = 0;
  for (const { left, right } of lines) {
    const w = right - left;
    if (w > longestLineWidth) {
      longestLineWidth = w;
    }
  }
  return longestLineWidth;
};

const sharesLine = (line, rect) => {
  const overlapTop = rect.top > line.top ? rect.top : line.top;
  const overlapBottom = rect.bottom < line.bottom ? rect.bottom : line.bottom;
  const overlap = overlapBottom - overlapTop;
  if (overlap <= 0) {
    return false;
  }
  const rectHeight = rect.bottom - rect.top;
  const lineHeight = line.bottom - line.top;
  const smallerHeight = rectHeight < lineHeight ? rectHeight : lineHeight;
  return overlap > smallerHeight / 2;
};
