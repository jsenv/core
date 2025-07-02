import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionOrFormAction } from "../use_action_or_form_action.js";
import { useActionParamsSignal } from "../use_action_params_signal.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
  }
`;

export const InputCheckbox = forwardRef(
  (
    {
      id,
      autoFocus,
      checked: initialChecked = false,
      constraints = [],
      requestExecuteOnChange,
      action,
      label,
      disabled,
      pendingEffect = "loading",
      pendingTarget = "input", // "input" or "label"
      onCancel,
      onInput,
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
    const checkedAtStart =
      navStateValue === undefined ? initialChecked : navStateValue;
    const checkedSignal = useActionParamsSignal(action, checkedAtStart);
    useOnFormReset(innerRef, () => {
      setNavStateValue(undefined);
    });
    const { pending } = useActionOrFormAction(innerRef, action, checkedSignal);
    const pendingRef = useRef(pending);
    if (pendingRef.current !== pending) {
      if (!pending) {
        checkedSignal.value = initialChecked;
      }
      pendingRef.current = pending;
    }

    const checked = checkedSignal.value;

    let inputCheckbox = (
      <input
        {...rest}
        ref={innerRef}
        type="checkbox"
        id={id}
        data-request-execute-on-change={requestExecuteOnChange ? "" : undefined}
        data-validation-message-arrow-x="center"
        checked={checked}
        disabled={disabled || pending}
        onInput={(e) => {
          const inputIsChecked = e.target.checked;
          if (checkedAtStart) {
            setNavStateValue(inputIsChecked ? false : undefined);
          } else {
            setNavStateValue(inputIsChecked ? true : undefined);
          }
          checkedSignal.value = inputIsChecked;
          if (onInput) {
            onInput(e);
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        oncancel={(e) => {
          e.target.checked = checked;
          setNavStateValue(checkedAtStart);
          if (onCancel) {
            onCancel();
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={() => {
          if (onActionError) {
            onActionError();
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionend={() => {
          setNavStateValue(undefined);
          if (onActionEnd) {
            onActionEnd();
          }
        }}
      />
    );

    if (pendingEffect === "loading" && pendingTarget === "input") {
      inputCheckbox = (
        <LoaderBackground pending={pending}>{inputCheckbox}</LoaderBackground>
      );
    }

    let inputCheckboxWithLabel = label ? (
      <label data-disabled={disabled || pending ? "" : undefined}>
        {label}
        {inputCheckbox}
      </label>
    ) : (
      inputCheckbox
    );

    if (pendingEffect === "loading" && pendingTarget === "label") {
      inputCheckboxWithLabel = (
        <LoaderBackground pending={pending}>
          {inputCheckboxWithLabel}
        </LoaderBackground>
      );
    }

    return inputCheckboxWithLabel;
  },
);
