import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useActionSingleParamSignal } from "../action_execution/use_action_params_signal.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

export const Input = forwardRef(
  (
    {
      type = "text",
      id,
      name,
      autoFocus,
      autoSelect,
      action,
      label,
      value: initialValue = "",
      constraints = [],
      cancelOnBlurInvalid,
      cancelOnEscape,
      pendingEffect = "loading",
      pendingTarget = "input", // "input" or "label"
      disabled,
      onInput,
      onCancel,
      onActionStart,
      onActionError,
      onActionEnd,
      ...rest
    },
    ref,
  ) => {
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
    const [paramSignal, getParamSignalValue, setParamSignalValue] =
      useActionSingleParamSignal(action, valueAtStart, name);
    const { pending } = useActionOrParentActionStatus(
      innerRef,
      action,
      paramSignal,
    );
    const value = getParamSignalValue();

    let input = (
      <input
        {...rest}
        type={type}
        ref={innerRef}
        value={value}
        disabled={disabled || pending}
        onInput={(e) => {
          setNavStateValue(e.target.value);
          setParamSignalValue(e.target.value);
          if (onInput) {
            onInput(e);
          }
        }}
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
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={onActionError}
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
      input = <LoaderBackground pending={pending}>{input}</LoaderBackground>;
    }

    let inputWithLabel = label ? (
      <label>
        {label}
        {input}
      </label>
    ) : (
      input
    );

    if (pendingEffect === "loading" && pendingTarget === "label") {
      inputWithLabel = (
        <LoaderBackground pending={pending}>{inputWithLabel}</LoaderBackground>
      );
    }
    return inputWithLabel;
  },
);
