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

import { useCallback, useContext, useId, useRef } from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { PSEUDO_CLASSES } from "../box/pseudo_styles.js";
import { Icon } from "../graphic/icon.jsx";
import { CloseSvg } from "../graphic/icons/close_svg.jsx";
import { EmailSvg } from "../graphic/icons/email_svg.jsx";
import { PhoneSvg } from "../graphic/icons/phone_svg.jsx";
import { SearchSvg } from "../graphic/icons/search_svg.jsx";
import { useStableCallback } from "../utils/use_stable_callback.js";
import { ReportReadOnlyOnLabelContext } from "./label.jsx";
import { LoaderBackground } from "./loader/loader_background.jsx";
import { useActionEvents } from "./use_action_events.js";
import { useAutoFocus } from "./use_auto_focus.js";
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
import { forwardActionRequested } from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_input {
      --border-radius: 2px;
      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));

      /* Default */
      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
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
    }
  }

  .navi_input {
    position: relative;
    box-sizing: border-box;
    width: fit-content;
    height: fit-content;
    flex-direction: inherit;
    border-radius: inherit;
    cursor: inherit;

    --x-outline-width: var(--outline-width);
    --x-border-radius: var(--border-radius);
    --x-border-width: var(--border-width);
    --x-outer-width: calc(var(--x-border-width) + var(--x-outline-width));
    --x-outline-color: var(--outline-color);
    --x-border-color: var(--border-color);
    --x-background-color: var(--background-color);
    --x-color: var(--color);
    --x-placeholder-color: var(--placeholder-color);

    .navi_native_input {
      box-sizing: border-box;
      padding-top: var(--padding-top, var(--padding-y, var(--padding, 1px)));
      padding-right: var(
        --padding-right,
        var(--padding-x, var(--padding, 2px))
      );
      padding-bottom: var(
        --padding-bottom,
        var(--padding-y, var(--padding, 1px))
      );
      padding-left: var(--padding-left, var(--padding-x, var(--padding, 2px)));
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

      &[type="search"] {
        -webkit-appearance: textfield;

        &::-webkit-search-cancel-button {
          display: none;
        }
      }
    }

    .navi_start_icon_label {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0.25em;
    }
    .navi_end_icon_label {
      position: absolute;
      top: 0;
      right: 0.25em;
      bottom: 0;
      opacity: 0;
      pointer-events: none;
    }
    &[data-has-value] {
      .navi_end_icon_label {
        opacity: 1;
        pointer-events: auto;
      }
    }

    &[data-start-icon] {
      .navi_native_input {
        padding-left: 20px;
      }
    }
    &[data-end-icon] {
      .navi_native_input {
        padding-right: 20px;
      }
    }
  }

  .navi_input .navi_native_input::placeholder {
    color: var(--x-placeholder-color);
  }
  .navi_input .navi_native_input:-internal-autofill-selected {
    /* Webkit is putting some nasty styles after automplete that look as follow */
    /* input:-internal-autofill-selected { color: FieldText !important; } */
    /* Fortunately we can override it as follow */
    -webkit-text-fill-color: var(--x-color) !important;
  }
  /* Readonly */
  .navi_input[data-readonly] {
    --x-border-color: var(--border-color-readonly);
    --x-background-color: var(--background-color-readonly);
    --x-color: var(--color-readonly);
  }
  /* Focus */
  .navi_input[data-focus] .navi_native_input,
  .navi_input[data-focus-visible] .navi_native_input {
    outline-width: var(--x-outer-width);
    outline-offset: calc(-1 * var(--x-outer-width));
    --x-border-color: var(--x-outline-color);
  }
  /* Disabled */
  .navi_input[data-disabled] {
    --x-border-color: var(--border-color-disabled);
    --x-background-color: var(--background-color-disabled);
    --x-color: var(--color-disabled);
  }
  /* Callout (info, warning, error) */
  .navi_input[data-callout] {
    --x-border-color: var(--callout-color);
  }
