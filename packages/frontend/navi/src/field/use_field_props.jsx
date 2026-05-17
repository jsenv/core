import { dispatchInternalCustomEvent } from "@jsenv/dom";
import { useContext } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { useExecuteAction } from "@jsenv/navi/src/action/use_execute_action.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { useDebugAction } from "../navi_debug.jsx";
import {
  FieldContext,
  reportDisabledToField,
  reportInteractiveToField,
  reportReadOnlyToField,
} from "./field.jsx";
import { ActionRequesterContext } from "./field_context.js";
import { normalizeAction } from "./ui_actions.js";
import {
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";
import {
  onRequestAction,
  onRequestInteraction,
} from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

export const UI_STATE_NOT_AVAILABLE = Symbol("UI_STATE_NOT_AVAILABLE");
export const useFieldProps = (
  props,
  {
    fieldType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    getStateFromParent,
    allowNameless,
    persists,

    readUIState,
    paramsSignal,
    externalBoundAction,
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
    allowNameless,
    persists,
    debugAction,
  });

  paramsSignal = paramsSignal || uiStateController.uiStateSignal;

  return useActionProps(props, {
    uiStateController,
    readUIState,
    paramsSignal,
    externalBoundAction,
  });
};

export const useActionProps = (
  props,
  { uiStateController, readUIState, paramsSignal, externalBoundAction },
) => {
  const {
    ref,

    loading,
    readOnly,
    disabled,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    basePseudoState,
    children,

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
  const action = normalizeAction(props.action);
  const [internalBoundAction] = useActionBoundToOneParam(
    externalBoundAction ? undefined : action,
    paramsSignal,
  );
  const boundAction = externalBoundAction || internalBoundAction;
  const actionStatus = useActionStatus(boundAction);

  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const parentActionRequester = useContext(ActionRequesterContext);

  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping,
  });
  const debugAction = useDebugAction();

  const uiState = useUIState(uiStateController);
  const value = uiState;
  const innerLoading =
    loading ||
    actionStatus.loading ||
    (contextLoading && parentActionRequester === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <Field> parent of our readOnly state + that we are interactive
  reportReadOnlyToField(innerReadOnly);
  reportDisabledToField(innerDisabled);
  reportInteractiveToField(true);
  useAutoFocus(ref, autoFocus, {
    focusVisible: autoFocusVisible,
    autoSelect,
  });
  const remainingProps = useConstraints(ref, rest);

  let childrenWithContext;
  if (children === undefined) {
    childrenWithContext = undefined;
  } else {
    /* We are a field ourselve, which can contain other fields that should not inherit our field */
    childrenWithContext = (
      <FieldContext.Provider value={null}>{children}</FieldContext.Provider>
    );
  }

  const { type } = props;
  let valueForBrowser;
  if (type === "datetime-local") {
    valueForBrowser = convertToLocalTimezone(value);
  } else if (type === "color") {
    if (!value) {
      valueForBrowser = "#000000";
    }
  } else {
    valueForBrowser = value;
  }

  return {
    "children": childrenWithContext,
    ...remainingProps,
    ref,
    "value": valueForBrowser,
    "autoFocus": undefined, // See use_auto_focus.js
    "basePseudoState": {
      ...basePseudoState,
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading,
    },
    "aria-busy": innerLoading,
    "data-action": boundAction.callSource,
    "onnavi_request_reset_ui_state": (e) => {
      uiStateController.resetUIState(e);
    },
    "onnavi_request_ui_state": (e) => {
      e.detail.respondWith(readUIState(e));
    },
    "onnavi_set_ui_state": (e) => {
      const { value } = e.detail;
      uiStateController.setUIState(value, e);
    },
    "onnavi_request_interaction": (e) => {
      onRequestInteraction(e);
    },
    "onnavi_cancel": (e) => {
      const { reason } = e.detail;

      if (resetOnCancel) {
        if (reason.startsWith("blur_invalid")) {
          return;
        }
        uiStateController.resetUIState(e);
        onCancel?.(e, reason);
        return;
      }
      if (reason.startsWith("blur_invalid")) {
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
    "onnavi_request_action": (e) => {
      let uiStateRaw;
      dispatchInternalCustomEvent(e.currentTarget, "navi_request_ui_state", {
        respondWith: (v) => {
          debugAction(
            e,
            `navi_request_ui_state.respondWith(${JSON.stringify(v)})`,
          );
          uiStateRaw = v;
        },
      });
      if (type === "number") {
        const inputValueAsNumber = Number(uiStateRaw);
        if (isNaN(inputValueAsNumber)) {
          e.detail.uiState = uiStateRaw;
        } else {
          e.detail.uiState = inputValueAsNumber;
        }
      } else if (type === "datetime-local") {
        e.detail.uiState = convertToUTCTimezone(uiStateRaw);
      } else {
        e.detail.uiState = uiStateRaw;
      }

      if (e.detail.action) {
        // keyboard shotcut give the action and action is irrelevant here, the kayboard shortcut must win
      } else {
        e.detail.actionOrigin = "action_prop";
        e.detail.action = boundAction;
      }

      onRequestAction(e, { debugAction });
    },
    "onnavi_action_prevented": onActionPrevented,
    "onnavi_action_ready": (e) => {
      if (e.detail.action === "auto") {
        // special case for the use case where form.submit is called
        e.detail.action = boundAction;
      }

      const { uiState } = e.detail;
      uiStateController.setUIState(uiState, e);
      executeAction(e);
    },
    "onnavi_action_abort": (e) => {
      if (resetOnAbort) {
        uiStateController.resetUIState(e);
      }
      onActionAborted?.(e);
    },
    "onnavi_action_error": (e) => {
      const { error } = e.detail;
      if (resetOnError) {
        uiStateController.resetUIState(e);
      }
      onActionError?.(error, e);
    },
    "onnavi_action_end": (e) => {
      const { data } = e.detail;
      uiStateController.actionEnd(e);
      onActionEnd?.(data, e);
    },
  };
};

// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const convertToLocalTimezone = (dateTimeString) => {
  const date = new Date(dateTimeString);
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }

  // Format to YYYY-MM-DDThh:mm:ss
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

/**
 * Converts a datetime string without timezone (local time) to UTC format with 'Z' notation
 *
 * @param {string} localDateTimeString - Local datetime string without timezone (e.g., "2023-07-15T14:30:00")
 * @returns {string} Datetime string in UTC with 'Z' notation (e.g., "2023-07-15T12:30:00Z")
 */
const convertToUTCTimezone = (localDateTimeString) => {
  if (!localDateTimeString) {
    return localDateTimeString;
  }

  try {
    // Create a Date object using the local time string
    // The browser will interpret this as local timezone
    const localDate = new Date(localDateTimeString);

    // Check if the date is valid
    if (isNaN(localDate.getTime())) {
      return localDateTimeString;
    }

    // Convert to UTC ISO string
    const utcString = localDate.toISOString();

    // Return the UTC string (which includes the 'Z' notation)
    return utcString;
  } catch (error) {
    console.error("Error converting local datetime to UTC:", error);
    return localDateTimeString;
  }
};
