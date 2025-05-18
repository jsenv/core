/*
 * TODO: the width saved in local storage should be proportional to the viewport
 * this way, if we reload the page in an other viewport the size adapts
 */

import { useResizeStatus } from "@jsenv/dom";
import { effect, signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import "./aside.css" with { type: "css" };

const valueInLocalStorage = (key, { type } = {}) => {
  const get = () => {
    const valueInLocalStorage = window.localStorage.getItem(key);

    if (valueInLocalStorage === null) {
      return undefined;
    }
    if (type === "number") {
      if (valueInLocalStorage === "undefined") {
        console.warn(
          `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
        );
        return undefined;
      }
      const valueParsed = JSON.parse(valueInLocalStorage);
      if (!isFinite(valueParsed)) {
        console.warn(
          `Invalid value for ${key} in local storage, found ${valueInLocalStorage}`,
        );
        return undefined;
      }
      return valueParsed;
    }
    return JSON.parse(valueInLocalStorage);
  };
  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem("aside_width", JSON.stringify(value));
  };

  return [get, set];
};
const [restoreAsideWidth, saveAsideWidth] = valueInLocalStorage("aside_width", {
  type: "number",
});

const asideWidthSignal = signal(restoreAsideWidth());
export const useAsideWidth = () => {
  return asideWidthSignal.value;
};
export const setAsideWidth = (width) => {
  asideWidthSignal.value = width;
};
effect(() => {
  const asideWidth = asideWidthSignal.value;
  saveAsideWidth(asideWidth);
});

export const Aside = ({ children }) => {
  const asideRef = useRef(null);
  const width = useAsideWidth();
  const { resizing, resizeWidth } = useResizeStatus(asideRef);

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
        setAsideWidth(e.detail.width);
      }}
    >
      {children}
      <div data-resize-handle></div>
    </aside>
  );
};
