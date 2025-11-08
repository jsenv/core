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
import { LoaderBackground } from "../loader/loader_background.jsx";
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
      position: relative;
      display: inline-flex;
      box-sizing: border-box;
      width: fit-content;
      height: fit-content;
      flex-direction: inherit;
      border-radius: inherit;
      cursor: inherit;

      --border-radius: 2px;
      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));
      --padding-x: 6px;
      --padding-y: 1px;

      /* Default */
      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --color: currentColor;
      --color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
      --placeholder-color: var(--color-dimmed);
      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --color-hover: var(--color);
      /* Active */
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 45%,
        transparent
      );
      --background-color-readonly: var(--background-color);
      --color-readonly: var(--color-dimmed);
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 95%,
        grey
      );
      --color-disabled: color-mix(in srgb, var(--color) 95%, grey);

      --x-outline-width: var(--outline-width);
      --x-border-radius: var(--border-radius);
      --x-border-width: var(--border-width);
      --x-outer-width: calc(var(--x-border-width) + var(--x-outline-width));

      --x-outline-color: var(--outline-color);
      --x-border-color: var(--border-color);
      --x-background-color: var(--background-color);
      --x-color: var(--color);
      --x-border-color-hover: var(--border-color-hover);
      --x-background-color-hover: var(--background-color-hover);
      --x-color-hover: var(--color-hover);
      --x-border-color-active: var(--border-color-active);
      --x-border-color-readonly: var(--border-color-readonly);
      --x-background-color-readonly: var(--background-color-readonly);
      --x-color-readonly: var(--color-readonly);
      --x-border-color-disabled: var(--border-color-disabled);
      --x-background-color-disabled: var(--background-color-disabled);
      --x-color-disabled: var(--color-disabled);
    }

    .navi_input_field {
      box-sizing: border-box;
      width: 100%;
      color: var(--x-color);

      background-color: var(--x-background-color);
      border-width: var(--x-outer-width);
      border-width: var(--x-outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--x-border-radius);
      outline-width: var(--x-border-width);
      outline-style: solid;
      outline-color: var(--x-border-color);
      outline-offset: calc(-1 * (var(--x-border-width)));
    }

    .navi_input_field::placeholder {
      color: var(--placeholder-color);
    }
    .navi_input_field:-internal-autofill-selected {
      /* Webkit is putting some nasty styles after automplete that look as follow */
      /* input:-internal-autofill-selected { color: FieldText !important; } */
      /* Fortunately we can override it as follow */
      -webkit-text-fill-color: var(--x-color) !important;
    }
    /* Readonly */
    .navi_input[data-readonly] {
      --x-border-color: var(--x-border-color-readonly);
      --x-background-color: var(--x-background-color-readonly);
      --x-color: var(--x-color-readonly);
    }
    /* Focus */
    .navi_input[data-focus] .navi_input_field,
    .navi_input[data-focus-visible] .navi_input_field {
      outline-width: var(--x-outer-width);
      outline-offset: calc(-1 * var(--x-outer-width));
      --x-border-color: var(--x-outline-color);
    }
    /* Disabled */
    .navi_input[data-disabled] {
      --x-border-color: var(--x-border-color-disabled);
      --x-background-color: var(--x-background-color-disabled);
      --x-color: var(--x-color-disabled);
    }
    /* Callout (info, warning, error) */
    .navi_input[data-callout] {
      --x-border-color: var(--callout-color);
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

const InputManagedByCSSVars = {
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "borderRadius": "--border-radius",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "color": "--color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover",
    color: "--color-hover",
  },
  ":active": {
    borderColor: "--border-color-active",
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly",
    color: "--color-readonly",
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled",
    color: "--color-disabled",
  },
};
const InputPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
const InputPseudoElements = ["::-navi-loader"];
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

    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

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

  // if (type === "hidden") {
  //   return inputTextual;
  // }

  return (
    <Box
      as="span"
      expandX={props.expandX}
      baseClassName="navi_input"
      baseStyle={{
        "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)",
      }}
      managedByCSSVars={InputManagedByCSSVars}
      pseudoStateSelector=".navi_input_field"
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
    >
      <LoaderBackground
        loading={innerLoading}
        color="var(--navi-loader-color)"
        inset={-1}
      />
      <Box
        {...rest}
        as="input"
        ref={ref}
        type={type}
        data-value={uiState}
        value={innerValue}
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
        // style management
        baseClassName="navi_input_field"
      />
    </Box>
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
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
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
