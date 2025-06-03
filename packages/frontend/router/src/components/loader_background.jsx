import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDebounceTrue } from "../hooks/use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

export const LoaderBackground = ({
  pending,
  containerRef,
  color,
  children,
}) => {
  if (containerRef) {
    const container = containerRef.current;
    if (!container) {
      return null;
    }
    container.style.position = "relative";
    let paddingTop = 0;
    if (container.nodeName === "DETAILS") {
      paddingTop = container.querySelector("summary").offsetHeight;
    }
    return createPortal(
      <LoaderBackgroundWithPortal
        pending={pending}
        paddingTop={paddingTop}
        color={color}
      >
        {children}
      </LoaderBackgroundWithPortal>,
      container,
    );
  }

  return (
    <LoaderBackgroundWithWrapper pending={pending} color={color}>
      {children}
    </LoaderBackgroundWithWrapper>
  );
};

const LoaderBackgroundWithPortal = ({ pending, paddingTop, children }) => {
  const shouldShowSpinner = useDebounceTrue(pending, 300);

  if (!shouldShowSpinner) {
    return children;
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: `${paddingTop}px`,
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        {shouldShowSpinner && <RectangleLoading />}
      </div>
      {children}
    </>
  );
};

const LoaderBackgroundWithWrapper = ({ pending, color, children }) => {
  const shouldShowSpinner = useDebounceTrue(pending, 300);
  const containerRef = useRef(null);
  const [detectedColor, setDetectedColor] = useState();

  useLayoutEffect(() => {
    if (color) {
      return;
    }
    const container = containerRef.current;
    const lastElementChild = container.lastElementChild;
    if (lastElementChild) {
      const computedStyle = window.getComputedStyle(lastElementChild);
      const computedStyleColor = computedStyle.color;
      setDetectedColor(computedStyleColor);
    }
  }, [color, ...(Array.isArray(children) ? children : [children])]);

  return (
    <div ref={containerRef} style="display:inline-flex; position: relative;">
      {shouldShowSpinner && (
        <div style="position: absolute; inset: 0">
          <RectangleLoading color={color || detectedColor} />
        </div>
      )}
      {children}
    </div>
  );
};
