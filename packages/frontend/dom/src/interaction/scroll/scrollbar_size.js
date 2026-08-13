import { getBorderSizes } from "../../size/get_border_sizes.js";
import { snapToPixel } from "../../size/snap_to_pixel.js";

/**
 * Returns [verticalScrollbarWidth, horizontalScrollbarHeight] as currently
 * rendered by `scrollableElement`, in px. Returns zeros when the element has no
 * classic scrollbar: no overflow, overlay scrollbars, `scrollbar-width: none`,
 * or a `::-webkit-scrollbar { display: none }` rule.
 *
 * The measurement is taken on the element itself (its own border box versus its
 * own content box) rather than on a probe node appended inside it. A probe
 * cannot answer this question: `scrollbar-width` and `::-webkit-scrollbar` are
 * not inherited, so a probe reports the platform default scrollbar size even
 * when the element renders no scrollbar at all.
 */
export const measureScrollbar = (scrollableElement) => {
  if (
    scrollableElement === document.documentElement ||
    scrollableElement === document.scrollingElement
  ) {
    // documentElement.clientWidth/Height report the viewport minus its
    // scrollbars, not this element's own box (which `max-width` can shrink), so
    // the border box to compare against is the window itself.
    return [
      snapToPixel(window.innerWidth - document.documentElement.clientWidth),
      snapToPixel(window.innerHeight - document.documentElement.clientHeight),
    ];
  }
  const { left, right, top, bottom } = getBorderSizes(scrollableElement);
  const scrollbarWidth =
    scrollableElement.offsetWidth -
    scrollableElement.clientWidth -
    left -
    right;
  const scrollbarHeight =
    scrollableElement.offsetHeight -
    scrollableElement.clientHeight -
    top -
    bottom;
  return [
    scrollbarWidth > 0 ? snapToPixel(scrollbarWidth) : 0,
    scrollbarHeight > 0 ? snapToPixel(scrollbarHeight) : 0,
  ];
};
