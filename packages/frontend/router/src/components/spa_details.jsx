import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
} from "preact/hooks";
import { useDebounceTrue } from "../hooks/use_debounce_true.js";
import { useRouteIsMatching, useRouteStatus } from "../route/route_hooks.js";

const rightArrowPath = "M680-480L360-160l-80-80 240-240-240-240 80-80 320 320z";
const downArrowPath = "M480-280L160-600l80-80 240 240 240-240 80 80-320 320z";

import.meta.css = /* css */ `
  .spa_details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .spa_details > summary {
    flex-shrink: 0;
    cursor: pointer;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .summary_body {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
  }
  .summary_marker {
    width: 1em;
    height: 1em;
  }

  .summary_label {
    display: flex;
    flex: 1;
    gap: 0.2em;
    align-items: center;
    padding-right: 10px;
  }

  .summary_marker_svg .arrow {
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
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
      stroke-dashoffset: 2010;
    }
  }

  /* fading and scaling */
  .summary_marker_svg .arrow {
    transition: opacity 0.3s ease-in-out;
    opacity: 1;
  }
  .summary_marker_svg .arrow_container {
    transition: transform 0.3s cubic-bezier(0.34, 0.56, 0.64, 1);
    transform: scale(1);
  }
  .summary_marker_svg .background_circle,
  .summary_marker_svg .foreground_circle {
    transition: opacity 0.3s ease-in-out;
    opacity: 0;
  }
  .summary_marker_svg[data-loading] .arrow {
    opacity: 0;
  }
  .summary_marker_svg[data-loading] .arrow_container {
    transform: scale(0.3);
  }
  .summary_marker_svg[data-loading] .background_circle {
    opacity: 0.2;
  }
  .summary_marker_svg[data-loading] .foreground_circle {
    opacity: 1;
  }
`;

const DetailsContext = createContext();
const useDetailsStatus = () => {
  const detailsStatus = useContext(DetailsContext);
  return detailsStatus;
};

export const SPADetails = forwardRef(
  ({ route, children, onToggle, open = false, ...props }, ref) => {
    const { pending } = useRouteStatus(route);

    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    const routeIsMatching = useRouteIsMatching(route);

    /**
     * Browser will dispatch "toggle" event even if we set open={true}
     * When rendering the component for the first time
     * We have to ensure the initial "toggle" event is ignored.
     *
     * If we don't do that code will think the details has changed and run logic accordingly
     * For example it will try to navigate to the current url while we are already there
     *
     * See:
     * - https://techblog.thescore.com/2024/10/08/why-we-decided-to-change-how-the-details-element-works/
     * - https://github.com/whatwg/html/issues/4500
     * - https://stackoverflow.com/questions/58942600/react-html-details-toggles-uncontrollably-when-starts-open
     *
     */
    const mountedRef = useRef(false);
    useEffect(() => {
      mountedRef.current = true;
    }, []);

    // for aborted we do nothing
    // for error we display a validation message, we'll see that later

    return (
      <details
        {...props}
        className="spa_details"
        onToggle={(toggleEvent) => {
          if (mountedRef.current) {
            if (toggleEvent.newState === "open") {
              route.enter();
            } else {
              route.leave();
            }
          }
          if (onToggle) {
            onToggle(toggleEvent);
          }
        }}
        ref={innerRef}
        open={routeIsMatching || open}
      >
        <DetailsContext.Provider
          value={{
            open: routeIsMatching || open,
            pending,
          }}
        >
          {children}
        </DetailsContext.Provider>
      </details>
    );
  },
);

const MorphingArrow = ({ isOpen, isPending }) => {
  const showLoading = useDebounceTrue(isPending, 300);

  return (
    <svg
      className="summary_marker_svg"
      viewBox="0 -960 960 960"
      xmlns="http://www.w3.org/2000/svg"
      data-loading={isOpen ? showLoading || undefined : undefined}
    >
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
      <g className="arrow_container" transform-origin="center center">
        <path
          className="arrow"
          fill="currentColor"
          data-animation-target={isOpen ? "down" : "right"}
          d={isOpen ? downArrowPath : rightArrowPath}
        />
      </g>
    </svg>
  );
};

// Update the SPADetailsSummary component to pass pending state
const SPADetailsSummary = ({ children, ...rest }) => {
  const { open, pending } = useDetailsStatus();

  return (
    <summary {...rest}>
      <div className="summary_body">
        <span className="summary_marker">
          <MorphingArrow isOpen={open} isPending={pending} />
        </span>
        <div className="summary_label">
          {children}{" "}
          <span>
            [{open ? "open" : "close"}
            {pending ? " and pending" : ""}]
          </span>
        </div>
      </div>
    </summary>
  );
};
SPADetails.Summary = SPADetailsSummary;
