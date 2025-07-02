import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionOrFormAction } from "../use_action_or_form_action.js";
import { useActionSingleParamSignal } from "../use_action_params_signal.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
  }
`;

export const InputRadio = forwardRef(
  (
    {
      id,
      name,
      value,
      autoFocus,
      checked: initialChecked = false,
      constraints = [],
      action,
      children,
      disabled,
      pendingEffect = "loading",
      pendingTarget = "input", // "input" or "label"
      onCancel,
      onChange,
      onActionStart,
      onActionError,
      onActionEnd,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    useAutoFocus(innerRef, autoFocus);
    useConstraints(innerRef, constraints);

    const [navStateValue, setNavStateValue] = useNavState(id);
    const checkedAtStart = initialChecked || navStateValue === value;
    const [checkedSignal, getParamSignalValue, setParamSignalValue] =
      useActionSingleParamSignal(action, value, name);
    useOnFormReset(innerRef, () => {
      if (checkedAtStart) {
        setNavStateValue(value);
      }
    });
    const { pending, error, aborted } = useActionOrFormAction(
      innerRef,
      action,
      checkedSignal,
    );

    const valueChecked = getParamSignalValue();
    const checked = error || aborted ? initialChecked : value === valueChecked;

    let inputRadio = (
      <input
        {...rest}
        ref={innerRef}
        type="radio"
        id={id}
        name={name}
        data-validation-message-arrow-x="center"
        checked={checked}
        disabled={disabled || pending}
        onChange={(e) => {
          const radioIsChecked = e.target.checked;
          if (radioIsChecked) {
            setNavStateValue(value);
            setParamSignalValue(value);
          }
          if (onChange) {
            onChange(e);
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        oncancel={(e) => {
          e.target.checked = checkedAtStart;
          if (checkedAtStart) {
            setNavStateValue(value);
          }
          if (onCancel) {
            onCancel();
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={onActionError}
        // eslint-disable-next-line react/no-unknown-property
        onactionend={() => {
          if (checkedAtStart) {
            setNavStateValue(value);
          }
          if (onActionEnd) {
            onActionEnd();
          }
        }}
      />
    );

    if (pendingEffect === "loading" && pendingTarget === "input") {
      inputRadio = (
        <LoaderBackground pending={pending}>{inputRadio}</LoaderBackground>
      );
    }

    let inputRadioWithLabel = children ? (
      <label data-disabled={disabled || pending ? "" : undefined}>
        {inputRadio}
        {children}
      </label>
    ) : (
      inputRadio
    );

    if (pendingEffect === "loading" && pendingTarget === "label") {
      inputRadioWithLabel = (
        <LoaderBackground pending={pending}>
          {inputRadioWithLabel}
        </LoaderBackground>
      );
    }

    return inputRadioWithLabel;
  },
);
