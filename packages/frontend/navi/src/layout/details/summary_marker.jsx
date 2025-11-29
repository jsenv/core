import { useLayoutEffect, useRef } from "preact/hooks";

import { useDebounceTrue } from "../../utils/use_debounce_true.js";

const rightArrowPath = "M680-480L360-160l-80-80 240-240-240-240 80-80 320 320z";
const downArrowPath = "M480-280L160-600l80-80 240 240 240-240 80 80-320 320z";

import.meta.css = /* css */ `
  .summary_marker {
    width: 1em;
    height: 1em;
    line-height: 1em;
  }
  .summary_marker_svg .arrow {
    animation-duration: 0.3s;
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
    animation-fill-mode: forwards;
  }
  .summary_marker_svg .arrow[data-animation-target="down"] {
    animation-name: morph-to-down;
  }
  @keyframes morph-to-down {
    from {
      d: path("${rightArrowPath}");
    }
    to {
      d: path("${downArrowPath}");
    }
  }
  .summary_marker_svg .arrow[data-animation-target="right"] {
    animation-name: morph-to-right;
  }
  @keyframes morph-to-right {
    from {
      d: path("${downArrowPath}");
    }
    to {
      d: path("${rightArrowPath}");
    }
  }

  .summary_marker_svg .foreground_circle {
    stroke-dasharray: 503 1507; /* ~25% of circle perimeter */
    stroke-dashoffset: 0;
    animation: progress-around-circle 1.5s linear infinite;
  }
  @keyframes progress-around-circle {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -2010;
    }
  }

  /* fading and scaling */
  .summary_marker_svg .arrow {
    opacity: 1;
    transition: opacity 0.3s ease-in-out;
  }
  .summary_marker_svg .loading_container {
    transform: scale(0.3);
    transition: transform 0.3s linear;
  }
  .summary_marker_svg .background_circle,
  .summary_marker_svg .foreground_circle {
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }
  .summary_marker_svg[data-loading] .arrow {
    opacity: 0;
  }
  .summary_marker_svg[data-loading] .loading_container {
    transform: scale(1);
  }
  .summary_marker_svg[data-loading] .background_circle {
    opacity: 0.2;
  }
  .summary_marker_svg[data-loading] .foreground_circle {
    opacity: 1;
  }
`;

export const SummaryMarker = ({ open, loading }) => {
  const showLoading = useDebounceTrue(loading, 300);
  const mountedRef = useRef(false);
  const prevOpenRef = useRef(open);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const shouldAnimate = mountedRef.current && prevOpenRef.current !== open;
  prevOpenRef.current = open;

  return (
    <span className="summary_marker">
      <svg
        className="summary_marker_svg"
        viewBox="0 -960 960 960"
        xmlns="http://www.w3.org/2000/svg"
        data-loading={open ? showLoading || undefined : undefined}
      >
        <g className="loading_container" transform-origin="480px -480px">
          <circle
            className="background_circle"
            cx="480"
            cy="-480"
            r="320"
            stroke="currentColor"
            fill="none"
            strokeWidth="60"
            opacity="0.2"
          />
          <circle
            className="foreground_circle"
            cx="480"
            cy="-480"
            r="320"
            stroke="currentColor"
            fill="none"
            strokeWidth="60"
            strokeLinecap="round"
            strokeDasharray="503 1507"
          />
        </g>
        <g className="arrow_container" transform-origin="480px -480px">
          <path
            className="arrow"
            fill="currentColor"
            data-animation-target={
              shouldAnimate ? (open ? "down" : "right") : undefined
            }
            d={open ? downArrowPath : rightArrowPath}
          />
        </g>
      </svg>
    </span>
  );
};
