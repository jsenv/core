import { createPortal } from "preact/compat";
import { useRef } from "preact/hooks";

import { useDebounceTrue } from "../../utils/use_debounce_true.js";
import { LoadingIndicatorFluid } from "./loading_indicator_fluid.jsx";

const css = /* css */ `
  .navi_loading_outline_wrapper {
    position: absolute;
    top: var(--loading-rectangle-top, 0);
    right: var(--loading-rectangle-right, 0);
    bottom: var(--loading-rectangle-bottom, 0);
    left: var(--loading-rectangle-left, 0);
    z-index: 1;
    border-radius: inherit;
    pointer-events: none;

    &[hidden] {
      display: block;
      opacity: 0;
    }
  }
`;

export const LoadingOutline = (props) => {
  import.meta.css = css;

  if (props.containerRef) {
    const container = props.containerRef.current;
    if (!container) {
      return props.children;
    }
    return createPortal(
      <LoadingOutlineWithPortal
        container={container}
        {...props}
        containerRef={undefined}
      />,
      container,
    );
  }
  return <LoadingOutlineUI {...props} />;
};
const LoadingOutlineUI = (props) => {
  const {
    loading,
    debounce = 300,
    targetSelector,
    color,
    borderWidth = 0,
    radius,
    spacingTop = 0,
    spacingRight = 0,
    spacingBottom = 0,
    spacingLeft = 0,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
    paddingTop = 0,
    paddingRight = 0,
    paddingBottom = 0,
    paddingLeft = 0,
    inset = 0,
    children,
  } = props;
  const shouldShowSpinner = useDebounceTrue(loading, debounce);
  const rectangleRef = useRef(null);

  let insetTop = inset + spacingTop + marginTop;
  let insetRight = inset + spacingRight + marginRight;
  let insetBottom = inset + spacingBottom + marginBottom;
  let insetLeft = inset + spacingLeft + marginLeft;
  if (targetSelector) {
    // oversimplification that actually works
    // (simplified because it assumes the targeted element is a direct child of the contained element which may have padding)
    insetTop += paddingTop;
    insetRight += paddingBottom;
    insetBottom += paddingRight;
    insetLeft += paddingLeft;
  }
  const maxBorderWidth = Math.max(borderWidth);
  const halfMaxBorderSize = maxBorderWidth / 2;
  const size = halfMaxBorderSize < 2 ? 2 : halfMaxBorderSize;
  const lineHalfSize = size / 2;
  insetTop -= lineHalfSize;
  insetRight -= lineHalfSize;
  insetBottom -= lineHalfSize;
  insetLeft -= lineHalfSize;

  return (
    <>
      <span
        ref={rectangleRef}
        className="navi_loading_outline_wrapper"
        style={{
          "--loading-rectangle-top": `${insetTop}px`,
          "--loading-rectangle-right": `${insetRight}px`,
          "--loading-rectangle-bottom": `${insetBottom}px`,
          "--loading-rectangle-left": `${insetLeft}px`,
        }}
      >
        {/*
        Here we depend on loading and NOT shouldShowSpinner because  
        we want to start rendering the loading asap
        so it can start to rotate as soon as we start to load.
        This feels more natural when the loader finally appears with some initial rotation
        correspondong to the time it took to display it.
        It conveys it was busy
        */}
        {loading && (
          <LoadingIndicatorFluid
            visuallyHidden={!shouldShowSpinner}
            radius={radius}
            color={color}
            size={size}
          />
        )}
      </span>
      {children}
    </>
  );
};

// Not actually used anymore.
// Now all UI have a common wrapper that can be used to display the loading indicator without needing a container portal.
const LoadingOutlineWithPortal = (props) => {
  const {
    container,
    loading,
    color,
    inset = 0,
    radius,
    spacingTop = 0,
    spacingRight = 0,
    spacingBottom = 0,
    spacingLeft = 0,
    children,
  } = props;
  const shouldShowSpinner = useDebounceTrue(loading, 300);

  if (!shouldShowSpinner) {
    return children;
  }

  container.style.position = "relative";
  let insetTop = inset + spacingTop;
  let insetRight = inset + spacingRight;
  let insetBottom = inset + spacingBottom;
  let insetLeft = inset + spacingLeft;
  if (container.nodeName === "DETAILS") {
    insetTop += container.querySelector("summary").offsetHeight;
  }

  return (
    <>
      <div
        className="navi_loading_outline_wrapper"
        style={{
          "--loading-rectangle-top": `${insetTop}px`,
          "--loading-rectangle-right": `${insetRight}px`,
          "--loading-rectangle-bottom": `${insetBottom}px`,
          "--loading-rectangle-left": `${insetLeft}px`,
        }}
      >
        {shouldShowSpinner && (
          <LoadingIndicatorFluid color={color} radius={radius} />
        )}
      </div>
      {children}
    </>
  );
};
