import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionOrFormAction } from "../use_action_or_form_action.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";

export const InputText = forwardRef(
  (
    {
      id,
      autoFocus,
      autoSelect,
      action,
      label,
      defaultValue = "",
      value,
      constraints = [],
      cancelOnBlurInvalid,
      pendingEffect = "loading",
      requestExecuteOnChange,
      oncancel,
      disabled,
      onInput,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);

    useConstraints(innerRef, constraints);
    const [{ pending }] = useActionOrFormAction(innerRef, action);
    useAutoFocus(innerRef, autoFocus, autoSelect);

    const [navStateValue, setNavStateValue] = useNavState(id);
    defaultValue = defaultValue || navStateValue;

    const input = (
      <input
        {...rest}
        ref={innerRef}
        type="text"
        value={value === undefined ? defaultValue : value}
        disabled={disabled || pending}
        onInput={(e) => {
          setNavStateValue(e.target.value);
          onInput?.(e);
        }}
        data-request-execute-on-change={requestExecuteOnChange ? "" : undefined}
        // eslint-disable-next-line react/no-unknown-property
        oncancel={(event) => {
          if (event.detail === "blur_invalid" && !cancelOnBlurInvalid) {
            return;
          }
          innerRef.current.value =
            value === undefined || value === "" ? "" : value;
          if (oncancel) {
            oncancel(event);
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={() => {
          setNavStateValue(undefined);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={(e) => {
          setNavStateValue(e.target.value);
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
