import { getScrollContainer } from "./scroll_container.js";

/**
 * Scrolls el into view within a specific container only — does NOT scroll
 * any ancestor beyond that container (document, popover backdrop, etc.).
 *
 * Why not just use scrollIntoView({ block: "nearest" })?
 * Despite the name, the native "nearest" behavior still walks up ALL scrollable
 * ancestors. Even when a parent has overflow:auto but no visible scrollbar
 * (because content fits), browsers may still treat it as a scroll container
 * and adjust its scroll position — and the document scroll along with it.
 * scrollIntoViewScoped avoids this by targeting one container explicitly.
 *
 * Uses scrollTo() so CSS scroll-behavior:smooth on the container is respected.
 * Respects scroll-margin-* on the element.
 *
 * @param {Element} el - The element to scroll into view.
 * @param {object} options
 * @param {Element} [options.container] - The scroll container to scroll. Defaults to getScrollContainer(el).
 * @param {"start"|"center"|"end"|"nearest"} [options.block="nearest"] - Vertical alignment.
 * @param {"start"|"center"|"end"|"nearest"} [options.inline="nearest"] - Horizontal alignment.
 */
export const scrollIntoViewScoped = (
  el,
  {
    container = getScrollContainer(el),
    block = "nearest",
    inline = "nearest",
  } = {},
) => {
  if (!container) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const style = getComputedStyle(el);

  const scrollMarginTop = parseFloat(style.scrollMarginTop) || 0;
  const scrollMarginBottom = parseFloat(style.scrollMarginBottom) || 0;
  const scrollMarginLeft = parseFloat(style.scrollMarginLeft) || 0;
  const scrollMarginRight = parseFloat(style.scrollMarginRight) || 0;

  const currentScrollTop = container.scrollTop;
  const currentScrollLeft = container.scrollLeft;
  const containerHeight = containerRect.height;
  const containerWidth = containerRect.width;

  // Element position relative to the container's scroll origin.
  const elTop =
    elRect.top - containerRect.top + currentScrollTop - scrollMarginTop;
  const elBottom = elTop + elRect.height + scrollMarginTop + scrollMarginBottom;
  const elLeft =
    elRect.left - containerRect.left + currentScrollLeft - scrollMarginLeft;
  const elRight = elLeft + elRect.width + scrollMarginLeft + scrollMarginRight;

  let newScrollTop = currentScrollTop;
  if (block === "start") {
    newScrollTop = elTop;
  } else if (block === "end") {
    newScrollTop = elBottom - containerHeight;
  } else if (block === "center") {
    newScrollTop = elTop + (elRect.height - containerHeight) / 2;
  } else {
    // nearest: scroll only if partially or fully out of view
    const scrollBottom = currentScrollTop + containerHeight;
    if (elTop < currentScrollTop) {
      newScrollTop = elTop;
    } else if (elBottom > scrollBottom) {
      newScrollTop = elBottom - containerHeight;
    }
  }

  let newScrollLeft = currentScrollLeft;
  if (inline === "start") {
    newScrollLeft = elLeft;
  } else if (inline === "end") {
    newScrollLeft = elRight - containerWidth;
  } else if (inline === "center") {
    newScrollLeft = elLeft + (elRect.width - containerWidth) / 2;
  } else {
    // nearest
    const scrollRight = currentScrollLeft + containerWidth;
    if (elLeft < currentScrollLeft) {
      newScrollLeft = elLeft;
    } else if (elRight > scrollRight) {
      newScrollLeft = elRight - containerWidth;
    }
  }

  container.scrollTo({
    left: newScrollLeft,
    top: newScrollTop,
  });
};
