import { dispatchRequestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { CustomCheckbox } from "./custom_checkbox.jsx";

export const InputCheckbox = forwardRef((props, ref) => {
  return renderActionComponent(
    props,
    ref,
    ActionInputCheckbox,
    SimpleInputCheckbox,
  );
});

const SimpleInputCheckbox = forwardRef((props, ref) => {
  const { autoFocus, constraints = [], checked, loading, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const [innerChecked, setInnerChecked] = useState(checked);

  const inputCheckbox = (
    <CustomCheckbox checked={innerChecked} loading={loading}>
      <input
        ref={innerRef}
        checked={innerChecked}
        onChange={(e) => {
          setInnerChecked(e.target.checked);
        }}
        {...rest}
      />
    </CustomCheckbox>
  );

  return (
    <LoaderBackground
      pending={loading}
      // input has margin-left:4px and margin-right: 3px. To ensure it's centered we move it by 0.5px
      spacingLeft={0.5}
    >
      {inputCheckbox}
    </LoaderBackground>
  );
});

const ActionInputCheckbox = forwardRef((props, ref) => {
  const {
    id,
    name,
    value = "on",
    autoFocus,
    checked: initialChecked = false,
    constraints = [],
    action,
    disabled,
    loading,
    onCancel,
    onInput,
    actionPendingEffect = "loading",
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const [navStateValue, setNavStateValue] = useNavState(id, undefined, {
    debug: true,
  });
  const checkedAtStart =
    navStateValue === undefined ? initialChecked : navStateValue;

  const [effectiveAction, getChecked, setChecked] = useAction(action, {
    name,
    value: checkedAtStart ? value : undefined,
  });
  const { pending, error, aborted } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  const checkedFromSignal = getChecked();
  const checked = error || aborted ? initialChecked : checkedFromSignal;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      setNavStateValue(undefined);
      setChecked(checkedAtStart);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: (e) => {
      if (action) {
        executeAction(effectiveAction, {
          requester: e.detail.requester,
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

  let inputCheckbox = (
    <input
      {...rest}
      ref={innerRef}
      type="checkbox"
      id={id}
      name={name}
      value={value}
      checked={checked}
      disabled={disabled || pending}
      data-validation-message-arrow-x="center"
      onInput={(e) => {
        const checkboxIsChecked = e.target.checked;
        if (checkedAtStart) {
          setNavStateValue(checkboxIsChecked ? false : undefined);
        } else {
          setNavStateValue(checkboxIsChecked ? true : undefined);
        }
        setChecked(checkboxIsChecked ? value : undefined);
        onInput?.(e);
        if (action) {
          dispatchRequestAction(e.target);
        }
      }}
    />
  );

  const innerLoading = loading || pending;
  inputCheckbox = (
    <CustomCheckbox checked={checked} loading={innerLoading}>
      {inputCheckbox}
    </CustomCheckbox>
  );

  if (actionPendingEffect === "loading") {
    return (
      <LoaderBackground
        pending={innerLoading}
        // input has margin-left:4px and margin-right: 3px. To ensure it's centered we move it by 0.5px
        spacingLeft={0.5}
      >
        {inputCheckbox}
      </LoaderBackground>
    );
  }
  return inputCheckbox;
});
