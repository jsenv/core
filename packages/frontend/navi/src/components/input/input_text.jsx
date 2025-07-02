import { useConstraints } from "@jsenv/validation";
import { useSignal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionOrFormAction } from "../use_action_or_form_action.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

export const InputText = forwardRef(
  (
    {
      id,
      autoFocus,
      autoSelect,
      action,
      label,
      defaultValue = "",
      value: initialValue,
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

    const valueAtStart =
      initialValue === undefined || initialValue === "" ? "" : initialValue;
    const [navStateValue, setNavStateValue] = useNavState(id);
    defaultValue = navStateValue === undefined ? defaultValue : navStateValue;
    useOnFormReset(innerRef, () => {
      setNavStateValue(undefined);
    });

    const value = initialValue === undefined ? defaultValue : initialValue;

    const valueSignal = useSignal(value);
    const { pending } = useActionOrFormAction(innerRef, action, valueSignal);

    const input = (
      <input
        type="text"
        {...rest}
        ref={innerRef}
        value={valueSignal.value}
        disabled={disabled || pending}
        onInput={(e) => {
          setNavStateValue(e.target.value);
          valueSignal.value = e.target.value;
          onInput?.(e);
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