`;

export const InputTextual = (props) => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);

  const input = renderActionableComponent(props, {
    Basic: InputTextualBasic,
    WithAction: InputTextualWithAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{input}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const InputStyleCSSVars = {
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "borderRadius": "--border-radius",
  "paddingTop": "--padding-top",
  "paddingRight": "--padding-right",
  "paddingBottom": "--padding-bottom",
  "paddingLeft": "--padding-left",
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
  ":navi-has-value",
];
Object.assign(PSEUDO_CLASSES, {
  ":navi-has-value": {
    attribute: "data-has-value",
    setup: (el, callback) => {
      const onValueChange = () => {
        callback();
      };

      // Standard user input (typing)
      el.addEventListener("input", onValueChange);
      // Autocomplete, programmatic changes, form restoration
      el.addEventListener("change", onValueChange);
      // Form reset - need to check the form
      const form = el.form;
      const onFormReset = () => {
        // Form reset happens asynchronously, check value after reset completes
        setTimeout(onValueChange, 0);
      };
      if (form) {
        form.addEventListener("reset", onFormReset);
      }

      // Paste events (some browsers need special handling)
      el.addEventListener("paste", onValueChange);
      // Focus events to catch programmatic changes that don't fire other events
      // (like when value is set before user interaction)
      el.addEventListener("focus", onValueChange);
      return () => {
        el.removeEventListener("input", onValueChange);
        el.removeEventListener("change", onValueChange);
        el.removeEventListener("paste", onValueChange);
        el.removeEventListener("focus", onValueChange);
        if (form) {
          form.removeEventListener("reset", onFormReset);
        }
      };
    },
    test: (el) => {
      if (el.value === "") {
        return false;
      }
      return true;
    },
  },
});
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
    loading,

    autoFocus,
    autoFocusVisible,
    autoSelect,
    icon,
    cancelButton = type === "search",

    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

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
  const remainingProps = useConstraints(ref, rest);

  const innerOnInput = useStableCallback(onInput);
  const autoId = useId();
  const innerId = rest.id || autoId;
  const renderInput = (inputProps) => {
    return (
      <Box
        {...inputProps}
        as="input"
        id={innerId}
        ref={ref}
        type={type}
        data-value={uiState}
        value={innerValue}
        onInput={(e) => {
          let inputValue;
          if (type === "number") {
            inputValue = e.target.valueAsNumber;
            if (isNaN(inputValue)) {
              inputValue = e.target.value;
            }
          } else if (type === "datetime-local") {
            inputValue = convertToUTCTimezone(e.target.value);
          } else {
            inputValue = e.target.value;
          }
          uiStateController.setUIState(inputValue, e);
          innerOnInput?.(e);
        }}
        onresetuistate={(e) => {
          uiStateController.resetUIState(e);
        }}
        onsetuistate={(e) => {
          uiStateController.setUIState(e.detail.value, e);
        }}
        // style management
        baseClassName="navi_native_input"
      />
    );
  };

  const renderInputMemoized = useCallback(renderInput, [
    type,
    uiState,
    innerValue,
    innerOnInput,
    innerId,
  ]);

  let innerIcon;
  if (icon === undefined) {
    if (type === "search") {
      innerIcon = <SearchSvg />;
    } else if (type === "email") {
      innerIcon = <EmailSvg />;
    } else if (type === "tel") {
      innerIcon = <PhoneSvg />;
    }
  } else {
    innerIcon = icon;
  }

  return (
    <Box
      as="span"
      box
      baseClassName="navi_input"
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_native_input"
      visualSelector=".navi_native_input"
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      hasChildFunction
      data-start-icon={innerIcon ? "" : undefined}
      data-end-icon={cancelButton ? "" : undefined}
      {...remainingProps}
      ref={undefined}
    >
      <LoaderBackground
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      {innerIcon && (
        <Icon
          as="label"
          htmlFor={innerId}
          className="navi_start_icon_label"
          alignY="center"
          color="rgba(28, 43, 52, 0.5)"
        >
          {innerIcon}
        </Icon>
      )}
      {renderInputMemoized}
      {cancelButton && (
        <Icon
          as="label"
          htmlFor={innerId}
          className="navi_end_icon_label"
          alignY="center"
          color="rgba(28, 43, 52, 0.5)"
          onMousedown={(e) => {
            e.preventDefault(); // keep focus on the button
          }}
          onClick={() => {
            uiStateController.setUIState("", { trigger: "cancel_button" });
          }}
        >
          <CloseSvg />
        </Icon>
      )}
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
