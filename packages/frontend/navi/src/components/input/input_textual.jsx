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
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";

import { useNavState } from "../../browser_integration/browser_integration.js";
import { useActionStatus } from "../../use_action_status.js";
import { isSignal } from "../../utils/is_signal.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import {
  useActionBoundToOneParam,
  useOneFormParam,
} from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import {
  FieldGroupActionRequesterContext,
  FieldGroupDisabledContext,
  FieldGroupLoadingContext,
  FieldGroupOnFieldChangeContext,
  FieldGroupReadOnlyContext,
} from "../field_group_context.js";
import { LoadableInlineElement } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import "./field_css.js";
import { ReadOnlyContext } from "./label.jsx";
import { useFormEvents } from "./use_form_events.js";

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
    onValueChange,
    onInput,

    readOnly,
    disabled,
    constraints = [],
    loading,

    autoFocus,
    autoFocusVisible,
    autoSelect,
    appearance = "custom",
    ...rest
  } = props;
  const valueIsSignal = isSignal(value);
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const groupOnFieldChange = useContext(FieldGroupOnFieldChangeContext);
  const groupReadOnly = useContext(FieldGroupReadOnlyContext);
  const groupDisabled = useContext(FieldGroupDisabledContext);
  const groupActionRequester = useContext(FieldGroupActionRequesterContext);
  const groupLoading = useContext(FieldGroupLoadingContext);
  const setInputReadOnly = useContext(ReadOnlyContext);

  let innerValue = value;
  if (valueIsSignal) {
    innerValue = value.value;
  }
  if (type === "datetime-local") {
    innerValue = convertToLocalTimezone(innerValue);
  }
  const innerOnValueChange = onValueChange || groupOnFieldChange;
  const innerLoading =
    loading || (groupLoading && groupActionRequester === innerRef.current);
  const innerReadOnly =
    readOnly ||
    groupReadOnly ||
    innerLoading ||
    (!innerOnValueChange && !valueIsSignal);
  const innerDisabled = disabled || groupDisabled;
  // infom any <label> parent of our readOnly state
  if (setInputReadOnly) {
    setInputReadOnly(readOnly);
  }
  useAutoFocus(innerRef, autoFocus, {
    autoFocusVisible,
    autoSelect,
  });
  useConstraints(innerRef, constraints);

  const inputTextual = (
    <input
      ref={innerRef}
      type={type}
      value={innerValue}
      data-value={valueIsSignal ? value.value : value}
      data-field=""
      data-field-with-border=""
      data-custom={appearance === "custom" ? "" : undefined}
      readOnly={innerReadOnly}
      disabled={innerDisabled}
      onInput={(e) => {
        const inputValueRaw =
          type === "number" ? e.target.valueAsNumber : e.target.value;
        const inputValue =
          type === "datetime-local"
            ? convertToUTCTimezone(inputValueRaw)
            : inputValueRaw;
        innerOnValueChange?.(inputValue, e);
        onInput?.(e);
      }}
      {...rest}
    />
  );

  return (
    <LoadableInlineElement
      loading={innerLoading}
      color="light-dark(#355fcc, #3b82f6)"
    >
      {inputTextual}
    </LoadableInlineElement>
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

    name,
    value,
    onValueChange,
    action,
    valueSignal,

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
  if (import.meta.dev && !name && !valueSignal) {
    console.warn(`InputTextual with action requires a name prop to be set.`);
  }
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [boundAction, , setActionValue, initialValue] =
    useActionBoundToOneParam(action, name, value, navState, "");
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const valueAtInteractionRef = useRef(null);

  const innerOnValueChange = (uiValue, e) => {
    setNavState(uiValue);
    setActionValue(uiValue);
    onValueChange?.(uiValue, e);
  };
  useOnInputChange(innerRef, (e) => {
    if (
      valueAtInteractionRef.current !== null &&
      e.target.value === valueAtInteractionRef.current
    ) {
      valueAtInteractionRef.current = null;
      return;
    }
    requestAction(e.target, boundAction, { event: e });
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
      innerOnValueChange(initialValue, e);
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

  return (
    <FieldGroupLoadingContext.Provider value={actionLoading}>
      <InputTextualBasic
        {...rest}
        ref={innerRef}
        type={type}
        id={id}
        name={name}
        value={value}
        data-action={boundAction}
        onValueChange={innerOnValueChange}
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
          requestAction(e.target, boundAction, { event: e });
          onKeyDown?.(e);
        }}
      />
    </FieldGroupLoadingContext.Provider>
  );
});

const InputTextualInsideForm = forwardRef((props, ref) => {
  const { formContext, id, name, value, onValueChange, onKeyDown, ...rest } =
    props;
  const { formAction } = formContext;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [, setFormValue] = useOneFormParam(name, value, navState, "");

  const innerOnValueChange = (uiValue, e) => {
    setNavState(uiValue);
    setFormValue(uiValue);
    onValueChange?.(uiValue, e);
  };
  useFormEvents(innerRef, {
    onFormReset: (e) => {
      innerOnValueChange(undefined, e);
    },
  });

  return (
    <InputTextualBasic
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      onValueChange={innerOnValueChange}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const inputElement = e.target;
          const { form } = inputElement;
          const formSubmitButton = form.querySelector(
            "button[type='submit'], input[type='submit'], input[type='image']",
          );
          e.preventDefault();
          requestAction(form, formAction, {
            event: e,
            requester: formSubmitButton ? formSubmitButton : inputElement,
          });
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
