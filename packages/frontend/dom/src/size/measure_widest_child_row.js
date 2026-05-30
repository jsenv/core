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

  // Group children by row using their top position
  const rowsByTop = new Map();
  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    const top = Math.round(rect.top);
    const existing = rowsByTop.get(top);
    if (existing === undefined) {
      rowsByTop.set(top, { left: rect.left, right: rect.right });
    } else {
      if (rect.left < existing.left) {
        existing.left = rect.left;
      }
      if (rect.right > existing.right) {
        existing.right = rect.right;
      }
    }
  }

  if (rowsByTop.size <= 1) {
    return null;
  }

  let widestRowWidth = 0;
  for (const { left, right } of rowsByTop.values()) {
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
