/**
 * Input component for all textual input types.
 *
 * Supports:
 * - text (default)
 * - password
 * - hidden
 * - email
 * - url
 * - search
 * - tel
 * - etc.
 *
 * For non-textual inputs, specialized components will be used:
 * - <InputCheckbox /> for type="checkbox"
 * - <InputRadio /> for type="radio"
 */

import { useContext, useRef } from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { forwardActionRequested } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { Box } from "../layout/box.jsx";
import { withPropsStyle } from "../layout/with_props_style.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { ReportReadOnlyOnLabelContext } from "./label.jsx";
import { useActionEvents } from "./use_action_events.js";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_input {
      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));
      --padding-x: 6px;
      --padding-y: 1px;

      --outline-color: light-dark(#4476ff, #3b82f6);

      --border-radius: 2px;
      --border-color: light-dark(#767676, #8e8e93);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 45%,
        transparent
      );
      --border-color-disabled: var(--border-color-readonly);

      --background-color: white;
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --background-color-readonly: var(--background-color);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 60%,
        transparent
      );

      --color: currentColor;
      --color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
      --color-readonly: var(--color-dimmed);
      --color-disabled: var(--color-readonly);

      width: 100%;
      color: var(--color);

      background-color: var(--background-color);
      border-width: var(--outer-width);
      border-width: var(--outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--border-radius);
      outline-width: var(--border-width);
      outline-style: solid;
      outline-color: var(--border-color);
      outline-offset: calc(-1 * (var(--border-width)));
    }
    .navi_input::placeholder {
      color: var(--color-dimmed);
    }
    .navi_input:-internal-autofill-selected {
      /* Webkit is putting some nasty styles after automplete that look as follow */
      /* input:-internal-autofill-selected { color: FieldText !important; } */
      /* Fortunately we can override it as follow */
      -webkit-text-fill-color: var(--color) !important;
    }
    /* Focus */
    .navi_input[data-focus] {
      border-color: var(--outline-color);
      outline-width: var(--outer-width);
      outline-color: var(--outline-color);
      outline-offset: calc(-1 * var(--outer-width));
    }
    /* Readonly */
    .navi_input[data-readonly] {
      --color: var(--color-readonly);
      background-color: var(--background-color-readonly);
      outline-color: var(--border-color-readonly);
    }
    /* Disabled */
    .navi_input[data-disabled] {
      --color: var(--color-disabled);
      background-color: var(--background-color-disabled);
      outline-color: var(--border-color-disabled);
    }
    /* Callout (info, warning, error) */
    .navi_input[data-callout] {
      border-color: var(--callout-color);
    }
  }
`;

export const InputTextual = (props) => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);

  const input = renderActionableComponent(props, {
    Basic: InputTextualBasic,
    WithAction: InputTextualWithAction,
    InsideForm: InputTextualInsideForm,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{input}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const InputTextualBasic = (props) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    type,
    onInput,

    readOnly,
    disabled,
    constraints = [],
    loading,

    autoFocus,
    autoFocusVisible,
    autoSelect,

    // visual
    accentColor,

    ref = useRef(),

    ...rest
  } = props;

  const innerValue =
    type === "datetime-local" ? convertToLocalTimezone(uiState) : uiState;
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyOnLabel?.(innerReadOnly);
  useAutoFocus(ref, autoFocus, {
    autoFocusVisible,
    autoSelect,
  });
  useConstraints(ref, constraints);

  const [remainingProps, wrapperStyle, inputStyle] = withPropsStyle(
    rest,
    {
      base: {
        "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)",
      },
      layout: true,
    },
    {
      spacing: true,
    },
  );
  const inputTextual = (
    <Box
      {...remainingProps}
      as="input"
      ref={ref}
      style={inputStyle}
      type={type}
      data-value={uiState}
      value={innerValue}
      pseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
      }}
      onInput={(e) => {
        let inputValue;
        if (type === "number") {
          inputValue = e.target.valueAsNumber;
        } else if (type === "datetime-local") {
          inputValue = convertToUTCTimezone(e.target.value);
        } else {
          inputValue = e.target.value;
        }
        uiStateController.setUIState(inputValue, e);
        onInput?.(e);
      }}
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
      onsetuistate={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
    />
  );

  if (type === "hidden") {
    return inputTextual;
  }
  return (
    <LoadableInlineElement
      loading={innerLoading}
      style={wrapperStyle}
      color="var(--accent-color)"
      inset={-1}
    >
      {inputTextual}
    </LoadableInlineElement>
  );
};

const InputTextualWithAction = (props) => {
  const uiState = useContext(UIStateContext);
  const {
    action,
    loading,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    ref = useRef(),
    ...rest
  } = props;
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(ref, {
    onCancel: (e, reason) => {
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
    onRequested: (e) => {
      forwardActionRequested(e, boundAction);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <InputTextualBasic
      data-action={boundAction.name}
      {...rest}
      ref={ref}
      loading={loading || actionLoading}
    />
  );
};
const InputTextualInsideForm = (props) => {
  const {
    // We destructure formContext to avoid passing it to the underlying input element
    // eslint-disable-next-line no-unused-vars
    formContext,
    ...rest
  } = props;

  return <InputTextualBasic {...rest} />;
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
