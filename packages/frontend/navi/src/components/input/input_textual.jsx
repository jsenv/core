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

import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef } from "preact/hooks";
import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneParam,
  useOneFormParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import "./field_css.js";
import { useOnChange } from "./use_on_change.js";

export const InputTextual = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: InputTextualBasic,
    WithAction: InputTextualWithAction,
    InsideForm: InputTextualInsideForm,
  });
});

const InputTextualBasic = forwardRef((props, ref) => {
  let {
    type,
    value,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    constraints = [],
    loading,
    appearance = "custom",

    // eslint-disable-next-line no-unused-vars
    cancelOnEscape,
    // eslint-disable-next-line no-unused-vars
    cancelOnBlurInvalid,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus, {
    autoFocusVisible,
    autoSelect,
  });
  useConstraints(innerRef, constraints);

  if (type === "datetime-local") {
    value = convertToLocalTimezone(value);
  }

  const inputTextual = (
    <input
      ref={innerRef}
      type={type}
      value={value}
      data-field=""
      data-field-with-border=""
      data-custom={appearance === "custom" ? "" : undefined}
      {...rest}
    />
  );

  return (
    <LoaderBackground loading={loading} color="light-dark(#355fcc, #3b82f6)">
      {inputTextual}
    </LoaderBackground>
  );
});

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

const InputTextualWithAction = forwardRef((props, ref) => {
  const {
    id,
    type,
    action,
    name,
    value: externalValue,
    valueSignal,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    readOnly,
    loading,
    onInput,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;
  if (import.meta.dev && !name && !valueSignal) {
    console.warn(`InputTextual with action requires a name prop to be set.`);
  }

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const [boundAction, value, setValue, resetValue] = useActionBoundToOneParam(
    action,
    name,
    valueSignal ? valueSignal : externalValue,
    navState,
    "",
  );
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  useEffect(() => {
    setNavState(value);
  }, [value]);

  const valueAtInteractionRef = useRef(null);
  useOnChange(innerRef, (e) => {
    if (
      valueAtInteractionRef.current !== null &&
      e.target.value === valueAtInteractionRef.current
    ) {
      valueAtInteractionRef.current = null;
      return;
    }
    requestAction(boundAction, { event: e });
  });

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
      resetValue();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: (e) => {
      setNavState(undefined);
      onActionEnd?.(e);
    },
  });

  const innerLoading = loading || actionLoading;

  return (
    <InputTextualBasic
      {...rest}
      data-action={boundAction}
      ref={innerRef}
      type={type}
      id={id}
      name={name}
      value={value}
      data-form-value={
        type === "datetime-local" ? convertToUTCTimezone(value) : undefined
      }
      loading={innerLoading}
      readOnly={readOnly || innerLoading}
      onInput={(e) => {
        valueAtInteractionRef.current = null;
        const inputValue =
          type === "number" ? e.target.valueAsNumber : e.target.value;
        setValue(
          type === "datetime-local"
            ? convertToUTCTimezone(inputValue)
            : inputValue,
        );
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
        requestAction(boundAction, { event: e });
      }}
    />
  );
});

const InputTextualInsideForm = forwardRef((props, ref) => {
  const {
    formContext,
    id,
    name,
    value: externalValue,
    loading,
    readOnly,
    onInput,
    onKeyDown,
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const { formAction, formIsBusy, formIsReadOnly, formActionRequester } =
    formContext;
  const [value, setValue] = useOneFormParam(name, externalValue, navState, "");
  useEffect(() => {
    setNavState(value);
  }, [value]);

  return (
    <InputTextualBasic
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      data-form-value={convertToUTCTimezone(value)}
      loading={
        loading || (formIsBusy && formActionRequester === innerRef.current)
      }
      readOnly={readOnly || formIsReadOnly}
      onInput={(e) => {
        const inputValue = e.target.value;
        setValue(convertToUTCTimezone(inputValue));
        onInput?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const inputElement = e.target;
          const { form } = inputElement;
          const formSubmitButton = form.querySelector(
            "button[type='submit'], input[type='submit'], input[type='image']",
          );
          e.preventDefault();
          requestAction(formAction, {
            event: e,
            target: form,
            requester: formSubmitButton ? formSubmitButton : inputElement,
          });
        }
        onKeyDown?.(e);
      }}
    />
  );
});
