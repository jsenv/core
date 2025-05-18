import { effect, signal } from "@preact/signals";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
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

const startResizing = (element, { onChange, onEnd, x, minWidth = 200 }) => {
  const widthAtStart = element.offsetWidth;
  const sizeInfo = {
    widthAtStart,
    width: widthAtStart,
  };

  const updateRequestedWidth = (requestedWidth) => {
    const nextWidth = requestedWidth < minWidth ? minWidth : requestedWidth;
    if (nextWidth !== sizeInfo.width) {
      sizeInfo.width = nextWidth;
      onChange(sizeInfo);
    }
  };

  const handleMouseMove = (e) => {
    const mouseMoveX = e.clientX - x;
    updateRequestedWidth(widthAtStart + mouseMoveX);
  };

  let started = true;
  const stop = () => {
    if (!started) {
      return;
    }
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    started = false;
  };

  const handleMouseUp = (e) => {
    const mouseUpX = e.clientX - x;
    updateRequestedWidth(widthAtStart + mouseUpX);

    stop();
    onEnd(sizeInfo);
    const resizeEndEvent = new CustomEvent("resizeEnd", { detail: sizeInfo });
    element.dispatchEvent(resizeEndEvent);
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.body.style.cursor = "ew-resize";
  document.body.style.userSelect = "none";

  return () => {
    stop();
  };
};
const useResize = () => {
  const [resizing, setIsResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(null);

  const stopRef = useRef();
  const startResize = useCallback((element, options) => {
    stopRef.current = startResizing(element, {
      onChange: (sizeInfo) => {
        setResizeWidth(sizeInfo.width);
      },
      onEnd: () => {
        setResizeWidth(null);
        setIsResizing(false);
      },
      ...options,
    });
    setIsResizing(true);
  }, []);

  useLayoutEffect(() => {
    return () => {
      const stop = stopRef.current;
      if (stop) {
        stopRef.current = null;
        stop();
      }
    };
  }, []);

  return {
    resizing,
    startResize,
    resizeWidth,
  };
};

export const Aside = ({ children }) => {
  const width = useAsideWidth();

  const { resizing, resizeWidth, startResize } = useResize();

  return (
    <aside
      style={{
        width: resizing ? resizeWidth : width,
      }}
      // eslint-disable-next-line react/no-unknown-property
      onresizeEnd={(e) => {
        console.log("set final width to", e.detail.width);
        setAsideWidth(e.detail.width);
      }}
    >
      {children}
      <div
        className="resize_handle"
        onMouseDown={(e) => {
          startResize(e.target.parentNode, {
            x: e.clientX,
          });
        }}
      ></div>
    </aside>
  );
};
