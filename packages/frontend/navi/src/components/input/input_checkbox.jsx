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

import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
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
  const { autoFocus, constraints = [], children, ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  let input = (
    <input ref={innerRef} type="checkbox" {...rest}>
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

const ActionInputCheckbox = forwardRef(
  (
    {
      id,
      name,
      autoFocus,
      checked: initialChecked = false,
      constraints = [],
      action,
      disabled,
      onCancel,
      onInput,
      actionPendingEffect = "loading",
      actionErrorEffect,
      onActionPrevented,
      onActionStart,
      onActionError,
      onActionEnd,
      children,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    const [navStateValue, setNavStateValue] = useNavState(id);
    useOnFormReset(innerRef, () => {
      setNavStateValue(undefined);
    });
    const checkedAtStart =
      navStateValue === undefined ? initialChecked : navStateValue;

    const [effectiveAction, getChecked, setChecked] = useAction(
      action,
      name,
      checkedAtStart ? "on" : undefined,
    );
    const { pending, error, aborted } = useActionStatus(effectiveAction);
    const executeAction = useExecuteAction(innerRef, {
      errorEffect: actionErrorEffect,
    });

    const checkedFromSignal = getChecked();
    const checked = error || aborted ? initialChecked : checkedFromSignal;

    let inputCheckbox = (
      <input
        {...rest}
        ref={innerRef}
        type="checkbox"
        id={id}
        name={name}
        data-validation-message-arrow-x="center"
        checked={checked}
        disabled={disabled || pending}
        // eslint-disable-next-line react/no-unknown-property
        oncancel={(e) => {
          e.target.checked = checked;
          setNavStateValue(checkedAtStart);
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
          setChecked(checkboxIsChecked ? "on" : undefined);
          if (onInput) {
            onInput(e);
          }
          if (action) {
            e.target.requestAction();
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
      inputCheckbox = (
        <LoaderBackground pending={pending}>{inputCheckbox}</LoaderBackground>
      );
    }

    let inputCheckboxWithLabel = children ? (
      <label data-disabled={disabled || pending ? "" : undefined}>
        {children}
        {inputCheckbox}
      </label>
    ) : (
      inputCheckbox
    );

    return inputCheckboxWithLabel;
  },
);
