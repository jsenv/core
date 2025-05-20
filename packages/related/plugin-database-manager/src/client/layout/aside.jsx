/*

 */

import { useResizeStatus } from "@jsenv/dom";
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
  const widthSetting = useAsideWidth();
  const { resizing, resizeWidth } = useResizeStatus(asideRef, {
    as: "number",
  });

  console.log(resizeWidth, widthSetting);

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
