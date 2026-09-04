import { isScrollable } from "./is_scrollable.js";
import {
  getScrollContainer,
  getScrollContainerSet,
} from "./scroll_container.js";

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
 * Respects scroll-margin-* on the element and scroll-padding-* on the
 * container.
 *
 * @param {Element} el - The element to scroll into view.
 * @param {object} options
 * @param {Element} [options.container] - The scroll container to scroll. Defaults to getScrollContainer(el).
 * @param {"start"|"center"|"end"|"nearest"} [options.block="nearest"] - Vertical alignment.
 * @param {"start"|"center"|"end"|"nearest"} [options.inline="nearest"] - Horizontal alignment.
 * @param {"auto"|"instant"|"smooth"} [options.behavior] - Left out, the container's CSS scroll-behavior decides; "instant" is for a caller that measures the result in the same tick.
 */
export const scrollIntoViewScoped = (
  el,
  { container = getScrollContainer(el), behavior, ...rest } = {},
) => {
  if (!container) {
    return;
  }
  container.scrollTo({
    behavior,
    ...getScrollIntoViewScopedOffsets(el, { container, ...rest }),
  });
};

/**
 * Scrolls `el` into view in every scroll container between it and the
 * document, innermost first — the chain `Element.prototype.scrollIntoView`
 * walks, minus the boxes nobody can scroll back.
 *
 * `overflow: hidden` is the one that matters: it IS a scroll container, so
 * the native call spends scroll on it as readily as on any other, and there
 * it is spent for good — no scrollbar, no wheel, no touch gives it back. A
 * card clipping a drawing, holding something that overlaps its edge by 2px,
 * ends up 2px off until it re-renders. Only the containers `isScrollable`
 * recognizes on its own (without `includeHidden`) are moved; the ones that
 * merely clip are left where they are.
 *
 * Each container measures `el` where the inner ones just put it, so the outer
 * ones see the final position rather than the one they started from.
 *
 * @param {Element} el - The element to scroll into view.
 * @param {object} options - the same as scrollIntoViewScoped's, minus container.
 */
export const scrollIntoViewThroughScrollables = (el, options) => {
  for (const scrollContainer of getScrollContainerSet(el)) {
    // getScrollContainerSet already skips what only clips, except at the end
    // of the chain: with nothing scrollable left to find it hands back the
    // document scroller, which a scroll lock may have turned into a clip too.
    if (!isScrollable(scrollContainer)) {
      continue;
    }
    scrollIntoViewScoped(el, { ...options, container: scrollContainer });
  }
};

/**
 * Where the container would have to be scrolled for `el` to be in view — the
 * measure scrollIntoViewScoped acts on, handed out on its own for whoever must
 * stand BETWEEN two such answers rather than land on one: a row of tabs
 * scrolled the same fraction of the way as the slides it names are travelling
 * (see navi's <Nav>).
 *
 * @param {Element} el
 * @param {object} options - the same as scrollIntoViewScoped's.
 * @returns {{left: number, top: number}}
 */
