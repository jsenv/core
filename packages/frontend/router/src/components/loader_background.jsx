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
    return createPortal(
      <LoaderBackgroundWithPortal pending={pending}>
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

const LoaderBackgroundWithPortal = ({ pending, children }) => {
  const shouldShowSpinner = useDebounceTrue(pending, 300);

  if (!shouldShowSpinner) {
    return children;
  }

  return (
    <>
      <div style="position: absolute; inset: 0">
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
