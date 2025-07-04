import { createPortal } from "preact/compat";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDebounceTrue } from "../use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

export const LoaderBackground = ({
  pending,
  containerRef,
  color,
  inset,
  spacingTop = 0,
  spacingLeft = 0,
  spacingBottom = 0,
  spacingRight = 0,
  children,
}) => {
  if (containerRef) {
    const container = containerRef.current;
    if (!container) {
      return children;
    }
    return createPortal(
      <LoaderBackgroundWithPortal
        container={container}
        pending={pending}
        color={color}
        inset={inset}
        spacingTop={spacingTop}
        spacingLeft={spacingLeft}
        spacingBottom={spacingBottom}
        spacingRight={spacingRight}
      >
        {children}
      </LoaderBackgroundWithPortal>,
      container,
    );
  }

  return (
    <LoaderBackgroundWithWrapper
      pending={pending}
      color={color}
      inset={inset}
      spacingTop={spacingTop}
      spacingLeft={spacingLeft}
      spacingBottom={spacingBottom}
      spacingRight={spacingRight}
    >
      {children}
    </LoaderBackgroundWithWrapper>
  );
};

const LoaderBackgroundWithPortal = ({
  container,
  pending,
  color,
  inset,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  children,
}) => {
  const shouldShowSpinner = useDebounceTrue(pending, 300);

  if (!shouldShowSpinner) {
    return children;
  }

  container.style.position = "relative";
  let paddingTop = 0;
  if (container.nodeName === "DETAILS") {
    paddingTop = container.querySelector("summary").offsetHeight;
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: `${inset + paddingTop + spacingTop}px`,
          bottom: `${inset + spacingBottom}px`,
          left: `${inset + spacingLeft}px`,
          right: `${inset + spacingRight}px`,
        }}
      >
        {shouldShowSpinner && <RectangleLoading color={color} />}
      </div>
      {children}
    </>
  );
};

const LoaderBackgroundWithWrapper = ({
  pending,
  color,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  inset,
  children,
}) => {
  const shouldShowSpinner = useDebounceTrue(pending, 300);
  const containerRef = useRef(null);
  const [borderColor, setBorderColor] = useState();
  const [detectedColor, setDetectedColor] = useState();
  const [borderTopWidth, setBorderTopWidth] = useState(0);

  const updateStyles = useCallback(() => {
    const container = containerRef.current;
    const lastElementChild = container?.lastElementChild;
    if (!lastElementChild) {
      return;
    }
    if (!pending) {
      return;
    }

    const computedStyle = window.getComputedStyle(lastElementChild);
    const newBorderTopWidth = parseFloat(computedStyle.borderTopWidth);
    const newBorderColor = computedStyle.borderColor;
    const newDetectedColor = computedStyle.color;

    setBorderTopWidth(newBorderTopWidth);
    setBorderColor(newBorderColor);
    setDetectedColor(newDetectedColor);
  }, [pending]);

  useLayoutEffect(() => {
    updateStyles();
    const interval = setInterval(updateStyles, 100);
    return () => {
      clearInterval(interval);
    };
  }, [...(Array.isArray(children) ? children : [children])]);

  inset = inset || borderTopWidth;

  return (
    <div ref={containerRef} style="display:inline-flex; position: relative;">
      {shouldShowSpinner && (
        <div
          style={{
            position: "absolute",
            top: `${inset + spacingTop}px`,
            left: `${inset + spacingLeft}px`,
            bottom: `${inset + spacingBottom}px`,
            right: `${inset + spacingRight}px`,
          }}
        >
          <RectangleLoading color={color || borderColor || detectedColor} />
        </div>
      )}
      {children}
    </div>
  );
};
