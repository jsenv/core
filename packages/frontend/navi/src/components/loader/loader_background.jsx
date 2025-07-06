import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDebounceTrue } from "../use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

export const LoaderBackground = ({
  loading,
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
        loading={loading}
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
      loading={loading}
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
  loading,
  color,
  inset,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  children,
}) => {
  const shouldShowSpinner = useDebounceTrue(loading, 300);

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
  loading,
  color,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  inset,
  children,
}) => {
  const shouldShowSpinner = useDebounceTrue(loading, 300);
  const containerRef = useRef(null);
  const [borderColor, setBorderColor] = useState();
  const [detectedColor, setDetectedColor] = useState();
  const [borderTopWidth, setBorderTopWidth] = useState(0);

  useLayoutEffect(() => {
    let animationFrame;
    const updateStyles = () => {
      const container = containerRef.current;
      const lastElementChild = container?.lastElementChild;
      if (lastElementChild) {
        const computedStyle = window.getComputedStyle(lastElementChild);
        const newBorderTopWidth = parseFloat(computedStyle.borderTopWidth);
        const newBorderColor = computedStyle.borderColor;
        const newDetectedColor = computedStyle.color;

        setBorderTopWidth(newBorderTopWidth);
        if (newBorderColor !== "rgba(0, 0, 0, 0)") {
          setBorderColor(newBorderColor);
        }
        setDetectedColor(newDetectedColor);
      }
      // updateStyles is very cheap so we run it every frame
      animationFrame = requestAnimationFrame(updateStyles);
    };
    updateStyles();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  inset = inset || borderTopWidth;

  return (
    <div
      name="element_with_loader_wrapper"
      ref={containerRef}
      data-loader-visible={shouldShowSpinner ? "" : undefined}
      style="display:inline-flex; position: relative;"
    >
      {shouldShowSpinner && (
        <div
          name="loading_rectangle_wrapper"
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
