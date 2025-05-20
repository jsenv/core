/*

 */

import { useAvailableSize, useResizeStatus } from "@jsenv/dom";
import { valueInLocalStorage } from "@jsenv/router";
import { effect, signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import "./aside.css" with { type: "css" };

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
  const { resizing, resizeWidth } = useResizeStatus(asideRef, {
    as: "number",
  });
  const [availableWidth] = useAvailableSize(asideRef);

  // TODO:
  // when available size changes (resize observer on the parent)
  // we might want to decrease the width of the <aside> to ensure it does not create scrollbars
  // in other words we would respect the maxWidth that we compute in resize.js
  // even when we are not resizing

  return (
    <aside
      ref={asideRef}
      data-resize="horizontal"
      style={{
        width: resizing ? resizeWidth : widthSetting,
        // Disable transition during resize to make it feel responsive
        transition: resizing ? "none" : undefined,
      }}
      // eslint-disable-next-line react/no-unknown-property
      onresizeend={(e) => {
        setAsideWidth(e.detail.width);
      }}
    >
      {children}
      <div data-resize-handle></div>
    </aside>
  );
};
