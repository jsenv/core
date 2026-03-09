import { elementIsFocusable, findAfter } from "@jsenv/dom";
import { useContext, useEffect, useRef } from "preact/hooks";

import { ActionRenderer } from "../../action/action_renderer.jsx";
import { renderActionableComponent } from "../../action/render_actionable_component.jsx";
import { useAction } from "../../action/use_action.js";
import { useActionStatus } from "../../action/use_action_status.js";
import { useExecuteAction } from "../../action/use_execute_action.js";
import { Box } from "../../box/box.jsx";
import { useKeyboardShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { useActionEvents } from "../use_action_events.js";
import { useFocusGroup } from "../use_focus_group.js";
import {
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "../use_ui_state_controller.js";
import {
  dispatchActionRequestedCustomEvent,
  forwardActionRequested,
} from "../validation/custom_constraint_validation.js";
import { SummaryMarker } from "./summary_marker.jsx";

import.meta.css = /* css */ `
  .navi_details {
    position: relative;
    z-index: 1;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;

    summary {
      display: flex;
      flex-shrink: 0;
      flex-direction: column;
      cursor: pointer;
      user-select: none;

      &:focus {
        z-index: 1;
      }

      .navi_summary_body {
        display: flex;
        width: 100%;
        flex-direction: row;
        align-items: center;
        gap: 0.2em;

        .navi_summary_label {
          display: flex;
          padding-right: 10px;
          flex: 1;
          align-items: center;
          gap: 0.2em;
        }
      }
    }
  }
`;

export const Details = (props) => {
  const { value = "on", persists } = props;
  const uiStateController = useUIStateController(props, "details", {
    statePropName: "open",
    defaultStatePropName: "defaultOpen",
    fallbackState: false,
    getStateFromProp: (open) => (open ? value : undefined),
    getPropFromState: Boolean,
    persists,
  });
  const uiState = useUIState(uiStateController);

  const details = renderActionableComponent(props, {
    Basic: DetailsBasic,
    WithAction: DetailsWithAction,
    WithConnectedAction: DetailsWithConnectedAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        {details}
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const DetailsBasic = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    id,
    label = "Summary",
    loading,
    focusGroup,
    focusGroupDirection,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    onToggle,
    onOpen,
    onClose,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const open = Boolean(uiState);

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
        onToggle?.(e);
        const isOpen = e.newState === "open";
        if (mountedRef.current) {
          if (isOpen) {
            uiStateController.setUIState(true, e);
            onOpen?.(e);
          } else {
            uiStateController.setUIState(false, e);
            onClose?.(e);
          }
        }
      }}
      open={open}
    >
      <summary ref={summaryRef}>
        <div className="navi_summary_body">
          <SummaryMarker open={open} loading={loading} />
          <div className="navi_summary_label">{label}</div>
        </div>
      </summary>
      {children}
    </Box>
  );
};

const DetailsWithAction = (props) => {
  const uiStateController = useContext(UIStateControllerContext);
  const {
    action,
    loading,
    onOpen,
    onClose,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const effectiveAction = useAction(action);
  const actionStatus = useActionStatus(effectiveAction);
  const { loading: actionLoading } = actionStatus;
  const executeAction = useExecuteAction(ref, {
    // the error will be displayed by actionRenderer inside <details>
    errorEffect: "none",
  });

  useActionEvents(ref, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onRequested: (e) => forwardActionRequested(e, effectiveAction),
    onAction: executeAction,
    onStart: onActionStart,
    onAbort: (e) => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: (e) => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      onActionEnd?.(e);
    },
  });

  return (
    <DetailsBasic
      {...rest}
      ref={ref}
      loading={loading || actionLoading}
      onOpen={(e) => {
        dispatchActionRequestedCustomEvent(e.target, {
          event: e,
          requester: e.target,
        });
        onOpen?.(e);
      }}
      onClose={(e) => {
        effectiveAction.abort();
        onClose?.(e);
      }}
    >
      <ActionRenderer action={effectiveAction}>{children}</ActionRenderer>
    </DetailsBasic>
  );
};

const DetailsWithConnectedAction = (props) => {
  const { connectedAction, children, loading, ...rest } = props;
  const actionStatus = useActionStatus(connectedAction);
  const { loading: actionLoading } = actionStatus;
  return (
    <DetailsBasic {...rest} loading={loading || actionLoading}>
      <ActionRenderer action={connectedAction}>{children}</ActionRenderer>
    </DetailsBasic>
  );
};
