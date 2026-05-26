/**
 * Core hooks for wiring navi field components to the action/validation system.
 *
 * Why this exists instead of using native events directly:
 *
 * 1. Preact maps `onChange` to the native `change` event, not `input`. For text inputs
 *    this means the handler fires only on blur, not on every keystroke. All navi fields
 *    use `onInput` internally and route through `dispatchRequestAction` so the behavior
 *    is consistent regardless of input type.
 *
 * 2. Any field (text, checkbox, radio, picker…) can opt into debounce simply by passing
 *    a debounced action. The request-action event chain handles the timing centrally
 *    rather than each component having to manage its own debounce logic.
 */
import { dispatchInternalCustomEvent, findEvent } from "@jsenv/dom";
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useComposeElementRef } from "@jsenv/navi/src/box/use_element_ref.js";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
  onRequestAction,
  onRequestInteraction,
} from "@jsenv/navi/src/field/validation/custom_constraint_validation.js";
import {
  useDebugAction,
  useDebugFocus,
  useDebugInteraction,
} from "@jsenv/navi/src/navi_debug.jsx";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import {
  ActionContext,
  ActionRequesterContext,
  DisabledContext,
  FieldNameContext,
  FieldToInterfaceContext,
  LoadingContext,
  MessagePropsRefContext,
  ReadOnlyContext,
  RequiredContext,
} from "./field_context.js";
import { addInputEffect } from "./input_effect.js";
import { requestClosestAction, resolveActionProp } from "./string_actions.js";
import {
  dispatchRequestResetUIState,
  dispatchRequestSetUIState,
  ParentUIStateControllerContext,
  useUIGroupStateController,
  useUIStateController,
} from "./ui_state_controller.js";
import { useConstraintMessages } from "./validation/hooks/use_constraint_messages.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

/**
 * Core hook for interactive field components (InputText, InputCheckbox, etc.).
 *
 * Sets up the full field lifecycle:
 * - Creates a UI state controller that manages state divergence between props and user interactions
 * - Binds the field's action to its current UI state via a signal
 * - Wires up all DOM event handlers (navi_set_ui_state, navi_request_reset_ui_state,
 *   navi_action_ready, navi_action_abort, navi_action_error, navi_cancel, etc.)
 * - Resolves inherited context (disabled, readOnly, required, loading, fieldName)
 * - Handles constraint validation and message props
 *
 * All state changes route through DOM events on the field element so that
 * external subscribers (e.g. useUIState, Selectable) receive every update.
 *
 * @returns {Object} Props to spread onto the field's root/input element
 */
export const useFieldInterfaceProps = (
  props,
  {
    primaryInteractionMode, // "pointer", "keyboard"
    fieldType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
    sideEffect,
    allowNameless,
    persists,

    getUIValue,
    paramsSignal,
    externalBoundAction,
    readOnlySupported,
  },
) => {
  const debugAction = useDebugAction();
  const uiStateController = useUIStateController(props, fieldType, {
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
    sideEffect,
    allowNameless,
    persists,
    debugAction,
  });

  paramsSignal = paramsSignal || uiStateController.uiStateSignal;
  const [internalBoundAction] = useActionBoundToOneParam(
    externalBoundAction ? undefined : resolveActionProp(props.action),
    paramsSignal,
  );
  const boundAction = externalBoundAction || internalBoundAction;

  const { ref } = props;
  const debugInteraction = useDebugInteraction();
  const hasPointerDownInteraction = fieldType === "input_range";
  const onMouseDown = (e) => {
    props.onMouseDown?.(e);
    if (primaryInteractionMode === "pointer") {
      const field = ref.current;
      const allowed = dispatchRequestInteraction(field, e);
      if (hasPointerDownInteraction && !allowed) {
        e.preventDefault();
      }
    }
  };
  const onClick = (e) => {
    props.onClick?.(e);
    if (primaryInteractionMode === "pointer") {
      const field = ref.current;
      if (hasPointerDownInteraction) {
        // click is has no effect, mousedown has (click on range input does nothing)
        return;
      }
      const allowed = dispatchRequestInteraction(field, e);
      if (!allowed) {
        // Here we want to prevent:
        // - toggle of radio/checkbox on click
        debugInteraction(e, "click.preventDefault()");
        e.preventDefault();
      }
    }
  };
  const onKeyDown = (e) => {
    props.onKeyDown?.(e);
    if (e.key === "Enter") {
      requestClosestAction(e);
      return;
    }
    const input = e.currentTarget;
    const allowed = dispatchRequestInteraction(input, e);
    if (!allowed) {
      // Here we want to prevent
      // - space to toggle radio/checkbox
      // - space to scroll scrollable container (usually document)
      // - any keyboard interaction that would affect input value
      // or would not make sense on a readonly field
      debugInteraction(e, "keydown.preventDefault()");
      e.preventDefault();
    }
  };
  const onPaste = (e) => {
    props.onPaste?.(e);
    dispatchRequestInteraction(ref.current, e);
  };

  const { actionAfterChange, actionDebounce } = props;
  const installInputEffect = useCallback(
    (input) => {
      return addInputEffect(
        input,
        (e) => {
          dispatchRequestAction(input, { event: e });
        },
        {
          waitForChange: actionAfterChange,
          debounce: actionDebounce,
        },
      );
    },
    [actionAfterChange, actionDebounce],
  );

  const refComposed = useComposeElementRef(installInputEffect, props.ref);

  const result = useActionProps(
    {
      ...props,
      ref: refComposed,
      onMouseDown,
      onClick,
      onKeyDown,
      onPaste,
      actionAfterChange: undefined,
      actionDebounce: undefined,
    },
    {
      readOnlySupported,
      action: boundAction,
      uiStateController,
      getUIValue,
    },
  );
  return result;
};

