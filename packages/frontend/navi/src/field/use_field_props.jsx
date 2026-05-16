import { useContext } from "preact/hooks";

import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { useDebugUIAction } from "../navi_debug.jsx";
import {
  FieldContext,
  reportDisabledToField,
  reportInteractiveToField,
  reportReadOnlyToField,
} from "./field.jsx";
import { ActionRequesterContext } from "./use_action_props.jsx";
import {
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
  UIStateControllerContext,
  useUIState,
} from "./use_ui_state_controller.js";
import { onRequestUIAction } from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

export const UI_STATE_NOT_AVAILABLE = Symbol("UI_STATE_NOT_AVAILABLE");
export const useFieldProps = (props) => {
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
    ...rest
  } = props;
  const debugUIAction = useDebugUIAction();
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const actionRequester = useContext(ActionRequesterContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useUIState(uiStateController);

  const value = uiState;
  const innerLoading =
    loading || (contextLoading && actionRequester === ref.current);
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
  }

  return {
    "children": childrenWithContext,
    ...remainingProps,
    ref,
    "value": valueForBrowser,
    "onnavi_request_reset_ui_state": (e) => {
      uiStateController.resetUIState(e);
    },
    "onnavi_set_ui_state": (e) => {
      const { value } = e.detail;
      uiStateController.setUIState(value, e);
    },
    "onnavi_request_ui_action": (e) => {
      const { value, uiAction } = e.detail;
      if (value === UI_STATE_NOT_AVAILABLE) {
        // we can't execute uiAction right now as value is not available
        // we just want to check if action is allowed to preventDefault or give feedback
        // but the value will be set later (checkbox "click" vs checkbox "input" use case)
        e.detail.uiAction = () => {};
      } else {
        if (type === "number") {
          const inputValueAsNumber = Number(value);
          if (!isNaN(inputValueAsNumber)) {
            e.detail.value = inputValueAsNumber;
          }
        } else if (type === "datetime-local") {
          e.detail.value = convertToUTCTimezone(value);
        }
        e.detail.uiAction = (value, e) => {
          uiStateController.setUIState(value, e);
          uiAction?.(value, e);
        };
      }
      onRequestUIAction(e, {
        debugUIAction,
      });
    },
    "autoFocus": undefined, // See use_auto_focus.js
    "basePseudoState": {
      ...basePseudoState,
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading,
    },
    "aria-busy": innerLoading,
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
