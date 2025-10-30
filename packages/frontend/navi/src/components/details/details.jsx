import { elementIsFocusable, findAfter } from "@jsenv/dom";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";

import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { requestAction } from "../../validation/custom_constraint_validation.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { ActionRenderer } from "../action_renderer.jsx";
import { useActionEvents } from "../field/use_action_events.js";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import { useFocusGroup } from "../use_focus_group.js";
import { SummaryMarker } from "./summary_marker.jsx";

import.meta.css = /* css */ `
  .navi_details {
    position: relative;
    z-index: 1;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
  }

  .navi_details > summary {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    cursor: pointer;
    user-select: none;
  }
  .summary_body {
    display: flex;
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: 0.2em;
  }
  .summary_label {
    display: flex;
    padding-right: 10px;
    flex: 1;
    align-items: center;
    gap: 0.2em;
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
    open,
    loading,
    className,
    focusGroup,
    focusGroupDirection,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    onToggle,
    children,
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

  const summaryRef = useRef(null);
  useKeyboardShortcuts(innerRef, [
    {
      key: openKeyShortcut,
      enabled: arrowKeyShortcuts,
      when: (e) =>
        document.activeElement === summaryRef.current &&
        // avoid handling openKeyShortcut twice when keydown occurs inside nested details
        !e.defaultPrevented,
      action: (e) => {
        const details = innerRef.current;
        if (!details.open) {
          e.preventDefault();
          details.open = true;
          return;
        }
        const summary = summaryRef.current;
        const firstFocusableElementInDetails = findAfter(
          summary,
          elementIsFocusable,
          { root: details },
        );
        if (!firstFocusableElementInDetails) {
          return;
        }
        e.preventDefault();
        firstFocusableElementInDetails.focus();
      },
    },
    {
      key: closeKeyShortcut,
      enabled: arrowKeyShortcuts,
      when: () => {
        const details = innerRef.current;
        return details.open;
      },
      action: (e) => {
        const details = innerRef.current;
        const summary = summaryRef.current;
        if (document.activeElement === summary) {
          e.preventDefault();
          summary.focus();
          details.open = false;
        } else {
          e.preventDefault();
          summary.focus();
        }
      },
    },
  ]);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  return (
    <details
      {...rest}
      ref={innerRef}
      id={id}
      className={[
        "navi_details",
        ...(className ? className.split(" ") : []),
      ].join(" ")}
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
      open={innerOpen}
    >
      <summary ref={summaryRef}>
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
    onAction: (e) => {
      executeAction(e);
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <DetailsBasic
      {...rest}
      ref={innerRef}
      loading={loading || actionLoading}
      onToggle={(toggleEvent) => {
        const isOpen = toggleEvent.newState === "open";
        if (isOpen) {
          requestAction(toggleEvent.target, effectiveAction, {
            actionOrigin: "action_prop",
            event: toggleEvent,
            method: "run",
          });
        } else {
          effectiveAction.abort();
        }
        onToggle?.(toggleEvent);
      }}
    >
      <ActionRenderer action={effectiveAction}>{children}</ActionRenderer>
    </DetailsBasic>
  );
});
