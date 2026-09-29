import { sharesLine } from "./measure_longest_visual_line_width.js";

// Measures the width of the widest row of direct children.
// Uses children's bounding rects (which respect overflow:hidden / max-width)
// rather than Range.getClientRects() which sees through clipping boundaries.
// Returns null when all children fit on a single row (nothing to optimize).
export const measureWidestChildRow = (el) => {
  const children = Array.from(el.children);
  if (children.length === 0) {
    return null;
  }

  const containerStyle = getComputedStyle(el);
  const paddingLeft = parseFloat(containerStyle.paddingLeft);
  const paddingRight = parseFloat(containerStyle.paddingRight);
  const borderLeft = parseFloat(containerStyle.borderLeftWidth);
  const borderRight = parseFloat(containerStyle.borderRightWidth);

  // Rows are found by vertical overlap, not by top: in an "align-items: center"
  // row, a child taller than its neighbours (a 1px border is enough) starts
  // higher than them and would open a row of its own.
  const rows = [];
  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    const row = rows.find((candidate) => sharesLine(candidate, rect));
    if (row === undefined) {
      rows.push({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      });
      continue;
    }
    if (rect.top < row.top) {
      row.top = rect.top;
    }
    if (rect.bottom > row.bottom) {
      row.bottom = rect.bottom;
    }
    if (rect.left < row.left) {
      row.left = rect.left;
    }
    if (rect.right > row.right) {
      row.right = rect.right;
    }
  }

  if (rows.length <= 1) {
    return null;
  }

  let widestRowWidth = 0;
  for (const { left, right } of rows) {
    const rowWidth = right - left;
    if (rowWidth > widestRowWidth) {
      widestRowWidth = rowWidth;
    }
  }

  // Convert from absolute pixel width to the container's content-box width
  // so that setting el.style.width = result + "px" works correctly.
  if (containerStyle.boxSizing === "border-box") {
    return (
      widestRowWidth + paddingLeft + paddingRight + borderLeft + borderRight
    );
  }
  return widestRowWidth;
};
