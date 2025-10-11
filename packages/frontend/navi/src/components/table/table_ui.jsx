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

// Creates an overlay system that positions one element on top of another,
// handling visibility constraints within scrollable containers
const initOverlay = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollableParent = getScrollableParent(element);
  const scrollableParentIsDocument =
    scrollableParent === document.documentElement;

  const updateOverlayRect = () => {
    // Calculate element position within its scrollable container
    const { scrollLeft, scrollTop } = scrollableParent;
    const [elementAbsoluteLeft, elementAbsoluteTop] = getElementVisualCoords(
      element,
      scrollableParent,
      { isStickyTop: true, isStickyLeft: true },
    );
    let elementLeftRelativeToVisibleArea =
      scrollLeft < elementAbsoluteLeft ? elementAbsoluteLeft - scrollLeft : 0;
    let elementTopRelativeToVisibleArea =
      scrollTop < elementAbsoluteTop ? elementAbsoluteTop - scrollTop : 0;

    const visibleAreaWidth = scrollableParent.clientWidth;
    const visibleAreaHeight = scrollableParent.clientHeight;
    const spaceRemainingRight =
      visibleAreaWidth - elementLeftRelativeToVisibleArea;
    const spaceRemainingBottom =
      visibleAreaHeight - elementTopRelativeToVisibleArea;
    const { width: elementFullWidth, height: elementFullHeight } =
      element.getBoundingClientRect();

    // Calculate visible width
    const elementRightEdge = elementAbsoluteLeft + elementFullWidth;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaRight = scrollLeft + visibleAreaWidth;

    const elementExceedsVisibleAreaRight =
      elementFullWidth > spaceRemainingRight;
    let visibleAreaExceedsElementRight;
    if (visibleAreaRight > elementRightEdge) {
      const elementVisibleFromAreaLeft = elementRightEdge - visibleAreaLeft;
      visibleAreaExceedsElementRight =
        elementVisibleFromAreaLeft > 0 ? elementVisibleFromAreaLeft : 0;
    } else {
      visibleAreaExceedsElementRight = elementFullWidth;
    }

    const bothWidthLimitsApply =
      elementExceedsVisibleAreaRight &&
      elementFullWidth > visibleAreaExceedsElementRight;
    let elementVisibleWidth;
    if (bothWidthLimitsApply) {
      elementVisibleWidth =
        spaceRemainingRight < visibleAreaExceedsElementRight
          ? spaceRemainingRight
          : visibleAreaExceedsElementRight;
    } else if (elementExceedsVisibleAreaRight) {
      elementVisibleWidth = spaceRemainingRight;
    } else if (elementFullWidth > visibleAreaExceedsElementRight) {
      elementVisibleWidth = visibleAreaExceedsElementRight;
    } else {
      elementVisibleWidth = elementFullWidth;
    }

    // Calculate visible height
    const elementBottomEdge = elementAbsoluteTop + elementFullHeight;
    const visibleAreaTop = scrollTop;
    const visibleAreaBottom = scrollTop + visibleAreaHeight;

    const elementExceedsVisibleAreaBottom =
      elementFullHeight > spaceRemainingBottom;
    let visibleAreaExceedsElementBottom;
    if (visibleAreaBottom > elementBottomEdge) {
      const elementVisibleFromAreaTop = elementBottomEdge - visibleAreaTop;
      visibleAreaExceedsElementBottom =
        elementVisibleFromAreaTop > 0 ? elementVisibleFromAreaTop : 0;
    } else {
      visibleAreaExceedsElementBottom = elementFullHeight;
    }

    const bothHeightLimitsApply =
      elementExceedsVisibleAreaBottom &&
      elementFullHeight > visibleAreaExceedsElementBottom;
    let elementVisibleHeight;
    if (bothHeightLimitsApply) {
      elementVisibleHeight =
        spaceRemainingBottom < visibleAreaExceedsElementBottom
          ? spaceRemainingBottom
          : visibleAreaExceedsElementBottom;
    } else if (elementExceedsVisibleAreaBottom) {
      elementVisibleHeight = spaceRemainingBottom;
    } else if (elementFullHeight > visibleAreaExceedsElementBottom) {
      elementVisibleHeight = visibleAreaExceedsElementBottom;
    } else {
      elementVisibleHeight = elementFullHeight;
    }

    // Convert to overlay coordinates (adjust for custom scrollable container)
    let overlayLeft = elementLeftRelativeToVisibleArea;
    let overlayTop = elementTopRelativeToVisibleArea;
    if (!scrollableParentIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollableParent.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    update(
      {
        left: overlayLeft,
        top: overlayTop,
        right: overlayLeft + elementVisibleWidth,
        bottom: overlayTop + elementVisibleHeight,
        width: elementVisibleWidth,
        height: elementVisibleHeight,
      },
      {
        width: elementFullWidth,
        height: elementFullHeight,
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
