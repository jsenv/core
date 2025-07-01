import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef } from "preact/hooks";
import { ActionRenderer } from "../../action_renderer.jsx";
import { useActionStatus } from "../../actions.js";
import { useAction } from "../use_action.js";
import { useExecuteAction } from "../use_execute_action.js";
import { useNavState } from "../use_nav_state.js";
import { SummaryMarker } from "./summary_marker.jsx";

import.meta.css = /* css */ `
  .details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .details > summary {
    flex-shrink: 0;
    cursor: pointer;
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

export const Details = forwardRef(
  (
    {
      id,
      action,
      actionRenderer,
      children = "Summary",
      onToggle,
      open,
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    action = useAction(action);
    const { pending } = useActionStatus(action);
    const executeAction = useExecuteAction(innerRef);
    const summaryRef = useRef();

    const [navStateValue, setNavStateValue] = useNavState(id);

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

    const innerOpen = open || navStateValue;

    return (
      <details
        {...props}
        ref={innerRef}
        className={[
          "details",
          ...(props.className ? props.className.split(" ") : []),
        ].join(" ")}
        onToggle={(toggleEvent) => {
          if (onToggle) {
            onToggle(toggleEvent);
          }
          if (mountedRef.current) {
            if (toggleEvent.newState === "open") {
              setNavStateValue(true);
              executeAction(action);
            } else {
              setNavStateValue(undefined);
              action.abort();
            }
          }
        }}
        open={innerOpen}
      >
        <summary
          ref={summaryRef}
          data-validation-message-stay-on-focus
          data-validation-message-stay-on-blur
        >
          <div className="summary_body">
            <SummaryMarker open={innerOpen} pending={pending} />
            <div className="summary_label">{children}</div>
          </div>
        </summary>

        <ActionRenderer action={action}>{actionRenderer}</ActionRenderer>
      </details>
    );
  },
);
