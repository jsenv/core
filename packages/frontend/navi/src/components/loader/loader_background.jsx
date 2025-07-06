import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDebounceTrue } from "../use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

export const LoaderBackground = ({
  loading,
  containerRef,
  targetSelector,
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
      targetSelector={targetSelector}
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
  targetSelector,
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
  const [paddingTop, setPaddingTop] = useState(0);
  const [paddingLeft, setPaddingLeft] = useState(0);
  const [paddingRight, setPaddingRight] = useState(0);
  const [paddingBottom, setPaddingBottom] = useState(0);

  useLayoutEffect(() => {
    let animationFrame;
    const updateStyles = () => {
      const container = containerRef.current;
      const containedElement = container.lastElementChild;
      const target = targetSelector
        ? container.querySelector(targetSelector)
        : containedElement;
      if (target) {
        const containedComputedStyle =
          window.getComputedStyle(containedElement);
        const targetComputedStyle = window.getComputedStyle(target);
        const newBorderTopWidth =
          parseFloat(targetComputedStyle.borderTopWidth) || 0;
        const newBorderLeftWidth =
          parseFloat(targetComputedStyle.borderLeftWidth) || 0;
        const newBorderRightWidth =
          parseFloat(targetComputedStyle.borderRightWidth) || 0;
        const newBorderBottomWidth =
          parseFloat(targetComputedStyle.borderBottomWidth) || 0;
        const newBorderRadius =
          parseFloat(targetComputedStyle.borderRadius) || 0;
        const newOutlineColor = targetComputedStyle.outlineColor;
        const newBorderColor = targetComputedStyle.borderColor;
        const newDetectedColor = targetComputedStyle.color;
        const newMarginTop = parseFloat(containedComputedStyle.marginTop) || 0;
        const newMarginBottom =
          parseFloat(containedComputedStyle.marginBottom) || 0;
        const newMarginLeft =
          parseFloat(containedComputedStyle.marginLeft) || 0;
        const newMarginRight =
          parseFloat(containedComputedStyle.marginRight) || 0;

        const paddingTop = parseFloat(containedComputedStyle.paddingTop) || 0;
        const paddingLeft = parseFloat(containedComputedStyle.paddingLeft) || 0;
        const paddingRight =
          parseFloat(containedComputedStyle.paddingRight) || 0;
        const paddingBottom =
          parseFloat(containedComputedStyle.paddingBottom) || 0;

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
        setPaddingTop(paddingTop);
        setPaddingLeft(paddingLeft);
        setPaddingRight(paddingRight);
        setPaddingBottom(paddingBottom);
      }
      // updateStyles is very cheap so we run it every frame
      animationFrame = requestAnimationFrame(updateStyles);
    };
    updateStyles();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [targetSelector]);

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
  if (targetSelector) {
    // oversimplification that actually works
    // (simplified because it assumes the targeted element is a direct child of the contained element which may have padding)
    spacingTop += paddingTop;
    spacingLeft += paddingLeft;
    spacingRight += paddingRight;
    spacingBottom += paddingBottom;
  }

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
