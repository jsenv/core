import { createPubSub } from "../pub_sub.js";
import { getScrollableParent } from "../scroll/parent_scroll.js";
import { getElementVisualCoords } from "./visual_rect.js";

// Creates an overlay, the update function is meant to positions one element on top of another
export const initOverlay = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollableParent = getScrollableParent(element);
  const scrollableParentIsDocument =
    scrollableParent === document.documentElement;

  const updateOverlayRect = () => {
    // 1. Calculate element visible left/top
    const { scrollLeft, scrollTop } = scrollableParent;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;
    const [elementAbsoluteLeft, elementAbsoluteTop] = getElementVisualCoords(
      element,
      scrollableParent,
      { isStickyTop: true, isStickyLeft: true },
    );
    const leftVisible =
      visibleAreaLeft < elementAbsoluteLeft
        ? elementAbsoluteLeft - visibleAreaLeft
        : 0;
    const topVisible =
      visibleAreaTop < elementAbsoluteTop
        ? elementAbsoluteTop - visibleAreaTop
        : 0;
    // Convert to overlay coordinates (adjust for custom scrollable container)
    let overlayLeft = leftVisible;
    let overlayTop = topVisible;
    if (!scrollableParentIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollableParent.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    // 2. Calculate element visible width/height
    const { width, height } = element.getBoundingClientRect();
    const visibleAreaWidth = scrollableParent.clientWidth;
    const visibleAreaHeight = scrollableParent.clientHeight;
    const visibleAreaRight = visibleAreaLeft + visibleAreaWidth;
    const visibleAreaBottom = visibleAreaTop + visibleAreaHeight;
    // 2.1 Calculate visible width
    let widthVisible;
    {
      const maxVisibleWidth = visibleAreaWidth - leftVisible;
      const elementAbsoluteRight = elementAbsoluteLeft + width;
      const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
      const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
      if (elementLeftIsVisible && elementRightIsVisible) {
        // Element fully visible horizontally
        widthVisible = width;
      } else if (elementLeftIsVisible && !elementRightIsVisible) {
        // Element left is visible, right is cut off
        widthVisible = visibleAreaRight - elementAbsoluteLeft;
      } else if (!elementLeftIsVisible && elementRightIsVisible) {
        // Element left is cut off, right is visible
        widthVisible = elementAbsoluteRight - visibleAreaLeft;
      } else {
        // Element spans beyond both sides, show only visible area portion
        widthVisible = maxVisibleWidth;
      }
    }
    // 2.2 Calculate visible height
    let heightVisible;
    {
      const maxVisibleHeight = visibleAreaHeight - topVisible;
      const elementAbsoluteBottom = elementAbsoluteTop + height;
      const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
      const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;
      if (elementTopIsVisible && elementBottomIsVisible) {
        // Element fully visible vertically
        heightVisible = height;
      } else if (elementTopIsVisible && !elementBottomIsVisible) {
        // Element top is visible, bottom is cut off
        heightVisible = visibleAreaBottom - elementAbsoluteTop;
      } else if (!elementTopIsVisible && elementBottomIsVisible) {
        // Element top is cut off, bottom is visible
        heightVisible = elementAbsoluteBottom - visibleAreaTop;
      } else {
        // Element spans beyond both sides, show only visible area portion
        heightVisible = maxVisibleHeight;
      }
    }

    update(
      {
        left: overlayLeft,
        top: overlayTop,
        right: overlayLeft + widthVisible,
        bottom: overlayTop + heightVisible,
        width: widthVisible,
        height: heightVisible,
      },
      {
        width,
        height,
      },
    );
  };

  updateOverlayRect();

  update_on_scroll: {
    const onScroll = () => {
      updateOverlayRect();
    };
    scrollableParent.addEventListener("scroll", onScroll, { passive: true });
    addTeardown(() => {
      scrollableParent.removeEventListener("scroll", onScroll, {
        passive: true,
      });
    });
  }

  if (!scrollableParentIsDocument) {
    // If scrollable parent is not document, also listen to document scroll
    // to update UI position when the scrollable parent moves in viewport
    const onDocumentScroll = () => {
      updateOverlayRect(); // Update container position in viewport
    };
    document.addEventListener("scroll", onDocumentScroll, { passive: true });
    addTeardown(() => {
      document.removeEventListener("scroll", onDocumentScroll, {
        passive: true,
      });
    });
  }

  return {
    update: updateOverlayRect,
    destroy: () => {
      teardown();
    },
  };
};

// redispatch "scroll" events from document to documentElement
// This way getScrollableParent(el).addEventListener("scroll")
// can be used even if scrollable parent is documentElement
document.addEventListener(
  "scroll",
  (scrollEvent) => {
    const scrollEventCopy = new scrollEvent.constructor(scrollEvent.type, {
      bubbles: false,
      cancelable: scrollEvent.cancelable,
      composed: scrollEvent.composed,
    });
    document.documentElement.dispatchEvent(scrollEventCopy);
  },
  { passive: true },
);
