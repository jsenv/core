import { requestAction, useConstraints } from "@jsenv/validation";
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

export const InputRadio = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, SimpleInputRadio, ActionInputRadio);
});

const CustomRadio = ({ children }) => {
  // TODO
  return <>{children}</>;
};

const SimpleInputRadio = forwardRef((props, ref) => {
  const {
    autoFocus,
    constraints = [],
    checked,
    disabled,
    loading,
    onChange,
    appeareance = "custom", // "custom" or "default"
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  const [innerChecked, setInnerChecked] = useState(checked);
  const checkedRef = useRef(checked);
  if (checkedRef.current !== checked) {
    setInnerChecked(checked);
    checkedRef.current = checked;
  }

  const handleChange = (e) => {
    setInnerChecked(e.target.checked);
    onChange?.(e);
  };

  const inputRadio = (
    <input
      ref={innerRef}
      type="radio"
      checked={innerChecked}
      disabled={disabled}
      onChange={handleChange}
      // eslint-disable-next-line react/no-unknown-property
      onprogrammaticchange={handleChange}
      {...rest}
    />
  );
  const inputRadioDisplayed =
    appeareance === "custom" ? (
      <CustomRadio checked={innerChecked} loading={loading}>
        {inputRadio}
      </CustomRadio>
    ) : (
      inputRadio
    );
  const inputRadioWithLoader = (
    <LoaderBackground loading={loading}>{inputRadioDisplayed}</LoaderBackground>
  );

  return inputRadioWithLoader;
});

const ActionInputRadio = forwardRef((props, ref) => {
  const {
    id,
    name,
    value = "",
    checked: initialChecked = false,
    action,
    disabled,
    onCancel,
    onChange,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  if (import.meta.dev && value === "") {
    console.warn(
      `InputRadio: value is an empty string, this is probably not what you want`,
    );
  }

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const [navStateValue, setNavStateValue] = useNavState(id);
  const checkedAtStart = initialChecked || navStateValue === value;
  const [effectiveAction, getCheckedValue, setCheckedValue] = useAction(
    action,
    {
      name,
      value: checkedAtStart ? value : undefined,
    },
  );
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const { pending, error, aborted } = useActionStatus(effectiveAction);

  const valueChecked = getCheckedValue();
  const checked = error || aborted ? initialChecked : value === valueChecked;

  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      if (checked) {
        setNavStateValue(value);
      }
      if (checkedAtStart) {
        setCheckedValue(value);
      }
      onCancel?.(e);
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

  return (
    <SimpleInputRadio
      {...rest}
      ref={innerRef}
      id={id}
      name={name}
      value={value}
      data-validation-message-arrow-x="center"
      checked={checked}
      disabled={disabled || pending}
      onChange={(e) => {
        const radioIsChecked = e.target.checked;
        if (radioIsChecked) {
          setNavStateValue(value);
          setCheckedValue(value);
          if (!e.target.form && action) {
            requestAction(e);
          }
        }
        onChange?.(e);
      }}
    />
  );
});
