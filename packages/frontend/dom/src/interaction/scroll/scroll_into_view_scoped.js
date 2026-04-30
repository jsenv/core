import { getScrollContainer } from "./scroll_container.js";

/**
 * Scrolls el into view within a specific container only — does NOT scroll
 * any ancestor beyond that container (document, popover backdrop, etc.).
 *
 * Why not just use scrollIntoView({ container: "nearest" })?
 * It finds the nearest scrollable ancestor and stops there ONLY IF that
 * ancestor has visible scrollbar, otherwise browser walks further up,
 * potentially scrolling the document.
 * This is exactly the wrong behavior inside a popover or fixed panel.
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
    // nearest: scroll only if partially or fully out of view.
    // When the element is taller than the container, only scroll if it is
    // completely out of view — otherwise it is already as visible as possible.
    const scrollBottom = currentScrollTop + containerHeight;
    const elHeight = elBottom - elTop;
    if (elHeight <= containerHeight) {
      if (elTop < currentScrollTop) {
        newScrollTop = elTop;
      } else if (elBottom > scrollBottom) {
        newScrollTop = elBottom - containerHeight;
      }
    } else if (elBottom < currentScrollTop) {
      newScrollTop = elBottom - containerHeight;
    } else if (elTop > scrollBottom) {
      newScrollTop = elTop;
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
    // nearest: scroll only if partially or fully out of view.
    // When the element is wider than the container, only scroll if it is
    // completely out of view — otherwise it is already as visible as possible.
    const scrollRight = currentScrollLeft + containerWidth;
    const elWidth = elRight - elLeft;
    if (elWidth <= containerWidth) {
      if (elLeft < currentScrollLeft) {
        newScrollLeft = elLeft;
      } else if (elRight > scrollRight) {
        newScrollLeft = elRight - containerWidth;
      }
    } else if (elRight < currentScrollLeft) {
      newScrollLeft = elRight - containerWidth;
    } else if (elLeft > scrollRight) {
      newScrollLeft = elLeft;
    }
  }

  container.scrollTo({
    left: newScrollLeft,
    top: newScrollTop,
  });
};
