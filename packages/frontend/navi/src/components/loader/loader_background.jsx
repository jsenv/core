import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDebounceTrue } from "../use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

export const LoaderBackground = ({
  loading,
  containerRef,
  color,
  inset = 0,
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
  const [outlineColor, setOutlineColor] = useState();
  const [borderRadius, setBorderRadius] = useState(0);
  const [detectedColor, setDetectedColor] = useState();
  const [borderTopWidth, setBorderTopWidth] = useState(0);
  const [borderLeftWidth, setBorderLeftWidth] = useState(0);
  const [borderRightWidth, setBorderRightWidth] = useState(0);
  const [borderBottomWidth, setBorderBottomWidth] = useState(0);
  const [marginTop, setMarginTop] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);

  useLayoutEffect(() => {
    let animationFrame;
    const updateStyles = () => {
      const container = containerRef.current;
      const lastElementChild = container?.lastElementChild;
      if (lastElementChild) {
        const computedStyle = window.getComputedStyle(lastElementChild);
        const newBorderTopWidth = parseFloat(computedStyle.borderTopWidth);
        const newBorderLeftWidth = parseFloat(computedStyle.borderLeftWidth);
        const newBorderRightWidth = parseFloat(computedStyle.borderRightWidth);
        const newBorderBottomWidth = parseFloat(
          computedStyle.borderBottomWidth,
        );
        const newBorderRadius = parseFloat(computedStyle.borderRadius);
        const newOutlineColor = computedStyle.outlineColor;
        const newBorderColor = computedStyle.borderColor;
        const newDetectedColor = computedStyle.color;
        const newMarginTop = parseFloat(computedStyle.marginTop);
        const newMarginBottom = parseFloat(computedStyle.marginBottom);
        const newMarginLeft = parseFloat(computedStyle.marginLeft);
        const newMarginRight = parseFloat(computedStyle.marginRight);

        setBorderColor(newBorderColor);
        setOutlineColor(newOutlineColor);
        setDetectedColor(newDetectedColor);

        setBorderTopWidth(newBorderTopWidth);
        setBorderLeftWidth(newBorderLeftWidth);
        setBorderRightWidth(newBorderRightWidth);
        setBorderBottomWidth(newBorderBottomWidth);
        setBorderRadius(newBorderRadius);
        setMarginTop(newMarginTop);
        setMarginBottom(newMarginBottom);
        setMarginLeft(newMarginLeft);
        setMarginRight(newMarginRight);
      }
      // updateStyles is very cheap so we run it every frame
      animationFrame = requestAnimationFrame(updateStyles);
    };
    updateStyles();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  spacingTop += inset;
  spacingTop -= borderTopWidth * 2;
  spacingTop += marginTop;

  spacingLeft += inset;
  spacingLeft -= borderLeftWidth * 2;
  spacingLeft += marginLeft;

  spacingRight += inset;
  spacingRight -= borderRightWidth * 2;
  spacingRight += marginRight;

  spacingBottom += inset;
  spacingBottom -= borderBottomWidth * 2;
  spacingBottom += marginBottom;

  const borderOrOutlineColor =
    borderColor === "rgba(0, 0, 0, 0)" ? outlineColor : borderColor;

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
            pointerEvents: "none",
            position: "absolute",
            top: `${spacingTop}px`,
            left: `${spacingLeft}px`,
            bottom: `${spacingBottom}px`,
            right: `${spacingRight}px`,
          }}
        >
          <RectangleLoading
            color={color || borderOrOutlineColor || detectedColor}
            radius={borderRadius}
          />
        </div>
      )}
      {children}
    </div>
  );
};
