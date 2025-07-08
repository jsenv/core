/**
 * Input component for all textual input types.
 *
 * Supports:
 * - text (default)
 * - password
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
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useActionBoundToOneParam } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnChange } from "../use_on_change.js";

export const InputTextual = forwardRef((props, ref) => {
  return renderActionComponent(
    props,
    ref,
    SimpleInputTextual,
    ActionInputTextual,
  );
});

const SimpleInputTextual = forwardRef((props, ref) => {
  const {
    autoFocus,
    autoSelect,
    constraints = [],
    disabled,
    loading,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus, autoSelect);
  useConstraints(innerRef, constraints);

  const inputTextual = <input ref={innerRef} disabled={disabled} {...rest} />;

  return (
    <LoaderBackground
      loading={loading}
      color={disabled && loading ? "rgb(118, 118, 118)" : undefined}
    >
      {inputTextual}
    </LoaderBackground>
  );
});

const ActionInputTextual = forwardRef((props, ref) => {
  const {
    id,
    name,
    action,
    value: initialValue = "",
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    disabled,
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

  const [effectiveAction, getValue, setValue] = useActionBoundToOneParam(
    action,
    name,
    valueAtStart,
  );
  const { pending } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const value = getValue();
  const actionRequesterRef = useRef();

  const preventNextChangeRef = useRef(false);
  useOnChange(innerRef, (e) => {
    if (!action) {
      return;
    }
    if (preventNextChangeRef.current) {
      preventNextChangeRef.current = false;
      return;
    }
    actionRequesterRef.current = e.target;
    requestAction(e);
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
      setValue(valueAtStart);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (e) => {
      if (action) {
        executeAction(effectiveAction, {
          requester: e.detail.requester,
          event: e.detail.reasonEvent,
        });
      }
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: () => {
      setNavStateValue(undefined);
      onActionEnd?.();
    },
  });

  const innerDisabled = disabled || pending;
  const innerLoading =
    loading || (pending && actionRequesterRef.current === innerRef.current);

  return (
    <SimpleInputTextual
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      disabled={innerDisabled}
      loading={innerLoading}
      onInput={(e) => {
        const inputValue = e.target.value;
        setNavStateValue(inputValue);
        setValue(inputValue);
        onInput?.(e);
      }}
      onKeyDown={(e) => {
        if (!action) {
          return;
        }
        if (e.key !== "Enter") {
          return;
        }
        const input = e.target;
        if (input.form) {
          return;
        }
        e.preventDefault();
        actionRequesterRef.current = input;
        /**
         * Browser trigger a "change" event right after the enter is pressed
         * if the input value has changed.
         * We need to prevent the next change event otherwise we would request action twice
         */
        preventNextChangeRef.current = true;
        setTimeout(() => {
          preventNextChangeRef.current = false;
        });
        requestAction(e);
      }}
    />
  );
});