/**
 * Core hook for field group components (SelectableList, CheckboxList, etc.).
 *
 * Coordinates a collection of child fields:
 * - Creates a UI group state controller that aggregates child states into one group state
 * - Binds the group's action to the aggregated state signal
 * - Provides context to children: ParentUIStateController, FieldName, Disabled, ReadOnly,
 *   Required, Loading, Action, ActionRequester
 * - Overrides `onnavi_request_reset_ui_state` to cascade resets to all monitored children
 *   by dispatching `navi_request_reset_ui_state` DOM events on each child's DOM element
 * - Overrides `onnavi_action_ready` to track the action requester
 *
 * @param {{ fieldType: string, childComponentType: string, aggregateChildStates: Function }} config
 * @returns {Object} Props to spread onto the group's root element
 */
export const useFieldgroupInterfaceProps = (
  props,
  { fieldType, childComponentType, aggregateChildStates },
) => {
  const { action } = props;
  const debugAction = useDebugAction();
  const uiGroupStateController = useUIGroupStateController(props, fieldType, {
    childComponentType,
    aggregateChildStates,
    debugAction,
  });
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiGroupStateController.uiStateSignal,
  );
  const [actionRequester, setActionRequester] = useState();
  const [actionProps, remainingProps] = useActionProps(props, {
    action: boundAction,
    uiStateController: uiGroupStateController,
    getUIValue: () => {
      return uiGroupStateController.uiStateSignal.peek();
    },
  });
  let childrenWithContext;
  if (actionProps.children === undefined) {
    childrenWithContext = undefined;
  } else {
    const { basePseudoState } = actionProps;
    const disabled = basePseudoState[":disabled"];
    const readOnly = basePseudoState[":read-only"];
    const loading = basePseudoState[":-navi-loading"];

    childrenWithContext = (
      <ParentUIStateControllerContext.Provider value={uiGroupStateController}>
        <FieldNameContext.Provider value={actionProps.name}>
          <DisabledContext.Provider value={disabled}>
            <ReadOnlyContext.Provider value={readOnly}>
              <RequiredContext.Provider value={actionProps.required}>
                <LoadingContext.Provider value={loading}>
                  <ActionContext.Provider value={boundAction}>
                    <ActionRequesterContext.Provider value={actionRequester}>
                      {actionProps.children}
                    </ActionRequesterContext.Provider>
                  </ActionContext.Provider>
                </LoadingContext.Provider>
              </RequiredContext.Provider>
            </ReadOnlyContext.Provider>
          </DisabledContext.Provider>
        </FieldNameContext.Provider>
      </ParentUIStateControllerContext.Provider>
    );
  }
  return [
    {
      ...actionProps,
      name: undefined, // useful to children, not the the group itself
      required: undefined, // useful to children, not the the group itself
      children: childrenWithContext,
      onnavi_action_ready: (e) => {
        setActionRequester(e.detail.requester);
        actionProps.onnavi_action_ready(e);
      },
    },
    remainingProps,
  ];
};

