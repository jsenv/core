import { useConstraints } from "@jsenv/form";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../action/action_hooks.js";
import { useAutoFocus } from "../hooks/use_auto_focus.js";
import { useNavState } from "../hooks/use_nav_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useSPAFormStatus } from "./use_spa_form_status.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";

export const InputText = forwardRef(
  (
    {
      id,
      autoFocus,
      autoSelect,
      required,
      action,
      name,
      defaultValue = "",
      value,
      constraints = [],
      requestSubmitOnChange,
      cancelOnBlurInvalid,
      formPendingEffect,
      oncancel,
      disabled,
      onInput,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    const spaFormStatus = useSPAFormStatus();
    action = action || spaFormStatus.action;
    const { pending } = useActionStatus(action);
    useAutoFocus(innerRef, autoFocus, autoSelect);
    useRequestSubmitOnChange(innerRef, {
      requestSubmitOnChange,
      preventWhenValueMissing: true,
    });
    useConstraints(innerRef, constraints);

    const [navStateValue, setNavStateValue] = useNavState(id);
    defaultValue = defaultValue || navStateValue;

    const input = (
      <input
        {...rest}
        ref={innerRef}
        type="text"
        name={name}
        value={value === undefined ? defaultValue : value}
        disabled={disabled || pending}
        required={required}
        onInput={(e) => {
          setNavStateValue(e.target.value);
          onInput?.(e);
        }}
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
    if (formPendingEffect === "loading") {
      return <LoaderBackground pending={pending}>{input}</LoaderBackground>;
    }
    return input;
  },
);
