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

import { forwardRef } from "preact/compat";
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useActionStatus } from "../../use_action_status.js";
import { requestAction } from "../../validation/custom_constraint_validation.js";
import { useConstraints } from "../../validation/hooks/use_constraints.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { initCustomField } from "./custom_field.js";
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
    --color-readonly: color-mix(in srgb, currentColor 60%, transparent);
    --color-disabled: var(--color-readonly);
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
  /* Focus */
  .navi_input[data-focus] {
    border-color: var(--outline-color);
    outline-width: var(--outer-width);
    outline-color: var(--outline-color);
    outline-offset: calc(-1 * var(--outer-width));
  }
  /* Readonly */
  .navi_input[data-readonly] {
    color: var(--color-readonly);
    background-color: var(--background-color-readonly);
    outline-color: var(--border-color-readonly);
  }
  .navi_input[data-readonly]::placeholder {
    color: var(--color-readonly);
  }
  /* Disabled */
  .navi_input[data-disabled] {
    color: var(--color-disabled);
    background-color: var(--background-color-disabled);
    outline-color: var(--border-color-disabled);
  }
  /* Invalid */
  .navi_input[aria-invalid="true"] {
    border-color: var(--invalid-color);
  }
`;

export const InputTextual = forwardRef((props, ref) => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);

  const input = renderActionableComponent(props, ref, {
    Basic: InputTextualBasic,
    WithAction: InputTextualWithAction,
    InsideForm: InputTextualInsideForm,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>{input}</UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
});

const InputTextualBasic = forwardRef((props, ref) => {
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
    appearance = "navi",
    accentColor,
    width,
    height,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const innerValue =
    type === "datetime-local" ? convertToLocalTimezone(uiState) : uiState;
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === innerRef.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyOnLabel?.(innerReadOnly);
  useAutoFocus(innerRef, autoFocus, {
    autoFocusVisible,
    autoSelect,
  });
  useConstraints(innerRef, constraints);

  const inputTextual = (
    <input
      {...rest}
      ref={innerRef}
      className={appearance === "navi" ? "navi_input" : undefined}
      type={type}
      data-value={uiState}
      value={innerValue}
      readOnly={innerReadOnly}
      disabled={innerDisabled}
      data-readOnly={innerReadOnly ? "" : undefined}
      data-disabled={innerDisabled ? "" : undefined}
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
      // eslint-disable-next-line react/no-unknown-property
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onsetuistate={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
    />
  );

  useLayoutEffect(() => {
    return initCustomField(innerRef.current, innerRef.current);
  }, []);

  if (type === "hidden") {
    return inputTextual;
  }
  return (
    <LoadableInlineElement
      loading={innerLoading}
      style={{
        "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)",
      }}
      color="var(--accent-color)"
      width={width}
      height={height}
      inset={-1}
    >
      {inputTextual}
    </LoadableInlineElement>
  );
});

const InputTextualWithAction = forwardRef((props, ref) => {
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
    onInput,
    onKeyDown,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const valueAtInteractionRef = useRef(null);

  useOnInputChange(innerRef, (e) => {
    if (
      valueAtInteractionRef.current !== null &&
      e.target.value === valueAtInteractionRef.current
    ) {
      valueAtInteractionRef.current = null;
      return;
    }
    requestAction(e.target, boundAction, {
      event: e,
      actionOrigin: "action_prop",
    });
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(innerRef, {
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
        /**
         * Browser trigger a "change" event right after the escape is pressed
         * if the input value has changed.
         * We need to prevent the next change event otherwise we would request action when
         * we actually want to cancel
         */
        valueAtInteractionRef.current = e.target.value;
      }
      onCancel?.(e, reason);
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
      ref={innerRef}
      loading={loading || actionLoading}
      onInput={(e) => {
        valueAtInteractionRef.current = null;
        onInput?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") {
          return;
        }
        e.preventDefault();
        /**
         * Browser trigger a "change" event right after the enter is pressed
         * if the input value has changed.
         * We need to prevent the next change event otherwise we would request action twice
         */
        valueAtInteractionRef.current = e.target.value;
        requestAction(e.target, boundAction, {
          event: e,
          actionOrigin: "action_prop",
        });
        onKeyDown?.(e);
      }}
    />
  );
});
const InputTextualInsideForm = forwardRef((props, ref) => {
  const {
    onKeyDown,
    // We destructure formContext to avoid passing it to the underlying input element
    // eslint-disable-next-line no-unused-vars
    formContext,
    ...rest
  } = props;

  return (
    <InputTextualBasic
      {...rest}
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const inputElement = e.target;
          const { form } = inputElement;
          const formSubmitButton = form.querySelector(
            "button[type='submit'], input[type='submit'], input[type='image']",
          );
          e.preventDefault();
          form.dispatchEvent(
            new CustomEvent("actionrequested", {
              detail: {
                requester: formSubmitButton ? formSubmitButton : inputElement,
                event: e,
                meta: { isSubmit: true },
                actionOrigin: "action_prop",
              },
            }),
          );
        }
        onKeyDown?.(e);
      }}
    />
  );
});

const useOnInputChange = (inputRef, callback) => {
  // we must use a custom event listener because preact bind onChange to onInput for compat with react
  useEffect(() => {
    const input = inputRef.current;
    input.addEventListener("change", callback);
    return () => {
      input.removeEventListener("change", callback);
    };
  }, [callback]);

  // Handle programmatic value changes that don't trigger browser change events
  //
  // Problem: When input values are set programmatically (not by user typing),
  // browsers don't fire the 'change' event. However, our application logic
  // still needs to detect these changes.
  //
  // Example scenario:
  // 1. User starts editing (letter key pressed, value set programmatically)
  // 2. User doesn't type anything additional (this is the key part)
  // 3. User clicks outside to finish editing
  // 4. Without this code, no change event would fire despite the fact that the input value did change from its original state
  //
  // This distinction is crucial because:
  //
  // - If the user typed additional text after the initial programmatic value,
  //   the browser would fire change events normally
  // - But when they don't type anything else, the browser considers it as "no user interaction"
  //   even though the programmatic initial value represents a meaningful change
  const valueAtStartRef = useRef();
  const interactedRef = useRef(false);
  useLayoutEffect(() => {
    const input = inputRef.current;
    valueAtStartRef.current = input.value;

    const onfocus = () => {
      interactedRef.current = false;
      valueAtStartRef.current = input.value;
    };
    const oninput = (e) => {
      if (!e.isTrusted) {
        // non trusted "input" events will be ignored by the browser when deciding to fire "change" event
        // we ignore them too
        return;
      }
      interactedRef.current = true;
    };
    const onblur = (e) => {
      if (interactedRef.current) {
        return;
      }
      if (valueAtStartRef.current === input.value) {
        return;
      }
      callback(e);
    };

    input.addEventListener("focus", onfocus);
    input.addEventListener("input", oninput);
    input.addEventListener("blur", onblur);

    return () => {
      input.removeEventListener("focus", onfocus);
      input.removeEventListener("input", oninput);
      input.removeEventListener("blur", onblur);
    };
  }, []);
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
