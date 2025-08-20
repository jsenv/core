import { resolveCSSSize } from "@jsenv/dom";
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDebounceTrue } from "../use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

import.meta.css = /* css */ `
  [name="element_with_loader_wrapper"] {
    display: inline-flex;
    position: relative;
    width: fit-content;
  }

  [name="loading_rectangle_wrapper"] {
    pointer-events: none;
    position: absolute;
    z-index: 1;
  }

  [name="rectangle_loading"] {
    position: relative;
    width: 100%;
    height: 100%;
  }
`;

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
  const [outlineOffset, setOutlineOffset] = useState(0);
  const [borderRadius, setBorderRadius] = useState(0);
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
  const [flexGrow, setFlexGrow] = useState(0);
  const [flexShrink, setFlexShrink] = useState(1);
  const [flexBasis, setFlexBasis] = useState("auto");

  const [currentColor, setCurrentColor] = useState(color);

  useLayoutEffect(() => {
    let animationFrame;
    const updateStyles = () => {
      const container = containerRef.current;
      const containedElement = container.lastElementChild;
      const target = targetSelector
        ? container.querySelector(targetSelector)
        : containedElement;
      if (target) {
        const { width, height } = target.getBoundingClientRect();

        const containedComputedStyle =
          window.getComputedStyle(containedElement);
        const targetComputedStyle = window.getComputedStyle(target);

        // Read flex properties from the contained element to mirror its behavior
        const newFlexGrow = containedComputedStyle.flexGrow || "0";
        const newFlexShrink = containedComputedStyle.flexShrink || "1";
        const newFlexBasis = containedComputedStyle.flexBasis || "auto";

        const newBorderTopWidth = resolveCSSSize(
          targetComputedStyle.borderTopWidth,
        );
        const newBorderLeftWidth = resolveCSSSize(
          targetComputedStyle.borderLeftWidth,
        );
        const newBorderRightWidth = resolveCSSSize(
          targetComputedStyle.borderRightWidth,
        );
        const newBorderBottomWidth = resolveCSSSize(
          targetComputedStyle.borderBottomWidth,
        );
        const newBorderRadius = resolveCSSSize(
          targetComputedStyle.borderRadius,
          {
            availableSize: Math.min(width, height),
          },
        );
        const newOutlineColor = targetComputedStyle.outlineColor;
        const newBorderColor = targetComputedStyle.borderColor;
        const newDetectedColor = targetComputedStyle.color;
        const newOutlineOffset = resolveCSSSize(
          targetComputedStyle.outlineOffset,
        );
        const newMarginTop = resolveCSSSize(targetComputedStyle.marginTop);
        const newMarginBottom = resolveCSSSize(
          targetComputedStyle.marginBottom,
        );
        const newMarginLeft = resolveCSSSize(targetComputedStyle.marginLeft);
        const newMarginRight = resolveCSSSize(targetComputedStyle.marginRight);

        const paddingTop = resolveCSSSize(containedComputedStyle.paddingTop);
        const paddingLeft = resolveCSSSize(containedComputedStyle.paddingLeft);
        const paddingRight = resolveCSSSize(
          containedComputedStyle.paddingRight,
        );
        const paddingBottom = resolveCSSSize(
          containedComputedStyle.paddingBottom,
        );

        setBorderTopWidth(newBorderTopWidth);
        setBorderLeftWidth(newBorderLeftWidth);
        setBorderRightWidth(newBorderRightWidth);
        setBorderBottomWidth(newBorderBottomWidth);
        setBorderRadius(newBorderRadius);
        setOutlineOffset(newOutlineOffset);
        setMarginTop(newMarginTop);
        setMarginBottom(newMarginBottom);
        setMarginLeft(newMarginLeft);
        setMarginRight(newMarginRight);
        setPaddingTop(paddingTop);
        setPaddingLeft(paddingLeft);
        setPaddingRight(paddingRight);
        setPaddingBottom(paddingBottom);
        setFlexGrow(newFlexGrow);
        setFlexShrink(newFlexShrink);
        setFlexBasis(newFlexBasis);

        if (color) {
          setCurrentColor(color);
        } else if (
          newOutlineColor &&
          newOutlineColor !== "rgba(0, 0, 0, 0)" &&
          (document.activeElement === containedElement ||
            newBorderColor === "rgba(0, 0, 0, 0)")
        ) {
          setCurrentColor(newOutlineColor);
        } else if (newBorderColor && newBorderColor !== "rgba(0, 0, 0, 0)") {
          setCurrentColor(newBorderColor);
        } else {
          setCurrentColor(newDetectedColor);
        }
      }

      // updateStyles is very cheap so we run it every frame
      animationFrame = requestAnimationFrame(updateStyles);
    };
    updateStyles();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [color, targetSelector]);

  spacingTop += inset;
  spacingTop += outlineOffset;
  spacingTop -= borderTopWidth;
  spacingTop += marginTop;
  spacingLeft += inset;
  spacingLeft += outlineOffset;
  spacingLeft -= borderLeftWidth;
  spacingLeft += marginLeft;
  spacingRight += inset;
  spacingRight += outlineOffset;
  spacingRight -= borderRightWidth;
  spacingRight += marginRight;
  spacingBottom += inset;
  spacingBottom += outlineOffset;
  spacingBottom -= borderBottomWidth;
  spacingBottom += marginBottom;
  if (targetSelector) {
    // oversimplification that actually works
    // (simplified because it assumes the targeted element is a direct child of the contained element which may have padding)
    spacingTop += paddingTop;
    spacingLeft += paddingLeft;
    spacingRight += paddingRight;
    spacingBottom += paddingBottom;
  }

  const maxBorderWidth = Math.max(
    borderTopWidth,
    borderLeftWidth,
    borderRightWidth,
    borderBottomWidth,
  );
  const size = Math.max(2, maxBorderWidth / 2);

  spacingTop += size / 4;
  spacingLeft += size / 4;
  spacingRight += size / 4;
  spacingBottom += size / 4;

  return (
    <span
      name="element_with_loader_wrapper"
      ref={containerRef}
      data-loader-visible={shouldShowSpinner ? "" : undefined}
      style={{
        flexGrow,
        flexShrink,
        flexBasis,
      }}
    >
      {shouldShowSpinner && (
        <span
          name="loading_rectangle_wrapper"
          style={{
            top: `${spacingTop}px`,
            left: `${spacingLeft}px`,
            bottom: `${spacingBottom}px`,
            right: `${spacingRight}px`,
          }}
        >
          <RectangleLoading
            color={currentColor}
            radius={borderRadius}
            size={size}
          />
        </span>
      )}
      {children}
    </span>
  );
};