const useActionProps = (
  props,
  { readOnlySupported, action, uiStateController, getUIValue },
) => {
  const {
    ref,

    type,
    name,
    id,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    basePseudoState,
    children,

    constraints,
    disabled,
    readOnly,
    required,
    loading,
    onCancel,
    onActionPrevented,
    onActionAborted,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    errorMapping,
    resetOnCancel,
    resetOnAbort,
    resetOnError,
    cancelOnBlurInvalid,
    cancelOnEscape,
    ...rest
  } = props;
  const actionStatus = useActionStatus(action);
  const fieldToInterfaceContext = useContext(FieldToInterfaceContext);
  const fieldName = useContext(FieldNameContext);
  const fieldDisabled = useContext(DisabledContext);
  const fieldReadOnly = useContext(ReadOnlyContext);
  const fieldRequired = useContext(RequiredContext);
  const fieldLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);

  const idResolved = id || fieldToInterfaceContext?.id;
  const nameResolved = name || fieldName;
  const disabledResolved = disabled || fieldDisabled;
  const requiredResolved = required || fieldRequired;
  const loadingResolved =
    loading ||
    actionStatus.loading ||
    (fieldLoading && parentActionRequester === ref.current);
  const readOnlyResolved =
    readOnly || fieldReadOnly || loadingResolved || uiStateController.readOnly;

  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping,
  });
  const debugAction = useDebugAction();
  const debugInteraction = useDebugInteraction();
  const debugFocus = useDebugFocus();

  // infom any <Field> parent of our readOnly state + that we are interactive
  useLayoutEffect(() => {
    if (fieldToInterfaceContext) {
      fieldToInterfaceContext.setInteractive(true);
      fieldToInterfaceContext.setDisabled(disabledResolved);
      fieldToInterfaceContext.setReadOnly(readOnlyResolved);
    }
  }, [fieldToInterfaceContext, disabledResolved, readOnlyResolved]);

  useAutoFocus(ref, autoFocus, {
    focusVisible: autoFocusVisible,
    autoSelect,
  });
  useConstraints(ref, constraints);
  const remainingProps = useConstraintMessages(ref, rest);

  let childrenWithContext;
  if (children === undefined) {
    childrenWithContext = undefined;
  } else {
    /**
     * We are a field ourselve, which can contain other fields that should not inherit some of the context:
     * - id was used by this field, no other field use it
     * - message props are not meant to be propagated either, they are specific to a given field
     * - readonly/required reporting is specific to this field interface. No other field interface should be able to report to parent
     */
    childrenWithContext = (
      <MessagePropsRefContext.Provider value={undefined}>
        <FieldToInterfaceContext.Provider value={undefined}>
          {children}
        </FieldToInterfaceContext.Provider>
      </MessagePropsRefContext.Provider>
    );
  }

  const uiState = uiStateController.uiStateSignal.value;
  const actionProps = {
    "children": childrenWithContext,
    ref,
    type,
    "id": idResolved,
    "name": nameResolved,
    "required": requiredResolved,
    "disabled": disabledResolved,
    "action": undefined,
    "data-action":
      props.action === undefined
        ? undefined
        : typeof props.action === "string"
          ? props.action
          : action.callSource,
    "navi-autofocus": autoFocus ? "" : undefined,
    "aria-busy": loadingResolved,
    "basePseudoState": {
      ...basePseudoState,
      ":disabled": disabledResolved,
      ":read-only": readOnlyResolved,
      ":-navi-loading": loadingResolved,
    },
    "onnavi_request_reset_ui_state": (e) => {
      uiStateController.resetUIState(e);
    },
    "onnavi_get_ui_state": (e) => {
      e.detail.respondWith(uiState);
    },
    "onnavi_get_ui_value": (e) => {
      e.detail.respondWith(getUIValue(e));
    },
    "onnavi_cancel": (e) => {
      const { reason } = e.detail;
      const isBlurInvalid = reason.startsWith("blur_invalid");

      if (resetOnCancel) {
        if (isBlurInvalid) {
          return;
        }
        dispatchRequestResetUIState(e.currentTarget, e);
        onCancel?.(e, reason);
        return;
      }
      if (isBlurInvalid) {
        if (!cancelOnBlurInvalid) {
          return;
        }
        if (
          // error prevent cancellation until the user closes it (or something closes it)
          e.detail.failedConstraintInfo.level === "error" &&
          e.detail.failedConstraintInfo.reportStatus !== "closed"
        ) {
          return;
        }
      }
      if (reason === "escape_key") {
        if (!cancelOnEscape) {
          return;
        }
      }
      onCancel?.(e, reason);
    },
    "onnavi_set_ui_state": (e) => {
      uiStateController.setUIState(e.detail.value, e);
    },
    "onnavi_request_interaction": (e) => {
      onRequestInteraction(e, { debugInteraction });

      transfer_focus_to_target: {
        const naviProxyTarget = getNaviProxyTarget(e);
        if (!naviProxyTarget) {
          break transfer_focus_to_target;
        }
        const mousedownEvent = findEvent(e, "mousedown");
        if (mousedownEvent) {
          if (mousedownEvent.defaultPrevented) {
            // not really used but any code calling preventDefault can also prevent navi custom behaviors
            break transfer_focus_to_target;
          }
          debugFocus(
            e,
            "move focus to proxy (using preventDefault() + focus({ focusVisible: false })",
          );
          mousedownEvent.preventDefault();
          naviProxyTarget.focus({ focusVisible: false });
          break transfer_focus_to_target;
        }
        // We also transfer on click even if mousedown is there because:
        // - it's possible to receive a click without a mousedown (<label>)
        // - so it's possible to end up focused by the browser without having a chance to preventDefault on the mousedown
        // -> We do it also on click
        // No need to preventDefault here though
        // -> This ensure browser don't complain we try to focus a aria-hidden element
        // and ensure the focus ends up where it should
        const clickEvent = findEvent(e, "click");
        if (clickEvent) {
          if (clickEvent.defaultPrevented) {
            // not really used but any code calling preventDefault can also prevent navi custom behavior
            break transfer_focus_to_target;
          }
          naviProxyTarget.focus({ focusVisible: false });
          break transfer_focus_to_target;
        }
      }
    },
    "onnavi_request_action": (e) => {
      let uiState;
      if (Object.hasOwn(e.detail, "uiState")) {
        // uiState was forwarded by a proxy — use it directly to avoid
        // re-computing from the element's own state (which may already reflect
        // the optimistic update and return undefined for radio)
        uiState = e.detail.uiState;
      } else {
        dispatchInternalCustomEvent(e.currentTarget, "navi_get_ui_value", {
          respondWith: (v) => {
            debugAction(
              e,
              `navi_get_ui_value.respondWith(${JSON.stringify(v)})`,
            );
            uiState = v;
          },
        });
        e.detail.uiState = uiState;
      }
      const naviProxyTarget = getNaviProxyTarget(e);
      if (naviProxyTarget) {
        // Apply the proxy's desired uiState optimistically before dispatching so
        // the target's UI updates immediately, then forward the action.
        // uiState is included explicitly so the target's onnavi_request_action
        // can detect it via Object.hasOwn and skip re-computing from its own
        // navi_request_ui_state (which would return undefined for an already-set radio).
        dispatchRequestSetUIState(naviProxyTarget, uiState, { event: e });
        return;
      }
      if (e.detail.action) {
        // keyboard shortcut give the action and action is irrelevant here, the kayboard shortcut must win
      } else {
        e.detail.actionOrigin = "action_prop";
        e.detail.action = action;
      }

      onRequestAction(e, { debugAction });
    },
    "onnavi_action_prevented": onActionPrevented,
    "onnavi_action_ready": (e) => {
      if (e.detail.action === "auto") {
        // special case for the use case where form.submit is called
        e.detail.action = action;
      }
      const { uiState } = e.detail;
      dispatchRequestSetUIState(e.currentTarget, uiState, {
        event: e.detail.event,
      });
      executeAction(e);
    },
    "onnavi_action_abort": (e) => {
      if (resetOnAbort) {
        dispatchRequestResetUIState(e.currentTarget, e);
      }
      onActionAborted?.(e);
    },
    "onnavi_action_error": (e) => {
      const { error } = e.detail;
      if (resetOnError) {
        dispatchRequestResetUIState(e.currentTarget, e);
      }
      onActionError?.(error, e);
    },
    "onnavi_action_end": (e) => {
      const { data } = e.detail;
      uiStateController.actionEnd(e);
      onActionEnd?.(data, e);
      remainingProps.onnavi_action_end?.(e);
    },
  };

  if (readOnlySupported) {
    actionProps.readOnly = readOnlyResolved;
  } else {
    actionProps["aria-readonly"] = readOnlyResolved;
  }

  const { statePropName, defaultStatePropName } = uiStateController;
  if (statePropName) {
    const statePropValueRaw = uiStateController.getPropFromState(uiState);
    actionProps[statePropName] = statePropValueRaw;
    if (defaultStatePropName) {
      delete actionProps[defaultStatePropName];
      delete remainingProps[defaultStatePropName];
    }
  }

  return [actionProps, remainingProps];
};

const getNaviProxyTarget = (event) => {
  const currentTarget = event.currentTarget;
  const proxyFor = currentTarget.getAttribute("navi-proxy-for");
  if (!proxyFor) {
    return null;
  }
  const realInput = document.getElementById(proxyFor);
  return realInput;
};
