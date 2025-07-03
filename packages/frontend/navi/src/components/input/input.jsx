import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

export const Input = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, ActionInput, SimpleInput);
});

const SimpleInput = forwardRef((props, ref) => {
  const { autoFocus, constraints = [], children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  let input = (
    <input ref={innerRef} {...rest}>
      {children}
    </input>
  );

  if (children) {
    input = (
      <label>
        {children}
        {input}
      </label>
    );
  }

  return input;
});

const ActionInput = forwardRef((props, ref) => {
  const {
    type = "text",
    id,
    name,
    autoFocus,
    autoSelect,
    action,
    value: initialValue = "",
    constraints = [],
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionPendingEffect = "loading",
    actionErrorEffect,
    disabled,
    onInput,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus, autoSelect);
  useConstraints(innerRef, constraints);

  const [navStateValue, setNavStateValue] = useNavState(id);
  useOnFormReset(innerRef, () => {
    setNavStateValue(undefined);
  });
  const valueAtStart =
    initialValue === undefined || initialValue === ""
      ? navStateValue === undefined
        ? ""
        : navStateValue
      : initialValue;

  const [effectiveAction, getValue, setValue] = useAction(action, {
    name,
    value: valueAtStart,
  });
  const { pending } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const value = getValue();

  let input = (
    <input
      {...rest}
      ref={innerRef}
      type={type}
      id={id}
      name={name}
      value={value}
      disabled={disabled || pending}
      // eslint-disable-next-line react/no-unknown-property
      oncancel={(event) => {
        if (event.detail === "blur_invalid" && !cancelOnBlurInvalid) {
          return;
        }
        if (event.detail === "escape_key" && !cancelOnEscape) {
          return;
        }
        innerRef.current.value = valueAtStart;
        if (onCancel) {
          onCancel(event);
        }
      }}
      onInput={(e) => {
        const inputValue = e.target.value;
        setNavStateValue(inputValue);
        setValue(inputValue);
        onInput?.(e);
        if (action) {
          e.target.requestAction(e);
        }
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
        if (action) {
          executeAction(effectiveAction, {
            requester: actionEvent.target,
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

  if (actionPendingEffect === "loading") {
    input = <LoaderBackground pending={pending}>{input}</LoaderBackground>;
  }

  let inputWithLabel = children ? (
    <label data-disabled={disabled || pending ? "" : undefined}>
      {children}
      {input}
    </label>
  ) : (
    input
  );

  return inputWithLabel;
});
