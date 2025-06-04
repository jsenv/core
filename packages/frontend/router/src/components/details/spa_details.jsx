import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
} from "preact/hooks";
import { useRouteIsMatching, useRouteStatus } from "../../route/route_hooks.js";
import { SummaryMarker } from "./summary_marker.jsx";

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
  .summary_label {
    display: flex;
    flex: 1;
    gap: 0.2em;
    align-items: center;
    padding-right: 10px;
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

// Update the SPADetailsSummary component to pass pending state
const SPADetailsSummary = ({ children, ...rest }) => {
  const { open, pending } = useDetailsStatus();

  return (
    <summary {...rest}>
      <div className="summary_body">
        <SummaryMarker open={open} pending={pending} />
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
