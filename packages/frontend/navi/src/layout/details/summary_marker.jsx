import { useLayoutEffect, useRef } from "preact/hooks";

import { useDebounceTrue } from "../../utils/use_debounce_true.js";

const rightArrowPath = "M680-480L360-160l-80-80 240-240-240-240 80-80 320 320z";
const downArrowPath = "M480-280L160-600l80-80 240 240 240-240 80 80-320 320z";

import.meta.css = /* css */ `
  .navi_summary_marker {
    width: 1em;
    height: 1em;
    line-height: 1em;

    .navi_summary_marker_loading_container {
      transform: scale(0.3);
      transition: transform 0.3s linear;

      .navi_summary_marker_background_circle,
      .navi_summary_marker_foreground_circle {
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      }

      .navi_summary_marker_foreground_circle {
        stroke-dasharray: 503 1507; /* ~25% of circle perimeter */
        stroke-dashoffset: 0;
        animation: progress-around-circle 1.5s linear infinite;
      }
    }

    .navi_summary_marker_arrow {
      opacity: 1;
      transition: opacity 0.3s ease-in-out;
      animation-duration: 0.3s;
      animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
      animation-fill-mode: forwards;

      &[data-animation-target="down"] {
        animation-name: morph-to-down;
      }

      &[data-animation-target="right"] {
        animation-name: morph-to-right;
      }
    }

    &[data-loading] {
      .navi_summary_marker_loading_container {
        transform: scale(1);

        .navi_summary_marker_background_circle {
          opacity: 0.2;
        }
        .navi_summary_marker_foreground_circle {
          opacity: 1;
        }
      }
      .navi_summary_marker_arrow {
        opacity: 0;
      }
    }
  }
  @keyframes progress-around-circle {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -2010;
    }
  }
  @keyframes morph-to-down {
    from {
      d: path("${rightArrowPath}");
    }
    to {
      d: path("${downArrowPath}");
    }
  }
  @keyframes morph-to-right {
    from {
      d: path("${downArrowPath}");
    }
    to {
      d: path("${rightArrowPath}");
    }
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
    <span
      className="navi_summary_marker"
      data-loading={open ? showLoading || undefined : undefined}
    >
      <svg viewBox="0 -960 960 960" xmlns="http://www.w3.org/2000/svg">
        <g
          className="navi_summary_marker_loading_container"
          transform-origin="480px -480px"
        >
          <circle
            className="navi_summary_marker_background_circle"
            cx="480"
            cy="-480"
            r="320"
            stroke="currentColor"
            fill="none"
            strokeWidth="60"
            opacity="0.2"
          />
          <circle
            className="navi_summary_marker_foreground_circle"
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
        <g transform-origin="480px -480px">
          <path
            className="navi_summary_marker_arrow"
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
