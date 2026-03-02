import { elementIsFocusable, findAfter } from "@jsenv/dom";
import { useEffect, useRef, useState } from "preact/hooks";

import { ActionRenderer } from "../../action/action_renderer.jsx";
import { renderActionableComponent } from "../../action/render_actionable_component.jsx";
import { useAction } from "../../action/use_action.js";
import { useActionStatus } from "../../action/use_action_status.js";
import { useExecuteAction } from "../../action/use_execute_action.js";
import { Box } from "../../box/box.jsx";
import { useActionEvents } from "../../field/use_action_events.js";
import { useFocusGroup } from "../../field/use_focus_group.js";
import { requestAction } from "../../field/validation/custom_constraint_validation.js";
import { useKeyboardShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { useNavState } from "../../nav/browser_integration/browser_integration.js";
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

export const Details = (props) => {
  const details = renderActionableComponent(props, {
    Basic: DetailsBasic,
    WithAction: DetailsWithAction,
  });
  return details;
};

const DetailsBasic = (props) => {
  const {
    id,
    label = "Summary",
    open,
    loading,
    focusGroup,
    focusGroupDirection,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    onToggle,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  const [navState, setNavState] = useNavState(id);
  const [innerOpen, innerOpenSetter] = useState(open || navState);
  useFocusGroup(ref, {
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
  useKeyboardShortcuts(ref, [
    {
      key: openKeyShortcut,
      enabled: arrowKeyShortcuts,
      when: (e) =>
        document.activeElement === summaryRef.current &&
        // avoid handling openKeyShortcut twice when keydown occurs inside nested details
        !e.defaultPrevented,
      action: (e) => {
        const details = ref.current;
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
        const details = ref.current;
        return details.open;
      },
      action: (e) => {
        const details = ref.current;
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
    <Box
      as="details"
      {...rest}
      ref={ref}
      id={id}
      baseClassName="navi_details"
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
    </Box>
  );
};

const DetailsWithAction = (props) => {
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
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  const effectiveAction = useAction(action);
  const { loading: actionLoading } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(ref, {
    // the error will be displayed by actionRenderer inside <details>
    errorEffect: "none",
  });
  useActionEvents(ref, {
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
      ref={ref}
      loading={loading || actionLoading}
      onToggle={(toggleEvent) => {
        const isOpen = toggleEvent.newState === "open";
        if (isOpen) {
          requestAction(toggleEvent.target, effectiveAction, {
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
};
