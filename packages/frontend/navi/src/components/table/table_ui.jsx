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

const initOverlay = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollableParent = getScrollableParent(element);
  const scrollableParentIsDocument =
    scrollableParent === document.documentElement;

  const updateOverlayRect = () => {
    // position the container on top of <table> inside this visible area
    const { scrollLeft, scrollTop } = scrollableParent;
    const [elementAbsoluteLeft, elementAbsoluteTop] = getElementVisualCoords(
      element,
      scrollableParent,
      { isStickyTop: true, isStickyLeft: true },
    );
    let elementRelativeLeft =
      scrollLeft < elementAbsoluteLeft ? elementAbsoluteLeft - scrollLeft : 0;
    let elementRelativeTop =
      scrollTop < elementAbsoluteTop ? elementAbsoluteTop - scrollTop : 0;
    const visibleAreaWidth = scrollableParent.clientWidth;
    const visibleAreaHeight = scrollableParent.clientHeight;
    const spaceRemainingFromTableLeft = visibleAreaWidth - elementRelativeLeft;
    const spaceRemainingFromTableTop = visibleAreaHeight - elementRelativeTop;
    const { width: elementWidth, height: elementHeight } =
      element.getBoundingClientRect();

    // Calculate visible width - need to check if visible area extends beyond table right edge
    let elementVisibleWidth = elementWidth;

    // First limit by remaining space from table left to visible area right
    if (elementVisibleWidth > spaceRemainingFromTableLeft) {
      elementVisibleWidth = spaceRemainingFromTableLeft;
    }

    // Check if visible area extends beyond table right edge
    const elementRightEdge = elementAbsoluteLeft + elementWidth;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaRight = scrollLeft + visibleAreaWidth;
    if (visibleAreaRight > elementRightEdge) {
      // Visible area extends beyond table right edge
      // Calculate how much of the table is still visible from visible area left
      const elementVisibleFromLeft = elementRightEdge - visibleAreaLeft;
      if (elementVisibleFromLeft < elementVisibleWidth) {
        elementVisibleWidth =
          elementVisibleFromLeft > 0 ? elementVisibleFromLeft : 0;
      }
    }

    // Calculate visible height - need to check if visible area extends beyond table bottom
    let elementVisibleHeight = elementHeight;

    // First limit by remaining space from table top to visible area bottom
    if (elementVisibleHeight > spaceRemainingFromTableTop) {
      elementVisibleHeight = spaceRemainingFromTableTop;
    }

    // Check if visible area extends beyond table bottom
    const elementBottomEdge = elementAbsoluteTop + elementHeight;
    const visibleAreaTop = scrollTop;
    const visibleAreaBottom = scrollTop + visibleAreaHeight;

    if (visibleAreaBottom > elementBottomEdge) {
      // Visible area extends beyond table bottom
      // Calculate how much of the table is still visible from visible area top
      const elementVisibleFromTop = elementBottomEdge - visibleAreaTop;
      if (elementVisibleFromTop < elementVisibleHeight) {
        elementVisibleHeight =
          elementVisibleFromTop > 0 ? elementVisibleFromTop : 0;
      }
    }

    if (!scrollableParentIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollableParent.getBoundingClientRect();
      elementRelativeLeft += scrollableLeft;
      elementRelativeTop += scrollableTop;
    }
    update(
      {
        left: elementRelativeLeft,
        top: elementRelativeTop,
        right: elementRelativeLeft + elementVisibleWidth,
        bottom: elementRelativeTop + elementVisibleHeight,
        width: elementVisibleWidth,
        height: elementVisibleHeight,
      },
      {
        width: elementWidth,
        height: elementHeight,
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
