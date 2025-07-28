import { elementIsFocusable, findAfter } from "@jsenv/dom";
import { requestAction } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";
import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { ActionRenderer } from "../action_renderer.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useFocusGroup } from "../use_focus_group.js";
import { SummaryMarker } from "./summary_marker.jsx";

import.meta.css = /* css */ `
  .navi_details {
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .navi_details > summary {
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

  .navi_details > summary:focus {
    z-index: 1;
  }
`;

export const Details = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: DetailsBasic,
    WithAction: DetailsWithAction,
  });
});

const DetailsBasic = forwardRef((props, ref) => {
  const {
    id,
    label = "Summary",
    children,
    open,
    loading,
    className,
    onToggle,
    focusGroup,
    focusGroupDirection,
    arrowKeyShortcuts = true,
    openKeyShortcut = arrowKeyShortcuts ? "ArrowRight" : undefined,
    closeKeyShortcut = arrowKeyShortcuts ? "ArrowLeft" : undefined,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [innerOpen, innerOpenSetter] = useState(open || navState);
  useFocusGroup(innerRef, {
    enabled: focusGroup,
    name: typeof focusGroup === "string" ? focusGroup : undefined,
    direction: focusGroupDirection,
  });

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
      {...rest}
      id={id}
      className={[
        "navi_details",
        ...(className ? className.split(" ") : []),
      ].join(" ")}
      ref={innerRef}
      onToggle={(e) => {
        const isOpen = e.newState === "open";
        if (mountedRef.current) {
          if (isOpen) {
            innerOpenSetter(true);
            setNavState(true);
          } else {
            innerOpenSetter(false);
            setNavState(undefined);
          }
        }
        onToggle?.(e);
      }}
      // TODO: a keydown for left arrow to move focus to summary when opened
      open={innerOpen}
    >
      <summary
        onKeyDown={(e) => {
          if (e.key === openKeyShortcut) {
            const details = innerRef.current;
            if (details.open) {
              const summary = e.target.closest("summary");
              const firstFocusableElementInDetails = findAfter(
                summary,
                elementIsFocusable,
                { root: details },
              );
              if (firstFocusableElementInDetails) {
                e.preventDefault();
                firstFocusableElementInDetails.focus();
              }
              return;
            }
            e.preventDefault();
            details.open = true;
            return;
          }
          if (e.key === closeKeyShortcut) {
            const details = innerRef.current;
            if (details.open) {
              e.preventDefault();
              details.open = false;
              return;
            }
          }
        }}
      >
        <div className="summary_body">
          <SummaryMarker open={innerOpen} loading={loading} />
          <div className="summary_label">{label}</div>
        </div>
      </summary>
      {children}
    </details>
  );
});

const DetailsWithAction = forwardRef((props, ref) => {
  const {
    action,
    loading,
    onToggle,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const effectiveAction = useAction(action);
  const { loading: actionLoading } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    // the error will be displayed by actionRenderer inside <details>
    errorEffect: "none",
  });
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <DetailsBasic
      {...rest}
      ref={innerRef}
      onToggle={(toggleEvent) => {
        const isOpen = toggleEvent.newState === "open";
        if (isOpen) {
          requestAction(effectiveAction, {
            event: toggleEvent,
            method: "run",
          });
        } else {
          effectiveAction.abort();
        }
        onToggle?.(toggleEvent);
      }}
      loading={loading || actionLoading}
    >
      <ActionRenderer action={effectiveAction}>{children}</ActionRenderer>
    </DetailsBasic>
  );
});
