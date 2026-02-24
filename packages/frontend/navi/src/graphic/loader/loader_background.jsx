import { resolveCSSSize } from "@jsenv/dom";
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { useDebounceTrue } from "../../utils/use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

import.meta.css = /* css */ `
  .navi_loading_rectangle_wrapper {
    position: absolute;
    top: var(--rectangle-top, 0);
    right: var(--rectangle-right, 0);
    bottom: var(--rectangle-bottom, 0);
    left: var(--rectangle-left, 0);
    z-index: 1;
    opacity: 0;
    pointer-events: none;
  }
  .navi_loading_rectangle_wrapper[data-visible] {
    opacity: 1;
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
    <LoaderBackgroundBasic
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
    </LoaderBackgroundBasic>
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

const LoaderBackgroundBasic = ({
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
  const rectangleRef = useRef(null);
  const [, setOutlineOffset] = useState(0);
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

  const [currentColor, setCurrentColor] = useState(color);

  useLayoutEffect(() => {
    let animationFrame;
    const updateStyles = () => {
      const rectangle = rectangleRef.current;
      if (!rectangle) {
        return;
      }
      const container = rectangle.parentElement;
      const containedElement = rectangle.nextElementSibling;
      const target = targetSelector
        ? container.querySelector(targetSelector)
        : containedElement;
      if (target) {
        const { width, height } = target.getBoundingClientRect();

        const containedComputedStyle =
          window.getComputedStyle(containedElement);
        const targetComputedStyle = window.getComputedStyle(target);

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

        if (color) {
          // const resolvedColor = resolveCSSColor(color, rectangle, "css");
          //  console.log(resolvedColor);
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
  // spacingTop += outlineOffset;
  // spacingTop -= borderTopWidth;
  spacingTop += marginTop;
  spacingLeft += inset;
  // spacingLeft += outlineOffset;
  // spacingLeft -= borderLeftWidth;
  spacingLeft += marginLeft;
  spacingRight += inset;
  // spacingRight += outlineOffset;
  // spacingRight -= borderRightWidth;
  spacingRight += marginRight;
  spacingBottom += inset;
  // spacingBottom += outlineOffset;
  // spacingBottom -= borderBottomWidth;
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
  const halfMaxBorderSize = maxBorderWidth / 2;
  const size = halfMaxBorderSize < 2 ? 2 : halfMaxBorderSize;
  const lineHalfSize = size / 2;
  spacingTop -= lineHalfSize;
  spacingLeft -= lineHalfSize;
  spacingRight -= lineHalfSize;
  spacingBottom -= lineHalfSize;

  return (
    <>
      <span
        ref={rectangleRef}
        className="navi_loading_rectangle_wrapper"
        data-visible={shouldShowSpinner ? "" : undefined}
        style={{
          "--rectangle-top": `${spacingTop}px`,
          "--rectangle-left": `${spacingLeft}px`,
          "--rectangle-bottom": `${spacingBottom}px`,
          "--rectangle-right": `${spacingRight}px`,
        }}
      >
        {/* We want to start rendering the loading asap
        so it can start to rotate as soon as we start to load
        This feels more natural when the loader appears with some initial rotation
        correspondong to the time it took to display it. It feels like it was busy
        And we don't display immeditaly in case it's very fast (<300ms) */}
        {loading && (
          <RectangleLoading
            shouldShowSpinner={shouldShowSpinner}
            color={currentColor}
            radius={borderRadius}
            size={size}
          />
        )}
      </span>
      {children}
    </>
  );
};
