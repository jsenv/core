import { createPubSub } from "../pub_sub.js";
import { getScrollableParent } from "../scroll/parent_scroll.js";

// Est ce que c'est pas juste exactement intersection observer tout ca?
// en tous cas on va reprendre le code de follow_position le renommer et reprendre lintercae avec juste element, update
// éviter le nom overlay, c'est juste un cas d'usage du "intersectionEffect"
// sachant que pour le follow position on a pas de scrollable parent concept
// surement une option un moment donné

// Creates an overlay, the update function is meant to positions one element on top of another
export const visibleRectEffect = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollableParent = getScrollableParent(element);
  const scrollableParentIsDocument =
    scrollableParent === document.documentElement;

  const checkVisibleRect = () => {
    // 1. Calculate element position relative to scrollable parent
    const { scrollLeft, scrollTop } = scrollableParent;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;

    // Get element position relative to its scrollable parent
    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollableParentIsDocument) {
      // For document scrolling, use offsetLeft/offsetTop relative to document
      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {
      // For custom container, get position relative to the container
      const elementRect = element.getBoundingClientRect();
      const containerRect = scrollableParent.getBoundingClientRect();
      elementAbsoluteLeft = elementRect.left - containerRect.left + scrollLeft;
      elementAbsoluteTop = elementRect.top - containerRect.top + scrollTop;
    }

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

  checkVisibleRect();
  auto_check: {
    const [beforeCheck, onBeforeCheck] = createPubSub();
    let rafId = null;
    const scheduleCheck = (reason) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const beforeCheckResults = beforeCheck(reason);
        checkVisibleRect();
        for (const beforeCheckResult of beforeCheckResults) {
          if (typeof beforeCheckResult === "function") {
            beforeCheckResult();
          }
        }
      });
    };
    addTeardown(() => {
      cancelAnimationFrame(rafId);
    });

    on_scroll: {
      const onScroll = () => {
        checkVisibleRect();
      };
      scrollableParent.addEventListener("scroll", onScroll, { passive: true });
      addTeardown(() => {
        scrollableParent.removeEventListener("scroll", onScroll, {
          passive: true,
        });
      });
    }
    on_window_resize: {
      const onWindowResize = () => {
        checkVisibleRect();
      };
      window.addEventListener("resize", onWindowResize);
      addTeardown(() => {
        window.removeEventListener("resize", onWindowResize);
      });
    }
    if (!scrollableParentIsDocument) {
      // If scrollable parent is not document, also listen to document scroll
      // to update UI position when the scrollable parent moves in viewport
      const onDocumentScroll = () => {
        checkVisibleRect(); // Update container position in viewport
      };
      document.addEventListener("scroll", onDocumentScroll, { passive: true });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true,
        });
      });
    }

    on_element_size_change: {
      const resizeObserver = new ResizeObserver(() => {
        scheduleCheck("size_change");
      });
      resizeObserver.observe(element);
      // Temporarily disconnect ResizeObserver to prevent feedback loops
      onBeforeCheck(() => {
        resizeObserver.unobserve(element);
        return () => {
          resizeObserver.observe(element);
        };
      });
      addTeardown(() => {
        resizeObserver.disconnect();
      });
    }
  }

  return {
    check: checkVisibleRect,
    disconnect: () => {
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
