import { createPortal } from "preact/compat";
import { useRef } from "preact/hooks";

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

    &[data-visible] {
      opacity: 1;
    }
  }
`;

export const LoaderBackground = ({
  loading,
  containerRef,
  targetSelector,
  color,
  inset = 0,
  borderRadius = 0,
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
      borderRadius={borderRadius}
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
  borderRadius,
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
        {shouldShowSpinner && (
          <RectangleLoading color={color} radius={borderRadius} />
        )}
      </div>
      {children}
    </>
  );
};

const LoaderBackgroundBasic = ({
  loading,
  targetSelector,
  color,
  borderWidth = 0,
  borderRadius = 0,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  marginTop = 0,
  marginLeft = 0,
  marginBottom = 0,
  marginRight = 0,
  paddingTop = 0,
  paddingLeft = 0,
  paddingBottom = 0,
  paddingRight = 0,
  inset,
  children,
}) => {
  const shouldShowSpinner = useDebounceTrue(loading, 300);
  const rectangleRef = useRef(null);

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

  const maxBorderWidth = Math.max(borderWidth);
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
            color={color}
            radius={borderRadius}
            size={size}
          />
        )}
      </span>
      {children}
    </>
  );
};
