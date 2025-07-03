import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";
import { ActionRenderer } from "../../action_renderer.jsx";
import { useActionStatus } from "../../use_action_status.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
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
    const executeAction = useExecuteAction(innerRef, {
      // the error will be displayed by actionRenderer inside <details>
      errorEffect: "none",
    });
    const summaryRef = useRef();

    const [navStateValue, setNavStateValue] = useNavState(id, open);
    const [innerOpen, innerOpenSetter] = useState(open || navStateValue);

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
          const isOpen = toggleEvent.newState === "open";
          if (isOpen) {
            executeAction(action, { method: "load" });
          } else {
            action.abort();
          }
          if (mountedRef.current) {
            if (isOpen) {
              innerOpenSetter(true);
              setNavStateValue(true);
            } else {
              innerOpenSetter(false);
              setNavStateValue(undefined);
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
