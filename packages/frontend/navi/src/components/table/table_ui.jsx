import {
  createPubSub,
  getElementVisualCoords,
  getScrollableParent,
} from "@jsenv/dom";
import { createPortal, forwardRef } from "preact/compat";
import { useLayoutEffect } from "preact/hooks";

import { Z_INDEX_TABLE_UI } from "./z_indexes.js";

import.meta.css = /* css */ `
  .navi_table_ui {
    position: fixed;
    z-index: ${Z_INDEX_TABLE_UI};
    overflow: hidden; /* Ensure UI elements cannot impact scrollbars of the document  */
    inset: 0;
    pointer-events: none; /* UI elements must use pointer-events: auto if they need to be interactive */
    background: rgba(0, 255, 0, 0.2);
  }

  .navi_table_ui_container {
    position: absolute;
    left: var(--table-visual-left);
    top: var(--table-visual-top);
    width: var(--table-visual-width);
    height: var(--table-visual-height);
    background: rgba(0, 0, 0, 0.7);
  }
`;

export const TableUI = forwardRef((props, ref) => {
  const { tableRef } = props;

  // ui positioning
  useLayoutEffect(() => {
    const ui = ref.current;
    const table = tableRef.current;
    if (!ui || !table) {
      return null;
    }

    const uiContainer = ui.querySelector(".navi_table_ui_container");
    // TODO: external code should be able to call overlay.update();
    const overlay = initOverlay(table, (visibleRect) => {
      uiContainer.style.setProperty(
        "--table-visual-left",
        `${visibleRect.left}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-width",
        `${visibleRect.width}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-top",
        `${visibleRect.top}px`,
      );
      uiContainer.style.setProperty(
        "--table-visual-height",
        `${visibleRect.height}px`,
      );
    });
    return overlay.destroy;
  });

  return createPortal(
    <div ref={ref} className="navi_table_ui">
      <div className="navi_table_ui_container"></div>
    </div>,
    document.body,
  );
});

// Creates an overlay, the update function is meant to positions one element on top of another
const initOverlay = (element, update) => {
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
    const spaceRemainingRight = visibleAreaWidth - leftVisible;
    const elementAbsoluteRight = elementAbsoluteLeft + width;
    const elementAbsoluteBottom = elementAbsoluteTop + height;

    const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
    const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
    const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
    const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;

    let widthVisible;
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
      widthVisible = spaceRemainingRight;
    }

    // 2.2 Calculate visible height
    const spaceRemainingBottom = visibleAreaHeight - topVisible;
    let heightVisible;
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
      heightVisible = spaceRemainingBottom;
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
