/*

 */

import { useResizeStatus } from "@jsenv/dom";
import "@jsenv/dom/resize";
import { valueInLocalStorage } from "@jsenv/router";
import { effect, signal } from "@preact/signals";
import { useRef } from "preact/hooks";

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
  console.log({ widthSetting });

  return (
    <aside
      ref={asideRef}
      data-resize="horizontal"
      style={{
        width: resizing ? resizeWidth : widthSetting,
        // Disable transition during resize to make it responsive
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
