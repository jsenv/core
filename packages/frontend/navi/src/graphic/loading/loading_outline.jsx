import { createPortal } from "preact/compat";
import { useRef } from "preact/hooks";

import { useDebounceTrue } from "../../utils/use_debounce_true.js";
import { LoadingIndicatorFluid } from "./loading_indicator_fluid.jsx";

const css = /* css */ `
  .navi_loading_outline_wrapper {
    position: absolute;
    /* Controls place the outline slightly outside their box, right on top of
       their border. Inside something that scrolls that bleed is enough to make
       the area scrollable, so such a container sets --loading-outline-min-inset
       to 0px to keep the outline within the control: a scrollbar appearing
       just because something started loading is worse than an outline drawn a
       couple pixels inward. The var is only ever read here (never set on this
       element) so it keeps inheriting from whichever container declared it. */
    top: max(
      var(--loading-outline-min-inset, -100vh),
      var(--loading-rectangle-top, 0px)
    );
    right: max(
      var(--loading-outline-min-inset, -100vh),
      var(--loading-rectangle-right, 0px)
    );
    bottom: max(
      var(--loading-outline-min-inset, -100vh),
      var(--loading-rectangle-bottom, 0px)
    );
    left: max(
      var(--loading-outline-min-inset, -100vh),
      var(--loading-rectangle-left, 0px)
    );
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

  // Nothing in the DOM until something actually loads: the box below is
  // absolutely positioned slightly outside the control, which is enough to
  // make an ancestor scrollable (a 1px scrollbar on a control sitting against
  // the edge of a scrolling area). A control that never loads must not pay for
  // a decoration it will never draw.
  if (!loading) {
    return children;
  }

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
        Rendered from the very start of the load, merely kept invisible until
        the debounce is over: it then appears already rotating, by as much as
        the load has taken so far. It conveys it was busy.
        */}
        <LoadingIndicatorFluid
          visuallyHidden={!shouldShowSpinner}
          radius={radius}
          color={color}
          size={size}
        />
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
