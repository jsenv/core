/*
 * TODO: the width saved in local storage should be proportional to the viewport
 * this way, if we reload the page in an other viewport the size adapts
 */

import { useResizeStatus } from "@jsenv/dom";
import { valueInLocalStorage } from "@jsenv/router";
import { effect, signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import "./aside.css" with { type: "css" };

const [restoreAsideWidth, storeAsideWidth] = valueInLocalStorage(
  "aside_width",
  {
    type: "number",
  },
);

const asideWidthSignal = signal(restoreAsideWidth());
export const useAsideWidth = () => {
  return asideWidthSignal.value;
};
export const setAsideWidth = (width) => {
  asideWidthSignal.value = width;
};
effect(() => {
  const asideWidth = asideWidthSignal.value;
  storeAsideWidth(asideWidth);
});

export const Aside = ({ children }) => {
  const asideRef = useRef(null);
  const width = useAsideWidth();
  const { resizing, resizeWidth } = useResizeStatus(asideRef, {
    as: "percentage",
  });

  return (
    <aside
      ref={asideRef}
      data-resize="horizontal"
      style={{
        width: resizing ? resizeWidth : width,
        // Disable transition during resize to make it feel responsive
        transition: resizing ? "none" : undefined,
      }}
      // eslint-disable-next-line react/no-unknown-property
      onresizeend={(e) => {
        setAsideWidth(e.detail.widthAsPercentage);
      }}
    >
      {children}
      <div data-resize-handle></div>
    </aside>
  );
};