export const getScrollIntoViewScopedOffsets = (
  el,
  {
    container = getScrollContainer(el),
    block = "nearest",
    inline = "nearest",
  } = {},
) => {
  const elRect = el.getBoundingClientRect();
  const style = getComputedStyle(el);

  const scrollMarginTop = parseFloat(style.scrollMarginTop) || 0;
  const scrollMarginBottom = parseFloat(style.scrollMarginBottom) || 0;
  const scrollMarginLeft = parseFloat(style.scrollMarginLeft) || 0;
  const scrollMarginRight = parseFloat(style.scrollMarginRight) || 0;

  const currentScrollTop = container.scrollTop;
  const currentScrollLeft = container.scrollLeft;

  // Where the container shows its content, in the coordinates
  // getBoundingClientRect speaks. The document scroller is a case apart: what
  // it shows is the viewport, sitting at the origin of those coordinates,
  // while its own box is the whole page and travels with the scroll — reading
  // that box would count the scroll twice and compare the element to the
  // height of the document rather than the height of the screen.
  let containerTop;
  let containerLeft;
  let containerHeight;
  let containerWidth;
  if (container === container.ownerDocument.scrollingElement) {
    containerTop = 0;
    containerLeft = 0;
    containerHeight = container.clientHeight;
    containerWidth = container.clientWidth;
  } else {
    const containerRect = container.getBoundingClientRect();
    containerTop = containerRect.top;
    containerLeft = containerRect.left;
    containerHeight = containerRect.height;
    containerWidth = containerRect.width;
  }

  // The band the container keeps free at each of its edges for whatever is
  // scrolled to — what a sticky header, a footer or a fixed bar reserves so an
  // element does not land underneath it (see navi's safe_area.js). The
  // scrollport shrinks by it on both axes, and every alignment below is against
  // that smaller rectangle.
  const containerStyle = getComputedStyle(container);
  const scrollPaddingTop = resolveScrollPadding(
    containerStyle.scrollPaddingTop,
    containerHeight,
  );
  const scrollPaddingBottom = resolveScrollPadding(
    containerStyle.scrollPaddingBottom,
    containerHeight,
  );
  const scrollPaddingLeft = resolveScrollPadding(
    containerStyle.scrollPaddingLeft,
    containerWidth,
  );
  const scrollPaddingRight = resolveScrollPadding(
    containerStyle.scrollPaddingRight,
    containerWidth,
  );
  const viewHeight = containerHeight - scrollPaddingTop - scrollPaddingBottom;
  const viewWidth = containerWidth - scrollPaddingLeft - scrollPaddingRight;

  // Element position relative to the container's scroll origin.
  const elTop = elRect.top - containerTop + currentScrollTop - scrollMarginTop;
  const elBottom = elTop + elRect.height + scrollMarginTop + scrollMarginBottom;
  const elLeft =
    elRect.left - containerLeft + currentScrollLeft - scrollMarginLeft;
  const elRight = elLeft + elRect.width + scrollMarginLeft + scrollMarginRight;

  // The two scroll positions that put the element against one edge of the view
  // or the other — every alignment below is one of them, or a point between.
  const scrollTopPuttingElAtViewStart = elTop - scrollPaddingTop;
  const scrollTopPuttingElAtViewEnd =
    elBottom - containerHeight + scrollPaddingBottom;
  const viewStart = currentScrollTop + scrollPaddingTop;
  const viewEnd = currentScrollTop + containerHeight - scrollPaddingBottom;

  let newScrollTop = currentScrollTop;
  if (block === "start") {
    newScrollTop = scrollTopPuttingElAtViewStart;
  } else if (block === "end") {
    newScrollTop = scrollTopPuttingElAtViewEnd;
  } else if (block === "center") {
    newScrollTop = elTop + (elRect.height - viewHeight) / 2 - scrollPaddingTop;
  } else {
    // nearest: scroll only if partially or fully out of view.
    // When the element is taller than the view, only scroll if it is
    // completely out of view — otherwise it is already as visible as possible.
    const elHeight = elBottom - elTop;
    if (elHeight <= viewHeight) {
      if (elTop < viewStart) {
        newScrollTop = scrollTopPuttingElAtViewStart;
      } else if (elBottom > viewEnd) {
        newScrollTop = scrollTopPuttingElAtViewEnd;
      }
    } else if (elBottom < viewStart) {
      newScrollTop = scrollTopPuttingElAtViewEnd;
    } else if (elTop > viewEnd) {
      newScrollTop = scrollTopPuttingElAtViewStart;
    }
  }

  const scrollLeftPuttingElAtViewStart = elLeft - scrollPaddingLeft;
  const scrollLeftPuttingElAtViewEnd =
    elRight - containerWidth + scrollPaddingRight;
  const viewLeftEdge = currentScrollLeft + scrollPaddingLeft;
  const viewRightEdge = currentScrollLeft + containerWidth - scrollPaddingRight;

  let newScrollLeft = currentScrollLeft;
  if (inline === "start") {
    newScrollLeft = scrollLeftPuttingElAtViewStart;
  } else if (inline === "end") {
    newScrollLeft = scrollLeftPuttingElAtViewEnd;
  } else if (inline === "center") {
    newScrollLeft = elLeft + (elRect.width - viewWidth) / 2 - scrollPaddingLeft;
  } else {
    // nearest: scroll only if partially or fully out of view.
    // When the element is wider than the view, only scroll if it is
    // completely out of view — otherwise it is already as visible as possible.
    const elWidth = elRight - elLeft;
    if (elWidth <= viewWidth) {
      if (elLeft < viewLeftEdge) {
        newScrollLeft = scrollLeftPuttingElAtViewStart;
      } else if (elRight > viewRightEdge) {
        newScrollLeft = scrollLeftPuttingElAtViewEnd;
      }
    } else if (elRight < viewLeftEdge) {
      newScrollLeft = scrollLeftPuttingElAtViewEnd;
    } else if (elLeft > viewRightEdge) {
      newScrollLeft = scrollLeftPuttingElAtViewStart;
    }
  }

  return {
    left: newScrollLeft,
    top: newScrollTop,
  };
};

// "auto" is the one keyword scroll-padding takes, and it means "the browser
// picks" — which is 0 everywhere in practice. Percentages resolve against the
// scrollport, and getComputedStyle hands them back as written.
const resolveScrollPadding = (value, scrollportSize) => {
  const number = parseFloat(value);
  if (Number.isNaN(number)) {
    return 0;
  }
  if (value.endsWith("%")) {
    return (number / 100) * scrollportSize;
  }
  return number;
};
