import { forwardRef, useEffect, useState } from "preact/compat";

import.meta.css = /* css */ `
  /* Hide content while maintaining its layout impact */
  .content-placeholder {
    visibility: hidden;
  }

  /* Loader container */
  .details-loader-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none; /* Allow clicks to pass through */
    opacity: 0;
    transition: opacity 0.2s ease-in;
  }

  .details-loader-container.visible {
    opacity: 1;
  }
`;

const LoadingSpinner = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    shape-rendering="geometricPrecision" /* For crisper rendering */
  >
    <defs>
      <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0.4" />
        <stop offset="50%" stop-color="currentColor" />
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.4" />
      </linearGradient>
    </defs>

    <circle
      cx="12"
      cy="12"
      r="10"
      fill="none"
      stroke="url(#spinner-gradient)"
      stroke-width="2.5"
      stroke-linecap="round"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 12 12"
        to="360 12 12"
        dur="1s"
        repeatCount="indefinite"
        additive="sum"
      />
    </circle>
  </svg>
);

export const Details = forwardRef(({ pending, children, ...props }, ref) => {
  const [summary, content] = children;
  const [showLoader, setShowLoader] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(pending);

  // Handle loader visibility with delay
  useEffect(() => {
    let loaderTimer;
    let contentTimer;

    if (pending) {
      setShowPlaceholder(true);

      // Only show loader after a short delay (avoid flickering for quick loads)
      loaderTimer = setTimeout(() => {
        setShowLoader(true);
      }, 300); // Wait 300ms before showing loader
    } else {
      // When content is ready
      if (showLoader) {
        // Fade out loader first
        setShowLoader(false);

        // Then show content after a brief delay
        contentTimer = setTimeout(() => {
          setShowPlaceholder(false);
        }, 150);
      } else {
        // If loader wasn't visible, immediately show content
        setShowPlaceholder(false);
      }
    }

    return () => {
      clearTimeout(loaderTimer);
      clearTimeout(contentTimer);
    };
  }, [pending, showLoader]);

  return (
    <details ref={ref} {...props}>
      {summary}
      <div style="position: relative">
        {pending && showPlaceholder ? (
          <>
            {/* This preserves the content dimensions while making it invisible */}
            <div className="content-placeholder">
              {/* Use the last known content to maintain layout */}
              {content}
            </div>
            <div
              className={`details-loader-container ${showLoader ? "visible" : ""}`}
            >
              <LoadingSpinner />
            </div>
          </>
        ) : (
          /* Render content directly when not pending */
          content
        )}
      </div>
    </details>
  );
});
