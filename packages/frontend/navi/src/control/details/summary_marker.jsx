import { useDebounceTrue } from "../../utils/use_debounce_true.js";

const rightArrowPath = "M680-480L360-160l-80-80 240-240-240-240 80-80 320 320z";

const css = /* css */ `
  .navi_summary_marker {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
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

    /* One chevron, rotated: the transition only ever plays on a direction
       change, so the first paint shows the resting direction with no
       movement. */
    .navi_summary_marker_arrow_group {
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

      &[data-direction="right"] {
        transform: rotate(0deg);
      }
      &[data-direction="down"] {
        transform: rotate(90deg);
      }
      &[data-direction="up"] {
        transform: rotate(-90deg);
      }
      &[data-direction="left"] {
        transform: rotate(180deg);
      }
    }

    .navi_summary_marker_arrow {
      opacity: 1;
      transition: opacity 0.3s ease-in-out;
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
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   open?: boolean,
 *   loading?: boolean,
 *   openDirection?: "down" | "up" | "left",
 * }>}
 * @param openDirection - Where the chevron points while open; closed always
 *   points right. "down" fits content revealed below (the <details> shape),
 *   "up" content revealed above, "left" content revealed beside.
 */
export const SummaryMarker = ({ open, loading, openDirection = "down" }) => {
  import.meta.css = css;
  const showLoading = useDebounceTrue(loading, 300);

  return (
    <span
      className="navi_summary_marker"
      data-loading={showLoading ? "" : undefined}
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
        <g
          className="navi_summary_marker_arrow_group"
          data-direction={open ? openDirection : "right"}
          transform-origin="480px -480px"
        >
          <path
            className="navi_summary_marker_arrow"
            fill="currentColor"
            d={rightArrowPath}
          />
        </g>
      </svg>
    </span>
  );
};
