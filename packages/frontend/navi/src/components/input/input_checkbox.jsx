import { dispatchRequestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import "../checked_programmatic_change.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { CustomCheckbox } from "./custom_checkbox.jsx";

export const InputCheckbox = forwardRef((props, ref) => {
  return renderActionComponent(
    props,
    ref,
    SimpleInputCheckbox,
    ActionInputCheckbox,
  );
});

const SimpleInputCheckbox = forwardRef((props, ref) => {
  const {
    autoFocus,
    constraints = [],
    children: value,
    checked,
    loading,
    onChange,
    onProgrammaticChange,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const [innerChecked, setInnerChecked] = useState(checked);

  const inputCheckbox = (
    <input
      ref={innerRef}
      checked={innerChecked}
      value={value}
      onChange={(e) => {
        setInnerChecked(e.target.checked);
        onChange?.(e);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onprogrammaticchange={onProgrammaticChange}
      {...rest}
    />
  );

  const customInnputCheckbox = (
    <CustomCheckbox checked={innerChecked} loading={loading}>
      {inputCheckbox}
    </CustomCheckbox>
  );

  const customInputCheckboxWithLoader = (
    <LoaderBackground
      loading={loading}
      // 0.5px ensure loader background is centered on the checkbox
      // ( custom input has margin-left:4px and margin-right: 3px)
      spacingLeft={0.5}
    >
      {customInnputCheckbox}
    </LoaderBackground>
  );

  return customInputCheckboxWithLoader;
});

const ActionInputCheckbox = forwardRef((props, ref) => {
  const {
    id,
    name,
    autoFocus,
    checked: initialChecked = false,
    constraints = [],
    action,
    disabled,
    loading,
    onCancel,
    onInput,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children: value = "on",
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

  const inputCheckbox = (
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
  const customInputCheckbox = (
    <CustomCheckbox checked={checked} loading={innerLoading}>
      {inputCheckbox}
    </CustomCheckbox>
  );

  const customInputCheckboxWithLoader = (
    <LoaderBackground
      loading={innerLoading}
      // 0.5px ensure loader background is centered on the checkbox
      // ( custom input has margin-left:4px and margin-right: 3px)
      spacingLeft={0.5}
    >
      {customInputCheckbox}
    </LoaderBackground>
  );
  return customInputCheckboxWithLoader;
});
