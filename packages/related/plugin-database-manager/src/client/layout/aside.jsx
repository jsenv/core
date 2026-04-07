/*

 */

import { getInnerWidth, getWidth, startDragToResizeGesture } from "@jsenv/dom";
import { stateSignal } from "@jsenv/navi";
import { effect, signal } from "@preact/signals";
import { useRef, useState } from "preact/hooks";

export const asideWidthSignal = stateSignal(250, {
  type: "positive_number",
});

const asideResizeWidthSignal = signal(asideWidthSignal.value);
effect(() => {
  const asideWidth = asideWidthSignal.value;
  const asideResizeWidth = asideResizeWidthSignal.value;
  const width = asideResizeWidth || asideWidth;
  document
    .querySelector("#root")
    .style.setProperty("--aside-width", `${width}px`);
});

export const Aside = ({ children }) => {
  const asideRef = useRef(null);
  const [resizing, setResizing] = useState(false);

  return (
    <aside
      ref={asideRef}
      data-resize="horizontal"
      style={{
        // Disable transition during resize to make it immediate
        transition: resizing ? "none" : undefined,
      }}
      onMouseDown={(e) => {
        let elementToResize;
        let widthAtStart;
        startDragToResizeGesture(e, {
          onDragStart: (gesture) => {
            elementToResize = gesture.element;
            widthAtStart = getWidth(elementToResize);
          },
          onDrag: (gesture) => {
            if (!gesture.started) {
              return;
            }
            const xDelta = gesture.layout.xDelta;
            const newWidth = widthAtStart + xDelta;
            const minWidth =
              // <aside> min-width
              100;
            setResizing(true);
            if (newWidth < minWidth) {
              asideResizeWidthSignal.value = minWidth;
              return;
            }
            const availableWidth = getInnerWidth(elementToResize.parentElement);
            const maxWidth =
              availableWidth -
              // <main> min-width
              200;
            if (newWidth > maxWidth) {
              asideResizeWidthSignal.value = maxWidth;
              return;
            }
            asideResizeWidthSignal.value = newWidth;
          },
          onRelease: () => {
            const resizeWidth = asideResizeWidthSignal.value;
            if (resizeWidth) {
              asideWidthSignal.value = resizeWidth;
            }
            setResizing(false);
          },
        });
      }}
    >
      {children}
      <div data-resize-handle></div>
    </aside>
  );
};
