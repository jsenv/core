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
 * For non-textual inputs, use specialized components:
 * - InputCheckbox for type="checkbox"
 * - InputRadio for type="radio"
 */

import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
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
import { useNavState } from "../use_nav_state.js";
import { useOnChange } from "./use_on_change.js";

import.meta.css = /* css */ `
  input[data-custom] {
    --button-border-width: 1px;
    --button-outline-width: 1px;

    border-radius: 2px;
    border-width: calc(
      var(--button-border-width) + var(--button-outline-width)
    );
    border-style: solid;
    border-color: transparent;
    outline: var(--button-border-width) solid light-dark(#767676, #8e8e93);
    outline-offset: calc(-1 * (var(--button-border-width)));
  }

  input[data-custom]:active {
    outline-color: light-dark(#808080, #707070);
  }

  input[data-custom][readonly] {
    outline-color: light-dark(#d1d5db, #4b5563);
    background: light-dark(#f3f4f6, #2d3748);
    color: light-dark(#374151, #cbd5e0);
  }

  input[data-custom]:focus-visible {
    outline-width: calc(
      var(--button-border-width) + var(--button-outline-width)
    );
    outline-offset: calc(
      -1 * (var(--button-border-width) + var(--button-outline-width))
    );
    outline-color: light-dark(#355fcc, #3b82f6);
  }

  input[data-custom]:disabled {
    outline-color: light-dark(#a0a0a050, #90909050);
    background-color: rgb(239, 239, 239);
    color: light-dark(rgba(16, 16, 16, 0.3), rgba(255, 255, 255, 0.3));
  }
`;

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
      data-custom={appearance === "custom" ? "" : undefined}
      {...rest}
    />
  );

  return <LoaderBackground loading={loading}>{inputTextual}</LoaderBackground>;
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

  const [navStateValue, setNavStateValue] = useNavState(id);
  const valueAtStart =
    initialValue === undefined || initialValue === ""
      ? navStateValue === undefined
        ? ""
        : navStateValue
      : initialValue;

  const [boundAction, getValue, setValue, resetValue] =
    useActionBoundToOneParam(action, name, valueAtStart);
  const { pending } = useActionStatus(boundAction);
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
      setNavStateValue(undefined);
      resetValue();
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: (e) => {
      setNavStateValue(undefined);
      onActionEnd?.(e);
    },
  });

  const innerLoading = loading || pending;

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
        setNavStateValue(inputValue);
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

  const [navStateValue, setNavStateValue] = useNavState(id);
  const valueAtStart =
    initialValue === undefined || initialValue === ""
      ? navStateValue === undefined
        ? ""
        : navStateValue
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
        setNavStateValue(inputValue);
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
