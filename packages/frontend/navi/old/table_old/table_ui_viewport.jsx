import { getVisualRect } from "@jsenv/dom";
import { createPortal, forwardRef } from "preact/compat";
import { useImperativeHandle, useLayoutEffect, useRef } from "preact/hooks";

import { Z_INDEX_TABLE_UI_CONTAINER } from "./z_indexes.js";

import.meta.css = /* css */ `
  .navi_table_ui_viewport {
    position: absolute;
    top: var(--table-top, 0);
    left: var(--table-left, 0);
    z-index: ${Z_INDEX_TABLE_UI_CONTAINER};
    width: var(--table-width, 0);
    height: var(--table-height, 0);
    pointer-events: none;
    user-select: none;
  }
`;

export const TableUIViewport = forwardRef((props, ref) => {
  const { tableRef, children } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  useLayoutEffect(() => {
    const element = innerRef.current;
    const tableElement = tableRef.current;
    if (!element || !tableElement) {
      return null;
    }

    const tableRoot = tableElement.closest(".navi_table_root");

    const updateTablePosition = () => {
      const { left, top } = getVisualRect(tableRoot);
      element.style.setProperty("--table-left", `${left}px`);
      element.style.setProperty("--table-top", `${top}px`);
    };
    updateTablePosition();
    window.addEventListener("scroll", updateTablePosition, { passive: true });
    window.addEventListener("resize", updateTablePosition);
    window.addEventListener("touchmove", updateTablePosition);

    const updateTableDimensions = () => {
      const width = tableRoot.clientWidth;
      const height = tableRoot.clientHeight;
      element.style.setProperty("--table-width", `${width}px`);
      element.style.setProperty("--table-height", `${height}px`);
    };
    updateTableDimensions();
    const resizeObserver = new ResizeObserver(updateTableDimensions);
    resizeObserver.observe(tableRoot);

    return () => {
      window.removeEventListener("scroll", updateTablePosition, {
        passive: true,
      });
      window.removeEventListener("resize", updateTablePosition);
      window.removeEventListener("touchmove", updateTableDimensions);

      resizeObserver.disconnect();
    };
  }, []);

  return createPortal(
    <div ref={innerRef} className="navi_table_ui_viewport">
      {children}
    </div>,
    document.body,
  );
});
