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
  const width = element.offsetWidth;

  const handleMouseMove = (e) => {
    const moveX = e.clientX - x;
    const moveWidthRequested = width + moveX;
    const moveWidth =
      moveWidthRequested < minWidth ? minWidth : moveWidthRequested;
    onChange({ width: moveWidth });
  };

  const handleMouseUp = (e) => {
    const upX = e.clientX - x;
    const upWidthRequested = width + upX;
    const upWidth = upWidthRequested < minWidth ? minWidth : upWidthRequested;
    onChange({ width: upWidth });

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onEnd({ width: upWidth });
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
const useResize = ({ onEnd }) => {
  const [resizeInfo, setResizeInfo] = useState();

  const stopRef = useRef();
  const start = useCallback((element, options) => {
    stopRef.current = startResizing(element, {
      onChange: ({ width }) => {
        setResizeInfo({ width });
      },
      onEnd: (info) => {
        setResizeInfo(null);
        onEnd(info);
      },
      ...options,
    });
  }, []);

  useLayoutEffect(() => {
    const stop = stopRef.current;
    if (stop) {
      stopRef.current = null;
      stop();
    }
  });

  return [resizeInfo, start];
};

export const Aside = ({ children }) => {
  const width = useAsideWidth();

  const [resize, startResize] = useResize({
    onEnd: ({ width }) => {
      setAsideWidth(width);
    },
  });

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
      ></div>
    </aside>
  );
};
