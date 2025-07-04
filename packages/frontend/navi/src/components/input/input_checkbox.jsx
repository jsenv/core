import { dispatchRequestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";
import { CheckboxIcon } from "./checkbox_icon.jsx";

import.meta.css = /*css*/ `
input[type="checkbox"][data-visually-hidden] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
  border: none;
}
`;

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
    <>
      <input
        data-visually-hidden
        ref={innerRef}
        checked={innerChecked}
        onChange={(e) => {
          setInnerChecked(e.target.checked);
        }}
        {...rest}
      />
      <CheckboxIcon checked={innerChecked} loading={loading} />
    </>
  );

  return (
    <LoaderBackground pending={loading} spacingLeft={0.5}>
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
  useOnFormReset(innerRef, () => {
    setNavStateValue(navStateValue);
    setChecked(checkedAtStart);
  });

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

  let inputCheckbox = (
    <input
      {...rest}
      data-visually-hidden
      ref={innerRef}
      type="checkbox"
      id={id}
      name={name}
      value={value}
      data-validation-message-arrow-x="center"
      checked={checked}
      disabled={disabled || pending}
      // eslint-disable-next-line react/no-unknown-property
      oncancel={(e) => {
        if (e.detail === "blur_invalid") {
          return;
        }
        e.target.checked = checked;
        setNavStateValue(undefined);
        if (onCancel) {
          onCancel();
        }
      }}
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
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
        if (action) {
          executeAction(effectiveAction, {
            requester: actionEvent.detail.requester,
          });
        }
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionstart={onActionStart}
      // eslint-disable-next-line react/no-unknown-property
      onactionerror={onActionError}
      // eslint-disable-next-line react/no-unknown-property
      onactionend={() => {
        setNavStateValue(undefined);
        onActionEnd?.();
      }}
    />
  );

  const innerLoading = loading || pending;
  inputCheckbox = (
    <>
      {inputCheckbox}
      <CheckboxIcon checked={checked} loading={innerLoading} />
    </>
  );

  if (actionPendingEffect === "loading") {
    return (
      <LoaderBackground pending={innerLoading} spacingLeft={0.5}>
        {inputCheckbox}
      </LoaderBackground>
    );
  }
  return inputCheckbox;
});
