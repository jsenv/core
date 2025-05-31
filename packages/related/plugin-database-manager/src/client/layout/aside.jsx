/*

 */

import { getInnerWidth, getWidth, startResizeGesture } from "@jsenv/dom";
import { valueInLocalStorage } from "@jsenv/router";
import { effect, signal } from "@preact/signals";
import { useRef, useState } from "preact/hooks";

const [restoreAsideWidth, storeAsideWidth] = valueInLocalStorage(
  "aside_width",
  {
    type: "positive_number",
  },
);
const asideWidthSignal = signal(restoreAsideWidth());
effect(() => {
  const asideWidth = asideWidthSignal.value;
  storeAsideWidth(asideWidth);
});
export const useAsideWidth = () => {
  return asideWidthSignal.value;
};
export const setAsideWidth = (width) => {
  asideWidthSignal.value = width;
};

export const Aside = ({ children }) => {
  const asideRef = useRef(null);
  const widthSetting = useAsideWidth();
  const [resizeWidth, resizeWidthSetter] = useState(null);
  const resizing = resizeWidth !== null;

  return (
    <aside
      ref={asideRef}
      data-resize="horizontal"
      style={{
        width: resizing ? resizeWidth : widthSetting,
        // Disable transition during resize to make it responsive
        transition: resizing ? "none" : undefined,
      }}
      onMouseDown={(e) => {
        let elementToResize;
        let widthAtStart;
        startResizeGesture(e, {
          onStart: (gesture) => {
            elementToResize = gesture.element;
            widthAtStart = getWidth(elementToResize);
          },
          onMove: (gesture) => {
            const xMove = gesture.xMove;
            const newWidth = widthAtStart + xMove;
            const minWidth =
              // <aside> min-width
              100;
            if (newWidth < minWidth) {
              resizeWidthSetter(minWidth);
              return;
            }
            const availableWidth = getInnerWidth(elementToResize.parentElement);
            const maxWidth =
              availableWidth -
              // <main> min-width
              200;
            if (newWidth > maxWidth) {
              resizeWidthSetter(maxWidth);
              return;
            }
            resizeWidthSetter(newWidth);
          },
          onEnd: () => {
            setAsideWidth();
          },
        });
      }}
    >
      {children}
      <div data-resize-handle></div>
    </aside>
  );
};
