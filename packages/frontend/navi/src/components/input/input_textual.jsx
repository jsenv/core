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
import { useImperativeHandle, useRef } from "preact/hooks";
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
  const {
    autoFocus,
    autoFocusVisible,
    autoSelect,
    constraints = [],
    loading,
    appearance = "custom",
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus, {
    autoFocusVisible,
    autoSelect,
  });
  useConstraints(innerRef, constraints);

  const inputTextual = (
    <input
      ref={innerRef}
      data-field=""
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

const InputTextualWithAction = forwardRef((props, ref) => {
  const {
    id,
    name,
    action,
    type,
    value: initialValue = "",
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

  if (import.meta.dev && action && !name) {
    console.warn(`InputTextual with action requires a name prop to be set.`);
  }

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const valueAtStart =
    initialValue === undefined || initialValue === ""
      ? navState === undefined
        ? ""
        : navState
      : initialValue;

  const [boundAction, getValue, setValue, resetValue] =
    useActionBoundToOneParam(action, name, valueAtStart);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const value = getValue();

  const valueAtEnterRef = useRef(null);
  useOnChange(innerRef, (e) => {
    if (
      valueAtEnterRef.current !== null &&
      e.target.value === valueAtEnterRef.current
    ) {
      valueAtEnterRef.current = null;
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
      if (reason === "escape_key" && !cancelOnEscape) {
        return;
      }
      setNavState(undefined);
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
      ref={innerRef}
      type={type}
      id={id}
      name={name}
      value={value}
      loading={innerLoading}
      readOnly={readOnly || innerLoading}
      onInput={(e) => {
        valueAtEnterRef.current = null;
        const inputValue =
          type === "number" ? e.target.valueAsNumber : e.target.value;
        setNavState(inputValue);
        setValue(inputValue);
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
        valueAtEnterRef.current = e.target.value;
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
    value: initialValue = "",
    loading,
    readOnly,
    onInput,
    onKeyDown,
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navState, setNavState] = useNavState(id);
  const valueAtStart =
    initialValue === undefined || initialValue === ""
      ? navState === undefined
        ? ""
        : navState
      : initialValue;

  const { formAction, formIsBusy, formIsReadOnly, formActionRequester } =
    formContext;
  const [getValue, setValue] = useOneFormParam(name, valueAtStart);
  const value = getValue();

  return (
    <InputTextualBasic
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      loading={
        loading || (formIsBusy && formActionRequester === innerRef.current)
      }
      readOnly={readOnly || formIsReadOnly}
      onInput={(e) => {
        const inputValue = e.target.value;
        setNavState(inputValue);
        setValue(inputValue);
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
