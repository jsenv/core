import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionOrFormAction } from "../use_action_or_form_action.js";
import { useActionParamsSignal } from "../use_action_params_signal.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

export const Input = forwardRef(
  (
    {
      type = "text",
      id,
      autoFocus,
      autoSelect,
      action,
      label,
      value: initialValue = "",
      constraints = [],
      cancelOnBlurInvalid,
      cancelOnEscape,
      pendingEffect = "loading",
      requestExecuteOnChange,
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
    const valueSignal = useActionParamsSignal(action, valueAtStart);
    const { pending } = useActionOrFormAction(innerRef, action, valueSignal);
    const value = valueSignal.value;

    const input = (
      <input
        {...rest}
        type={type}
        ref={innerRef}
        value={value}
        disabled={disabled || pending}
        onInput={(e) => {
          setNavStateValue(e.target.value);
          valueSignal.value = e.target.value;
          if (onInput) {
            onInput(e);
          }
        }}
        data-request-execute-on-change={requestExecuteOnChange ? "" : undefined}
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

    const inputWithLabel = label ? (
      <label>
        {label}
        {input}
      </label>
    ) : (
      input
    );

    if (pendingEffect === "loading") {
      return (
        <LoaderBackground pending={pending}>{inputWithLabel}</LoaderBackground>
      );
    }
    return inputWithLabel;
  },
);
