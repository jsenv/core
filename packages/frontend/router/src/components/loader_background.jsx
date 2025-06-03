import { createPortal } from "preact/compat";
import { useDebounceTrue } from "../hooks/use_debounce_true.js";
import { RectangleLoading } from "./rectangle_loading.jsx";

export const LoaderBackground = ({ pending, containerRef, children }) => {
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
      <LoaderBackgroundWithPortal pending={pending} paddingTop={paddingTop}>
        {children}
      </LoaderBackgroundWithPortal>,
      container,
    );
  }

  return (
    <LoaderBackgroundWithWrapper pending={pending}>
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

const LoaderBackgroundWithWrapper = ({ pending, children }) => {
  const shouldShowSpinner = useDebounceTrue(pending, 300);

  return (
    <div style="display:inline-flex; position: relative;">
      {shouldShowSpinner && (
        <div style="position: absolute; inset: 0">
          <RectangleLoading />
        </div>
      )}
      {children}
    </div>
  );
};
