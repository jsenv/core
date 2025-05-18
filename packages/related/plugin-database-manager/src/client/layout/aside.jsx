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
    if (nextWidth === sizeInfo.width) {
      onChange(sizeInfo);
    }
  };

  const handleMouseMove = (e) => {
    const mouseMoveX = e.clientX - x;
    updateRequestedWidth(widthAtStart + mouseMoveX);
  };

  const handleMouseUp = (e) => {
    const mouseUpX = e.clientX - x;
    updateRequestedWidth(widthAtStart + mouseUpX);

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onEnd(sizeInfo);

    const resizeEndEvent = new CustomEvent("resizeEnd", {
      detail: sizeInfo,
    });
    element.dispatchEvent(resizeEndEvent);
  };

  // Add event listeners to document
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // Set cursor for better UX during resize
  document.body.style.cursor = "ew-resize";
  document.body.style.userSelect = "none";

  // Clean up
  return () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };
};
const useResize = () => {
  const [resizeInfo, setResizeInfo] = useState();

  const stopRef = useRef();
  const start = useCallback((element, options) => {
    stopRef.current = startResizing(element, {
      onChange: ({ width }) => {
        setResizeInfo({ width });
      },
      onEnd: () => {
        setResizeInfo(null);
      },
      ...options,
    });
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

  return [resizeInfo, start];
};

export const Aside = ({ children }) => {
  const width = useAsideWidth();

  const [resize, startResize] = useResize();

  return (
    <aside
      style={{
        width: resize ? resize.width : width,
      }}
    >
      {children}
      <div
        className="resize_handle"
        data-
        onMouseDown={(e) => {
          startResize(e.target.parentNode, {
            x: e.clientX,
          });
        }}
        // eslint-disable-next-line react/no-unknown-property
        onResizeEnd={(e) => {
          debugger;
          setAsideWidth(e.detail.width);
        }}
      ></div>
    </aside>
  );
};
